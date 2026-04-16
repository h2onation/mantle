// E2E tests for the confirm_checkpoint_write RPC and the TS wrapper.
// Exercises the actual Postgres function installed by
// supabase/migrations/20260417000003_confirm_idempotency.sql.
//
// Validates: happy path, idempotency on repeat, concurrent-call safety
// (unique index + FOR UPDATE), already-rejected refusal.
//
// Runs against local Supabase. See docs/checkpoint-hardening-plan.md
// Track 5.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const RUN_TAG = `e2e-confirm-${Date.now()}-${randomUUID().slice(0, 8)}`;

let admin: SupabaseClient;
let userId: string;
let conversationId: string;

// Helper: create a fresh pending checkpoint message and return its id.
async function seedPendingCheckpoint(layer = 1): Promise<string> {
  const { data, error } = await admin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: "Checkpoint reflection body.",
      is_checkpoint: true,
      checkpoint_meta: {
        layer,
        name: "Test pattern",
        status: "pending",
        composed_content: "Polished composed entry content.",
        composed_name: "Composed Pattern Name",
        changelog: null,
        composed_summary: "A short summary.",
        composed_key_words: ["alpha", "beta"],
      },
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`seed failed: ${error?.message}`);
  return data.id;
}

beforeAll(async () => {
  if (!SERVICE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY not set. Run `supabase start` locally or in CI setup."
    );
  }
  admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email: `${RUN_TAG}@test.local`,
    password: "test-password-1234",
    email_confirm: true,
  });
  if (userErr || !userData?.user) {
    throw new Error(`create user failed: ${userErr?.message}`);
  }
  userId = userData.user.id;

  // Profile trigger may not fire in every test DB; insert if missing.
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();
  if (!profile) await admin.from("profiles").insert({ id: userId });

  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (convErr || !conv) throw new Error(`seed conv: ${convErr?.message}`);
  conversationId = conv.id;
});

afterAll(async () => {
  if (admin && userId) await admin.auth.admin.deleteUser(userId);
});

describe("confirm_checkpoint_write RPC — happy path", () => {
  it("inserts a manual_entries row and flips status", async () => {
    const messageId = await seedPendingCheckpoint();

    const { data, error } = await admin.rpc("confirm_checkpoint_write", {
      p_message_id: messageId,
      p_user_id: userId,
      p_layer: 1,
      p_name: "Test Pattern Name",
      p_content: "Composed content.",
      p_summary: "Summary.",
      p_key_words: ["x", "y"],
    });
    expect(error).toBeNull();
    const row = Array.isArray(data) ? data[0] : data;
    expect(row?.entry_id).toBeTruthy();
    expect(row?.was_already_confirmed).toBe(false);

    // Row landed
    const { data: entry } = await admin
      .from("manual_entries")
      .select("id, source_message_id, name, content, summary, key_words")
      .eq("id", row!.entry_id)
      .single();
    expect(entry?.source_message_id).toBe(messageId);
    expect(entry?.name).toBe("Test Pattern Name");
    expect(entry?.content).toBe("Composed content.");
    expect(entry?.summary).toBe("Summary.");
    expect(entry?.key_words).toEqual(["x", "y"]);

    // Status flipped
    const { data: msg } = await admin
      .from("messages")
      .select("checkpoint_meta")
      .eq("id", messageId)
      .single();
    const meta = msg?.checkpoint_meta as { status: string } | null;
    expect(meta?.status).toBe("confirmed");

    // System message inserted
    const { data: sys } = await admin
      .from("messages")
      .select("content")
      .eq("conversation_id", conversationId)
      .eq("role", "system");
    expect(sys?.some((r) => r.content === "[User confirmed the checkpoint]")).toBe(
      true
    );
  });
});

