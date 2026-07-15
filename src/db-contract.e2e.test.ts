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
// See docs/reference/checkpoint-hardening-plan.md Track 5.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadConversationContext } from "@/lib/persona/persona-pipeline";

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
    // mode is the conversation's module slug — NOT NULL with no default
    // since the modules cutover (ADR-053), so seeds name one explicitly.
    .insert({ user_id: testUserId, mode: "e2e-test-module" })
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

  it("manual_entries: module-world shape (section slug + strength tag)", async () => {
    // The confirm path since the modules cutover (ADR-053): section is the
    // conversation's module slug, tags are the closed {strength} set. Guards
    // manual_entries_section_format + manual_entries_tags_closed.
    const { error } = await admin.from("manual_entries").insert({
      user_id: testUserId,
      layer: null,
      section: "e2e-test-module",
      tags: ["strength"],
      name: "Module canary",
      content: "Module canary content.",
      summary: "Module canary summary.",
      key_words: ["canary"],
    });
    expect(error).toBeNull();
  });

  it("manual_entries: rejects a tag outside the closed {strength} set", async () => {
    const { error } = await admin.from("manual_entries").insert({
      user_id: testUserId,
      layer: null,
      section: "e2e-test-module",
      tags: ["romantic"], // retired with the fixed sections — CHECK must reject
      name: "Bad tag canary",
      content: "x",
    });
    expect(error).not.toBeNull();
  });

  it("modules (admin/modules route): full admin write shape", async () => {
    // Mirrors the POST insert in src/app/api/admin/modules/route.ts. If this
    // fails, the modules table has drifted from the admin CRUD's shape.
    const { error } = await admin.from("modules").insert({
      slug: "e2e-canary-module",
      name: "E2E canary",
      description: "Canary module.",
      cue: "Begin",
      icon: "chat",
      intro_title: null,
      intro_body: null,
      opener_text: "Canary opener.",
      custom_prompt: null,
      enabled: true,
      sort_order: 99,
      updated_by: testUserId,
    });
    expect(error).toBeNull();
    // Slug format CHECK must reject uppercase/spaces.
    const { error: badSlug } = await admin.from("modules").insert({
      slug: "Bad Slug",
      name: "x",
    });
    expect(badSlug).not.toBeNull();
    await admin.from("modules").delete().eq("slug", "e2e-canary-module");
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

  it("profiles: persona_modes update (settings)", async () => {
    const { error } = await admin
      .from("profiles")
      .update({ persona_modes: ["autistic", "dyslexic"] })
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

// Regression guard for the reflection-meter reset fix (persona-pipeline.ts).
// Only a CONFIRMED checkpoint resets the meter. Pulling an entry plants an
// is_checkpoint row immediately; if the user then DISCARDS or REWORKS it
// ("rejected"/"refined") nothing entered the Manual, so that pull must NOT
// count as "the last checkpoint" — counting it reset turnsSinceCheckpoint and
// moved the reflectionLanded scope past Jove's landed marker, wiping the
// user's progress for a save that never happened.
//
// The fix is a jsonb filter enforced by Postgres, so it can only be tested
// against a real database (a mocked client would just be testing the mock).
// This runs the actual loadConversationContext query path end-to-end.
describe("reflection meter — only confirmed checkpoints reset it", () => {
  let convId: string;

  beforeAll(async () => {
    const { data: conv, error } = await admin
      .from("conversations")
      // mode = module slug; NOT NULL, no default since the modules cutover.
      .insert({ user_id: testUserId, mode: "e2e-test-module" })
      .select("id")
      .single();
    if (error || !conv) {
      throw new Error(`Failed to seed meter-test conversation: ${error?.message}`);
    }
    convId = conv.id;

    // Timeline (explicit created_at so ordering is deterministic):
    //   t1  CONFIRMED checkpoint  — the last real save
    //   t2  user message          — 1st user turn after the save
    //   t3  assistant + landed    — Jove signals a NEW reflection is ready
    //   t4  REJECTED pull         — a later is_checkpoint row, never saved
    //   t5  user message          — 2nd user turn after the save
    const at = (s: number) => `2026-01-01T00:00:0${s}.000Z`;
    const rows = [
      {
        conversation_id: convId,
        role: "assistant",
        content: "confirmed save",
        is_checkpoint: true,
        checkpoint_meta: { name: "saved", status: "confirmed" },
        created_at: at(1),
      },
      {
        conversation_id: convId,
        role: "user",
        content: "first turn after save",
        created_at: at(2),
      },
      {
        conversation_id: convId,
        role: "assistant",
        content: "a new reflection landed",
        metadata: { reflection_landed: true },
        created_at: at(3),
      },
      {
        conversation_id: convId,
        role: "assistant",
        content: "discarded pull",
        is_checkpoint: true,
        checkpoint_meta: { name: "discarded", status: "rejected" },
        created_at: at(4),
      },
      {
        conversation_id: convId,
        role: "user",
        content: "second turn after save",
        created_at: at(5),
      },
    ];
    const { error: insErr } = await admin.from("messages").insert(rows);
    if (insErr) {
      throw new Error(`Failed to seed meter-test messages: ${insErr.message}`);
    }
  });

  it("ignores a rejected pull when computing the last checkpoint", async () => {
    const ctx = await loadConversationContext(admin, convId, testUserId);

    // Anchored to the CONFIRMED save (t1), not the later rejected pull (t4):
    //   both user turns after t1 count → 2 (a regression would count from t4 → 1)
    expect(ctx.turnsSinceCheckpoint).toBe(2);
    //   the landed marker at t3 is after t1, so readiness survives
    //   (a regression scopes past t4 and the marker is lost → false)
    expect(ctx.reflectionLanded).toBe(true);
  });
});
