// Drift canary.
// For every table the application code writes to, attempt the exact
// insert the code produces. If a NOT NULL column is missing, a column
// doesn't exist, or a constraint has changed, this test fails and the
// CI run is red — catching the class of bug that surfaced on 2026-04-16
// (stale `type` NOT NULL column on `manual_entries`).
//
// Runs against local Supabase (via `supabase start`), not prod.
// Cleans up its own rows with a unique test-run prefix and afterAll.
//
// See docs/checkpoint-hardening-plan.md Track 5.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Tag every row we insert with this run id so we can clean up cleanly
// even if individual tests error mid-flight.
const RUN_TAG = `e2e-${Date.now()}-${randomUUID().slice(0, 8)}`;

let admin: SupabaseClient;
let testUserId: string;
let testConversationId: string;
let testMessageId: string;

beforeAll(async () => {
  if (!SERVICE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY not set. Run `supabase start` and export it (see vitest.e2e.config.ts)."
    );
  }
  admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create an auth user (via admin API) so the profiles FK holds.
  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email: `${RUN_TAG}@test.local`,
    password: "test-password-1234",
    email_confirm: true,
  });
  if (userErr || !userData?.user) {
    throw new Error(`Failed to create test user: ${userErr?.message}`);
  }
  testUserId = userData.user.id;

  // profiles row is normally created by handle_new_user() trigger on
  // auth.users insert. Verify it exists.
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", testUserId)
    .single();
  if (!profile) {
    // Trigger didn't fire (e.g. in a minimal test DB). Insert manually.
    await admin.from("profiles").insert({ id: testUserId });
  }

  // Seed a conversation for child-record inserts.
  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .insert({ user_id: testUserId })
    .select("id")
    .single();
  if (convErr || !conv) {
    throw new Error(`Failed to seed conversation: ${convErr?.message}`);
  }
  testConversationId = conv.id;

  // Seed a message we can use as source_message_id for manual_entries.
  const { data: msg, error: msgErr } = await admin
    .from("messages")
    .insert({
      conversation_id: testConversationId,
      role: "assistant",
      content: "seed checkpoint for canary",
      is_checkpoint: true,
      checkpoint_meta: {
        layer: 1,
        name: "canary",
        status: "pending",
        composed_content: null,
        composed_name: null,
        changelog: null,
        composed_summary: null,
        composed_key_words: null,
      },
    })
    .select("id")
    .single();
  if (msgErr || !msg) {
    throw new Error(`Failed to seed message: ${msgErr?.message}`);
  }
  testMessageId = msg.id;
});

afterAll(async () => {
  if (!admin || !testUserId) return;
  // Cascading delete via profile (FK with ON DELETE CASCADE on conversations
  // and manual_entries). Also cleans auth.users via admin API.
  await admin.auth.admin.deleteUser(testUserId);
});

// Each table the application code writes to. For each, the shape mirrors
// a real insert in the codebase (grep the `src/` tree to reproduce).
// If this fails, the column the insert requires has drifted.
describe("DB contract — every code-insert shape is accepted", () => {
  it("manual_entries (confirm-checkpoint.ts / dev-populate): full shape", async () => {
    const { data, error } = await admin
      .from("manual_entries")
      .insert({
        user_id: testUserId,
        layer: 2,
        name: "Canary entry",
        content: "Canary content.",
        source_message_id: null, // populate-style row (null source)
        summary: "Canary summary.",
        key_words: ["a", "b"],
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
  });

  it("manual_entries: minimal shape (populate-like, null name)", async () => {
    const { error } = await admin.from("manual_entries").insert({
      user_id: testUserId,
      layer: 3,
      name: null,
      content: "Minimal canary content.",
    });
    expect(error).toBeNull();
  });

  it("messages (call-persona.ts / route): assistant streaming write", async () => {
    const { error } = await admin.from("messages").insert({
      conversation_id: testConversationId,
      role: "assistant",
      content: "Canary streaming write.",
      processing_text: "thinking...",
      extraction_snapshot: { foo: "bar" },
    });
    expect(error).toBeNull();
  });

  it("messages: system checkpoint-action message", async () => {
    const { error } = await admin.from("messages").insert({
      conversation_id: testConversationId,
      role: "system",
      content: "[User confirmed the checkpoint]",
    });
    expect(error).toBeNull();
  });

  it("conversations (call-persona.ts update path)", async () => {
    const { error } = await admin
      .from("conversations")
      .update({ summary: "canary summary", extraction_state: { layers: {} } })
      .eq("id", testConversationId);
    expect(error).toBeNull();
  });

  it("profiles: persona_mode update (settings)", async () => {
    const { error } = await admin
      .from("profiles")
      .update({ persona_mode: "autistic" })
      .eq("id", testUserId);
    expect(error).toBeNull();
  });

  it("safety_events (persona-pipeline.ts crisis path)", async () => {
    const { error } = await admin.from("safety_events").insert({
      conversation_id: testConversationId,
      user_id: testUserId,
      crisis_detected: true,
      persona_included_988: true,
    });
    expect(error).toBeNull();
  });

  it("confirm_failures (route observability path)", async () => {
    const { error } = await admin.from("confirm_failures").insert({
      user_id: testUserId,
      message_id: testMessageId,
      conversation_id: testConversationId,
      error_kind: "canary",
      error_detail: "drift canary insert",
      status_code: 500,
      duration_ms: 123,
    });
    expect(error).toBeNull();
  });

  it("beta_feedback (BetaFeedbackButton)", async () => {
    const { error } = await admin.from("beta_feedback").insert({
      user_id: testUserId,
      page_context: "/canary",
      feedback_text: "canary feedback",
    });
    expect(error).toBeNull();
  });
});