describe("confirm_checkpoint_write RPC — idempotency", () => {
  it("repeat call returns was_already_confirmed=true with same entry id", async () => {
    const messageId = await seedPendingCheckpoint(2);

    const first = await admin.rpc("confirm_checkpoint_write", {
      p_message_id: messageId,
      p_user_id: userId,
      p_layer: 2,
      p_name: "Idempotent",
      p_content: "Body.",
      p_summary: "Sum.",
      p_key_words: null,
    });
    const firstRow = Array.isArray(first.data) ? first.data[0] : first.data;
    expect(first.error).toBeNull();
    expect(firstRow?.was_already_confirmed).toBe(false);
    const entryId = firstRow!.entry_id;

    const second = await admin.rpc("confirm_checkpoint_write", {
      p_message_id: messageId,
      p_user_id: userId,
      p_layer: 2,
      p_name: "Idempotent",
      p_content: "Body.",
      p_summary: "Sum.",
      p_key_words: null,
    });
    const secondRow = Array.isArray(second.data) ? second.data[0] : second.data;
    expect(second.error).toBeNull();
    expect(secondRow?.was_already_confirmed).toBe(true);
    expect(secondRow?.entry_id).toBe(entryId);

    // Exactly one row exists in manual_entries for this source.
    const { data: rows, error: queryErr } = await admin
      .from("manual_entries")
      .select("id")
      .eq("user_id", userId)
      .eq("source_message_id", messageId);
    expect(queryErr).toBeNull();
    expect(rows?.length).toBe(1);
  });

  it("concurrent invocations produce exactly one row", async () => {
    const messageId = await seedPendingCheckpoint(3);

    const call = () =>
      admin.rpc("confirm_checkpoint_write", {
        p_message_id: messageId,
        p_user_id: userId,
        p_layer: 3,
        p_name: "Race",
        p_content: "Body.",
        p_summary: "Sum.",
        p_key_words: null,
      });

    const [a, b] = await Promise.all([call(), call()]);
    // Both should succeed (no error), one should report was_already_confirmed.
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    const aRow = Array.isArray(a.data) ? a.data[0] : a.data;
    const bRow = Array.isArray(b.data) ? b.data[0] : b.data;
    const confirmedFlags = [
      aRow?.was_already_confirmed,
      bRow?.was_already_confirmed,
    ];
    expect(confirmedFlags.sort()).toEqual([false, true]);
    expect(aRow?.entry_id).toBe(bRow?.entry_id);

    // Still exactly one manual_entries row.
    const { data: rows } = await admin
      .from("manual_entries")
      .select("id")
      .eq("user_id", userId)
      .eq("source_message_id", messageId);
    expect(rows?.length).toBe(1);
  });
});

describe("confirm_checkpoint_write RPC — error states", () => {
  it("unknown message id raises checkpoint_not_found", async () => {
    const fakeId = randomUUID();
    const { data, error } = await admin.rpc("confirm_checkpoint_write", {
      p_message_id: fakeId,
      p_user_id: userId,
      p_layer: 1,
      p_name: "x",
      p_content: "x",
      p_summary: "x",
      p_key_words: null,
    });
    expect(data).toBeNull();
    expect(error?.message || "").toContain("checkpoint_not_found");
  });

  it("rejected checkpoint raises checkpoint_not_pending", async () => {
    const messageId = await seedPendingCheckpoint(4);
    // Flip to rejected manually to simulate the state.
    await admin
      .from("messages")
      .update({
        checkpoint_meta: {
          layer: 4,
          name: "Rejected",
          status: "rejected",
          composed_content: null,
          composed_name: null,
          changelog: null,
          composed_summary: null,
          composed_key_words: null,
        },
      })
      .eq("id", messageId);

    const { data, error } = await admin.rpc("confirm_checkpoint_write", {
      p_message_id: messageId,
      p_user_id: userId,
      p_layer: 4,
      p_name: "x",
      p_content: "x",
      p_summary: "x",
      p_key_words: null,
    });
    expect(data).toBeNull();
    expect(error?.message || "").toContain("checkpoint_not_pending");
  });
});
