"use client";

import { Fragment, useMemo, useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";

// ---------------------------------------------------------------------------
// Schema map — staged walkthrough of the database. Modeled on the
// /admin/prompt-architecture page: stepper-driven layers, click-through
// detail, worked-example footer at the end.
//
// Data is hand-curated for now (the schema doesn't change daily and
// migrations are deliberate). When migrations land, update TABLES below.
// ---------------------------------------------------------------------------

type Layer =
  | "spine"
  | "extraction"
  | "identity"
  | "audit"
  | "telemetry"
  | "beta"
  | "deprecated";

interface Column {
  name: string;
  type: string;
  plain: string;
  emphasized?: boolean;
}

interface Connection {
  to: string;
  via: string;
  cardinality: "1:1" | "1:N" | "N:1";
  onDelete: "CASCADE" | "SET NULL" | "RESTRICT" | "—";
  explanation: string;
}

interface Table {
  name: string;
  oneLine: string;
  rowMeans: string;
  description: string;
  columns: Column[];
  connections: Connection[];
  notes?: string;
  deprecated?: boolean;
  layers: Layer[];
}

interface Stage {
  id: number;
  title: string;
  caption: string;
}

const STAGES: Stage[] = [
  {
    id: 1,
    title: "Layer 0 — the whole schema",
    caption:
      "Every table the app touches, grouped by role. Four make up the user-data spine; the rest handle identity, audit, telemetry, and signup. Click any card for its columns, foreign keys, and notes.",
  },
  {
    id: 2,
    title: "Layer 1 — the spine",
    caption:
      "profiles → conversations → messages → manual_entries. The path every user's data travels. Each arrow is a foreign key with a documented on-delete behavior. Everything else in the schema hangs off this trunk.",
  },
  {
    id: 3,
    title: "Layer 2 — extraction state",
    caption:
      "The conversations.extraction_state JSONB column (a flexible JSON field — schema lives inside the value, not the table) is where Jove's working memory lives. The parallel Sonnet call writes it every turn; the next turn's prompt reads it. messages.extraction_snapshot keeps a frozen per-turn copy for replay and debugging.",
  },
  {
    id: 4,
    title: "Layer 3 — identity",
    caption:
      "profiles is the user record. phone_numbers links SMS channels. Both cascade-delete when the underlying auth.users row goes away. The only code path allowed to flip phone_numbers.verified=true is the OTP verify route.",
  },
  {
    id: 5,
    title: "Layer 4 — operational surface",
    caption:
      "Audit trails, error capture, and beta signup. Most are service-role write only with RLS blocking ordinary user reads. Some FKs are deliberately omitted (api_errors hashes user_id; admin_access_logs has no FKs at all) so the audit trail outlives the data it records.",
  },
  {
    id: 6,
    title: "Cascades — what happens when a user is deleted",
    caption:
      "Deleting an auth.users row triggers a chain. Most user-scoped tables CASCADE. A few SET NULL (linq_group_chats becomes ownerless rather than disappearing). admin_access_logs survives by design — audit records have no FK to profiles.",
  },
  {
    id: 7,
    title: "Worked example — schema by the numbers",
    caption:
      "Counts and stats from the current schema: total tables, columns, foreign keys, RLS-protected tables, cascading vs orphaning behaviors. Hand-curated for now; live row counts are a follow-up.",
  },
];

const LAYER_LABEL: Record<Layer, string> = {
  spine: "Spine",
  extraction: "Extraction",
  identity: "Identity",
  audit: "Audit",
  telemetry: "Telemetry",
  beta: "Beta & signup",
  deprecated: "Deprecated",
};

// ---------------------------------------------------------------------------
// TABLES — preserved from the previous schema-map, with new `layers` field.
// ---------------------------------------------------------------------------

const TABLES: Table[] = [
  {
    name: "profiles",
    layers: ["spine", "identity"],
    oneLine: "One row per user. The root of every user-owned chain.",
    rowMeans: "One mywalnut user. The id mirrors Supabase's auth.users.id.",
    description:
      "When someone signs up through Supabase Auth, a corresponding profiles row is created with the same id. Everything user-scoped — conversations, manual entries, phone numbers, modal progress — points back to this row. Deleting a profile cascades through almost every user-owned table.",
    columns: [
      { name: "id", type: "uuid", plain: "Mirrors auth.users.id. The user's unique identifier across the whole app." },
      { name: "display_name", type: "text", plain: "Optional name shown in UI." },
      { name: "persona_modes", type: "text[]", plain: "Which Jove voice modes apply to this user (e.g. ['autistic', 'adhd']). Drives prompt assembly.", emphasized: true },
      { name: "modal_progress", type: "integer", plain: "Onboarding modal step (0-3). Gates which one-time modals fire. The Halfway-there modal fires when this is 1.", emphasized: true },
      { name: "onboarding_completed_at", type: "timestamptz", plain: "When the user finished initial onboarding. Null until completed." },
    ],
    connections: [
      {
        to: "auth.users",
        via: "id",
        cardinality: "1:1",
        onDelete: "CASCADE",
        explanation: "If the underlying Supabase auth user is deleted, the profile goes with it.",
      },
    ],
    notes:
      "Almost everything user-scoped (conversations, manual_entries, phone_numbers, etc.) cascades from this row. Deleting a profile effectively deletes the user's product data.",
  },
  {
    name: "conversations",
    layers: ["spine", "extraction"],
    oneLine: "One row per chat session. Holds the per-turn extraction state.",
    rowMeans:
      "A single conversation session between the user and Jove. Created when the user starts a new chat, lives across many message turns.",
    description:
      "Each conversation accumulates messages and an extraction_state. The extraction_state column is the JSONB blob the background Sonnet call writes every turn — the 21 fields covered in the Extraction consumer map. The summary column is the AI-generated session summary used to orient Jove when the user returns. mode controls which entry path the conversation is on: situation (default), guided-intake, or upload.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique conversation identifier." },
      { name: "user_id", type: "uuid", plain: "Which user owns this conversation.", emphasized: true },
      { name: "status", type: "text", plain: "'active' or 'completed'. Set to completed when the user wraps the session." },
      { name: "summary", type: "text", plain: "AI-generated multi-sentence summary of the session. Read by Jove on the user's next session for context.", emphasized: true },
      { name: "extraction_state", type: "jsonb", plain: "The 21-field blob produced by the extractor every turn. Where Jove's working memory lives. See the Extraction consumer map for the field-by-field breakdown.", emphasized: true },
      { name: "mode", type: "text", plain: "'situation' (default open exploration), 'guided-intake' (directed path), or 'upload' (pasted content). Drives which Tier 3 prompt block loads.", emphasized: true },
      { name: "channel", type: "text", plain: "'web' (default) or 'sms'. Tracks which surface the conversation came through." },
      { name: "linq_group_chat_id", type: "uuid", plain: "Links a group conversation to a linq_group_chats row. Null for normal 1:1 conversations." },
    ],
    connections: [
      {
        to: "profiles",
        via: "user_id",
        cardinality: "N:1",
        onDelete: "CASCADE",
        explanation: "Delete a user, and every conversation they ever had is deleted too.",
      },
      {
        to: "linq_group_chats",
        via: "linq_group_chat_id",
        cardinality: "N:1",
        onDelete: "SET NULL",
        explanation: "If the group chat is deleted, this column becomes null but the conversation row survives.",
      },
    ],
    notes:
      "The extraction_state column is huge in product impact — it's the entire context for Jove's next turn. There's NO row-per-extraction history table; only the current state is kept here (with frozen per-message copies on messages.extraction_snapshot).",
  },
  {
    name: "messages",
    layers: ["spine", "extraction"],
    oneLine: "Every chat turn. User, assistant, and system messages.",
    rowMeans:
      "One message in a conversation. Either the user said something, Jove responded, or the system inserted a marker (e.g. checkpoint confirmation).",
    description:
      "All chat history lives here. Each row knows its role (user/assistant/system) and whether it was a checkpoint moment. When a turn is a checkpoint, is_checkpoint flips to true and checkpoint_meta carries the composed entry preview. extraction_snapshot is a frozen per-message copy of the extraction state at that point — used for debugging and replay.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique message identifier." },
      { name: "conversation_id", type: "uuid", plain: "Which conversation this message belongs to.", emphasized: true },
      { name: "role", type: "text", plain: "'user', 'assistant' (Jove), or 'system' (checkpoint markers).", emphasized: true },
      { name: "content", type: "text", plain: "The actual message text." },
      { name: "is_checkpoint", type: "boolean", plain: "True when Jove proposed a Manual entry this turn.", emphasized: true },
      { name: "checkpoint_meta", type: "jsonb", plain: "When is_checkpoint is true: holds composed_content, composed_name, layer, refinement_count, status (pending/confirmed/rejected/refined).", emphasized: true },
      { name: "extraction_snapshot", type: "jsonb", plain: "Frozen copy of the conversation's extraction state at this turn. Lets you replay history.", emphasized: true },
      { name: "channel", type: "text", plain: "'web' or 'sms'. Tracks the message's origin surface." },
      { name: "metadata", type: "jsonb", plain: "Extensible per-message flags. First use: { chip_response: true } for guided-intake quick-reply taps." },
    ],
    connections: [
      {
        to: "conversations",
        via: "conversation_id",
        cardinality: "N:1",
        onDelete: "CASCADE",
        explanation: "Delete a conversation, and every message in it is deleted.",
      },
    ],
    notes:
      "manual_entries.source_message_id points back here — that's how each Manual entry traces to the specific checkpoint message that proposed it.",
  },
  {
    name: "manual_entries",
    layers: ["spine"],
    oneLine: "The user's confirmed Manual entries. The product output.",
    rowMeans:
      "One confirmed entry on one of the five layers of the user's Manual. Created when the user accepts a checkpoint.",
    description:
      "The Manual itself. Each row is one entry on one layer (1-5). Entries are immutable on insert — there's no upsert, no replacement rule, no per-layer cap. To edit an existing entry, the change is logged in manual_changelog. The summary and key_words columns are the compressed-form data used to keep older entries readable to Jove without re-shipping their full prose every turn.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique entry identifier." },
      { name: "user_id", type: "uuid", plain: "Which user this entry belongs to.", emphasized: true },
      { name: "layer", type: "integer (1-5)", plain: "Which of the five layers this entry sits on. Checked by a CHECK constraint.", emphasized: true },
      { name: "name", type: "text", plain: "The entry's headline (e.g. 'I Freeze When Asked What I Want'). The headline validator we built defends this.", emphasized: true },
      { name: "content", type: "text", plain: "The entry's body — first-person prose, 80+ words, body-anchored.", emphasized: true },
      { name: "source_message_id", type: "uuid", plain: "Points back to the message that proposed this entry. The only FK from manual_entries to messages.", emphasized: true },
      { name: "summary", type: "text", plain: "One-sentence third-person summary used when this entry is compressed into Jove's older-entries context.", emphasized: true },
      { name: "key_words", type: "text[]", plain: "3-6 charged words the user would recognize. Paired with summary in compressed form." },
    ],
    connections: [
      {
        to: "profiles",
        via: "user_id",
        cardinality: "N:1",
        onDelete: "CASCADE",
        explanation: "Delete a user, every Manual entry they confirmed is deleted.",
      },
      {
        to: "messages",
        via: "source_message_id",
        cardinality: "N:1",
        onDelete: "—",
        explanation: "No cascade specified. If the source message is deleted, the entry stays but loses its traceback.",
      },
    ],
    notes:
      "Confirmation is always an INSERT. There is no replace-existing flow today. The manual_changelog table is reserved for explicit edits.",
  },
  {
    name: "manual_changelog",
    layers: ["audit"],
    oneLine: "Audit trail for edits to existing Manual entries.",
    rowMeans:
      "One edit event — when a user changes an existing Manual entry, the before/after content and a change description are logged here.",
    description:
      "Reserved for explicit-edit features. The current product writes new entries via INSERT into manual_entries; existing entries are not edited in production paths. This table exists for the future case when users can sharpen / rewrite existing entries.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique edit identifier." },
      { name: "user_id", type: "uuid", plain: "Which user made the edit.", emphasized: true },
      { name: "component_id", type: "uuid", plain: "The manual_entries.id being edited. Not enforced as a foreign key today.", emphasized: true },
      { name: "layer", type: "integer (1-5)", plain: "Which layer the edited entry sits on." },
      { name: "previous_content", type: "text", plain: "The entry content before the edit." },
      { name: "new_content", type: "text", plain: "The entry content after the edit." },
      { name: "change_description", type: "text", plain: "Plain-English description of what changed." },
      { name: "conversation_id", type: "uuid", plain: "Which conversation the edit happened in. SET NULL if that conversation is deleted." },
    ],
    connections: [
      {
        to: "profiles",
        via: "user_id",
        cardinality: "N:1",
        onDelete: "CASCADE",
        explanation: "Edits go away when the user is deleted.",
      },
      {
        to: "conversations",
        via: "conversation_id",
        cardinality: "N:1",
        onDelete: "SET NULL",
        explanation: "If the conversation is deleted, the edit log survives but loses its conversation link.",
      },
    ],
    notes:
      "Rarely written today. Confirmed in docs/system.md: 'current write paths do not exercise it.'",
  },
  {
    name: "phone_numbers",
    layers: ["identity"],
    oneLine: "Linked phone numbers for SMS-based interaction.",
    rowMeans:
      "One phone number a user has linked for SMS chat. A user can link multiple numbers across services.",
    description:
      "Stores phone numbers users link for SMS access. The verification flow uses verification_code + code_expires_at for OTP. service_type tracks which provider routes for this number (sendblue vs linq). The only code path allowed to set verified=true is the OTP verify route after hash comparison — this is a hard product rule.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique phone-link identifier." },
      { name: "user_id", type: "uuid", plain: "Which user owns this phone number.", emphasized: true },
      { name: "phone", type: "text", plain: "E.164-formatted phone number.", emphasized: true },
      { name: "verified", type: "boolean", plain: "Whether the OTP was verified. Only the /api/user/phone/verify route may set this to true.", emphasized: true },
      { name: "verification_code", type: "text", plain: "Hashed OTP. Cleared after verification." },
      { name: "code_expires_at", type: "timestamptz", plain: "When the OTP expires." },
      { name: "service_type", type: "text", plain: "Which messaging provider routes for this number." },
      { name: "otp_attempts", type: "integer", plain: "Brute-force-protection counter. Capped at OTP_MAX_ATTEMPTS (5). Verify route returns 429 once at cap. Resets on successful verify or fresh OTP send.", emphasized: true },
    ],
    connections: [
      {
        to: "profiles",
        via: "user_id",
        cardinality: "N:1",
        onDelete: "CASCADE",
        explanation: "Phone links go away when the user is deleted.",
      },
    ],
  },
  {
    name: "messaging_events",
    layers: ["telemetry"],
    oneLine: "Audit trail of every outbound send and inbound webhook.",
    rowMeans:
      "One SMS/iMessage event — either an outbound message Jove sent or an inbound webhook event from a provider (Sendblue or Linq).",
    description:
      "Telemetry for debugging send/receive issues across both messaging providers. Inbound rows back the idempotency check (partial unique index on provider + provider_message_id catches Sendblue's retry storms without an in-memory map). Outbound rows track status, error codes, and downgrade events. Designed to outlive user deletion — the FK to profiles is SET NULL so deleted users don't take their event history with them.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique event identifier." },
      { name: "direction", type: "text", plain: "'outbound' (Jove sent) or 'inbound' (provider webhook).", emphasized: true },
      { name: "provider", type: "text", plain: "'linq' or 'sendblue'. Used for cutover monitoring during the Linq → Sendblue migration.", emphasized: true },
      { name: "provider_message_id", type: "text", plain: "Provider-side ID. Backs inbound idempotency via a partial unique index.", emphasized: true },
      { name: "from_number", type: "text", plain: "Sender phone number (E.164)." },
      { name: "to_number", type: "text", plain: "Recipient phone number (E.164)." },
      { name: "content", type: "text", plain: "Message text. Redacted after a retention window per ADR-037." },
      { name: "status", type: "text", plain: "Provider-reported delivery status." },
      { name: "error_code", type: "text", plain: "Provider-reported error code if delivery failed." },
      { name: "error_message", type: "text", plain: "Human-readable error description." },
      { name: "was_downgraded", type: "boolean", plain: "True when iMessage was downgraded to SMS at delivery time." },
      { name: "raw_payload", type: "jsonb", plain: "Full provider payload for forensic debugging." },
      { name: "owner_user_id", type: "uuid", plain: "The mywalnut user this event was for. SET NULL on user delete so the event survives.", emphasized: true },
    ],
    connections: [
      {
        to: "profiles",
        via: "owner_user_id",
        cardinality: "N:1",
        onDelete: "SET NULL",
        explanation:
          "If the user is deleted, the event survives with owner_user_id null. The audit trail outlives the user.",
      },
    ],
    notes:
      "RLS enabled with no public policies — service role writes via the admin client. Same security pattern as safety_events.",
  },
  {
    name: "safety_events",
    layers: ["telemetry"],
    oneLine: "Crisis-language detection log.",
    rowMeans:
      "One row per turn where the crisis detector fired. Records whether Jove appended the 988 resources.",
    description:
      "Whenever crisis language is detected in a user message, a row lands here. crisis_detected is always true (any row implies detection). persona_included_988 tracks whether the LLM response actually mentioned 988, so we can audit cases where the model failed to include it and the appendix added it instead.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique safety-event identifier." },
      { name: "conversation_id", type: "uuid", plain: "Which conversation the event happened in.", emphasized: true },
      { name: "user_id", type: "uuid", plain: "Which user.", emphasized: true },
      { name: "crisis_detected", type: "boolean", plain: "Always true. Any row here means detection fired." },
      { name: "persona_included_988", type: "boolean", plain: "Whether the original LLM response mentioned 988. Audit signal for the safety pipeline.", emphasized: true },
    ],
    connections: [
      {
        to: "conversations",
        via: "conversation_id",
        cardinality: "N:1",
        onDelete: "CASCADE",
        explanation: "If the conversation is deleted, safety events for it are deleted too.",
      },
      {
        to: "profiles",
        via: "user_id",
        cardinality: "N:1",
        onDelete: "CASCADE",
        explanation: "Delete the user, delete the safety events.",
      },
    ],
  },
  {
    name: "monitor_reads",
    layers: ["telemetry"],
    oneLine:
      "Per-turn shadow-monitor alliance reads. Written every turn, read by nothing in the live pipeline.",
    rowMeans:
      "One alliance read from the Phase 0 shadow monitor — produced on a single web turn, capturing how the relationship looked at that moment (bond, task, scope, rupture, direction).",
    description:
      "The persistence side of the shadow monitor — the Opus pre-call that runs alongside extraction on every web turn and reads the alliance, not the topic. The defining fact: this table is written every turn but NOTHING in the live pipeline reads it back. The only readers are out-of-band — admin SQL and the /replay-monitor harness. It's the write target of 'a sensor wired to no actuator': Phase 0 validated that the signal is detectable, but the component that would consume it (the deterministic selector) isn't built. Until it is, these rows change nothing about Jove's behavior. Admin-read-only via RLS; writes flow through the service-role admin client; end users never see it.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique read identifier." },
      { name: "conversation_id", type: "uuid", plain: "Which conversation this read is from. CASCADE on delete.", emphasized: true },
      { name: "user_id", type: "uuid", plain: "Which user. FK to auth.users, CASCADE on delete." },
      { name: "triggering_message_id", type: "uuid", plain: "The user message that triggered the read — nullable, because the monitor fires before Jove's response row exists. SET NULL if that message is deleted." },
      { name: "bond_holding", type: "boolean", plain: "Is the working bond intact this turn.", emphasized: true },
      { name: "task_agreed", type: "boolean", plain: "Are user and Jove aligned on what they're doing." },
      { name: "scope", type: "text", plain: "'in_scope' / 'drifting' / 'out_of_scope'. CHECK-enforced to mirror the TS enum in monitor.ts.", emphasized: true },
      { name: "rupture", type: "text", plain: "'none' / 'withdrawal' / 'confrontation'. The kind of rupture this turn, if any.", emphasized: true },
      { name: "direction", type: "text", plain: "'steadying' / 'drifting' / 'sinking'. The sliding-window slope — the load-bearing signal validated in Phase 0.", emphasized: true },
      { name: "reason", type: "text", plain: "One-sentence justification for the read. Nullable." },
      { name: "model", type: "text", plain: "Which model produced the read (currently Opus — a Phase-0 ceiling test)." },
      { name: "input_tokens", type: "integer", plain: "Read-call input token count." },
      { name: "output_tokens", type: "integer", plain: "Read-call output token count." },
      { name: "latency_ms", type: "integer", plain: "Read-call latency." },
      { name: "turn_index", type: "integer", plain: "Which turn in the conversation this read is for." },
    ],
    connections: [
      {
        to: "conversations",
        via: "conversation_id",
        cardinality: "N:1",
        onDelete: "CASCADE",
        explanation: "Delete a conversation, and its monitor reads go with it.",
      },
      {
        to: "auth.users",
        via: "user_id",
        cardinality: "N:1",
        onDelete: "CASCADE",
        explanation: "Delete the user, delete their monitor reads.",
      },
      {
        to: "messages",
        via: "triggering_message_id",
        cardinality: "N:1",
        onDelete: "SET NULL",
        explanation: "If the triggering message is deleted, the read survives with a null link.",
      },
    ],
    notes:
      "Phase 0 shadow dataset, written from persona-pipeline.ts:411–426 (fireBackgroundMonitor). RLS admin-read-only, no INSERT/UPDATE policy (service-role writes). Indexed for the two real queries: per-conversation timeline and global direction filter. Droppable when Phase 0 concludes — nothing in the pipeline depends on it.",
  },
  {
    name: "linq_group_chats",
    layers: ["deprecated"],
    oneLine: "Group facilitator chat state. Deprecated.",
    rowMeans:
      "One Linq group chat that Jove is participating in as facilitator. Tracks owner, participants, and recency of Jove's involvement.",
    description:
      "Per project memory: Linq is deprecated. This table and the conversation pathway that uses it (linq_group_chat_id on conversations) are slated for removal as 1:1 SMS migrates to Sendblue. No further investment.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique group-chat identifier." },
      { name: "linq_chat_id", type: "text", plain: "External Linq-side chat identifier.", emphasized: true },
      { name: "owner_user_id", type: "uuid", plain: "The mywalnut user who owns this group chat. SET NULL on user delete (group survives).", emphasized: true },
      { name: "is_active", type: "boolean", plain: "Whether Jove is still participating in this chat." },
      { name: "intro_sent", type: "boolean", plain: "Whether Jove has delivered its intro message." },
      { name: "non_persona_participant_count", type: "integer", plain: "Count of non-Jove participants. Drives facilitator behavior." },
      { name: "messages_since_persona_spoke", type: "integer", plain: "How many messages have passed since Jove last spoke. Pacing signal." },
    ],
    connections: [
      {
        to: "profiles",
        via: "owner_user_id",
        cardinality: "N:1",
        onDelete: "SET NULL",
        explanation: "If the owner deletes their account, the group chat survives but becomes ownerless (rare in practice).",
      },
    ],
    deprecated: true,
    notes:
      "Slated for removal. Per project memory: 'Moving away from Linq; no further investment in Linq code.'",
  },
  {
    name: "beta_feedback",
    layers: ["beta"],
    oneLine: "User-submitted feedback during beta.",
    rowMeans:
      "One feedback submission by a beta user. Surfaces in /admin/feedback.",
    description:
      "User feedback collected via in-app forms. is_read tracks whether an admin has reviewed the submission.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique feedback identifier." },
      { name: "user_id", type: "uuid", plain: "Which user submitted." },
      { name: "page_context", type: "text", plain: "Which page they were on when they submitted (e.g. '/manual').", emphasized: true },
      { name: "feedback_text", type: "text", plain: "The actual feedback text." },
      { name: "is_read", type: "boolean", plain: "Admin review flag." },
    ],
    connections: [
      {
        to: "auth.users",
        via: "user_id",
        cardinality: "N:1",
        onDelete: "CASCADE",
        explanation: "Feedback is deleted when the user is deleted.",
      },
    ],
    notes:
      "FK points directly to auth.users (not profiles) — slightly different pattern from the rest of the user-scoped tables.",
  },
  {
    name: "feedback",
    layers: ["beta"],
    oneLine: "Generic in-app feedback widget submissions.",
    rowMeans:
      "One feedback submission. Distinct from beta_feedback; tied to a session via session_id.",
    description:
      "Older feedback table predating beta_feedback. The session_id column references a conversation but is informational — no FK constraint enforced.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique feedback identifier." },
      { name: "user_id", type: "uuid", plain: "Which user submitted." },
      { name: "message", type: "text", plain: "Feedback content." },
      { name: "session_id", type: "uuid", plain: "Informational reference to a conversation. NOT a foreign key — just a UUID column." },
    ],
    connections: [
      {
        to: "auth.users",
        via: "user_id",
        cardinality: "N:1",
        onDelete: "CASCADE",
        explanation: "Feedback is deleted when the user is deleted.",
      },
    ],
  },
  {
    name: "waitlist",
    layers: ["beta"],
    oneLine: "Beta access list — status is the access gate.",
    rowMeans:
      "One person in the beta funnel. Their status IS their access: 'invited' means allowed to sign up / log in.",
    description:
      "Single source of truth for beta access (retired the separate beta_allowlist table). status moves 'waiting' → 'invited' → 'declined'. The signup + OAuth gates (isEmailAllowlisted) read this table WHERE status='invited'. Inviting is a single atomic status flip — no copy/delete between tables. Emails are unique + lowercase (CHECK constraint).",
    columns: [
      { name: "id", type: "uuid", plain: "Unique row identifier." },
      { name: "email", type: "text (unique, lowercased)", plain: "The email." },
      { name: "source", type: "text", plain: "Freeform 'what brought you here' from the public form (null for manual invites)." },
      { name: "status", type: "text", plain: "'waiting', 'invited', or 'declined'. 'invited' === beta access.", emphasized: true },
      { name: "seen", type: "boolean", plain: "Admin has acknowledged this signup (clears the 'new signups' badge). Manual invites land seen=true." },
      { name: "notes", type: "text", plain: "Optional admin note (e.g. on a manual invite)." },
    ],
    connections: [],
  },
  {
    name: "admin_access_logs",
    layers: ["audit"],
    oneLine: "Audit trail for admin actions on user data.",
    rowMeans:
      "One audit entry whenever an admin views or modifies user-scoped data.",
    description:
      "Compliance + safety telemetry. Each row records which admin acted, which user was the target, optionally which conversation, and a freeform action label.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique audit-event identifier." },
      { name: "admin_id", type: "uuid", plain: "The admin user who performed the action.", emphasized: true },
      { name: "target_user_id", type: "uuid", plain: "The user whose data was accessed.", emphasized: true },
      { name: "conversation_id", type: "uuid", plain: "Optional — which conversation was accessed." },
      { name: "action", type: "text", plain: "Freeform action label (e.g. 'view_messages', 'export_manual')." },
    ],
    connections: [],
    notes:
      "No FK constraints on admin_id / target_user_id / conversation_id — just UUID columns. Service-role write only. Survives user deletion by design — audit trail outlives the data.",
  },
  {
    name: "api_errors",
    layers: ["telemetry"],
    oneLine: "Generic API route error capture.",
    rowMeans:
      "One error from any API route that called recordApiError(). Captures the route, method, status, message, and a hashed user ID.",
    description:
      "RLS-on with no policies — service_role write and read only. Important: the user_id is HASHED, not a foreign key. This is deliberate so cross-user error correlation can't leak through accidental row exposure.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique error identifier." },
      { name: "route", type: "text", plain: "Which API route errored (e.g. '/api/chat')." },
      { name: "method", type: "text", plain: "HTTP method." },
      { name: "status_code", type: "integer", plain: "HTTP status code returned." },
      { name: "error_message", type: "text", plain: "Error message." },
      { name: "error_stack", type: "text", plain: "Stack trace for server-side errors." },
      { name: "user_id_hash", type: "text (16-char hex)", plain: "Hashed user identifier. NOT a foreign key — deliberate.", emphasized: true },
      { name: "request_id", type: "text", plain: "Vercel structured-log correlation ID." },
    ],
    connections: [],
    notes:
      "No FK to profiles. The hashing pattern means even if RLS were misconfigured, cross-user correlation would require unhashing.",
  },
  {
    name: "confirm_failures",
    layers: ["telemetry"],
    oneLine: "Checkpoint confirmation failure telemetry.",
    rowMeans:
      "One row per failed checkpoint confirm attempt. Captures the error kind, status code, and duration.",
    description:
      "Service-role-only telemetry table for failures in the /api/checkpoint/confirm path. error_kind classifies the failure (e.g. 'rpc_error', 'not_pending'). message_id and conversation_id are UUID references but not foreign-key-enforced.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique failure-event identifier." },
      { name: "user_id", type: "uuid", plain: "Which user hit the failure.", emphasized: true },
      { name: "message_id", type: "uuid", plain: "The checkpoint message that failed to confirm. Not a foreign key." },
      { name: "conversation_id", type: "uuid", plain: "The conversation. Not a foreign key." },
      { name: "error_kind", type: "text", plain: "Classification (e.g. 'rpc_error', 'checkpoint_not_pending').", emphasized: true },
      { name: "error_detail", type: "text", plain: "Specific error message." },
      { name: "status_code", type: "integer", plain: "HTTP status returned to the client." },
      { name: "duration_ms", type: "integer", plain: "How long the failing attempt took." },
    ],
    connections: [
      {
        to: "profiles",
        via: "user_id",
        cardinality: "N:1",
        onDelete: "CASCADE",
        explanation: "Failure records cascade when the user is deleted.",
      },
    ],
    notes:
      "RLS-on, no policies. message_id and conversation_id are deliberately not FKs to avoid coupling telemetry to the lifetime of the source rows.",
  },
];

const SELECTED_RING = "0 0 0 2px var(--session-walnut-meta)";

// ---------------------------------------------------------------------------
// Selection model
// ---------------------------------------------------------------------------

type Selection =
  | { kind: "table"; name: string };

function selectionKey(s: Selection | null): string | null {
  if (!s) return null;
  return `table:${s.name}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SchemaMapPage() {
  const isAdmin = useIsAdmin();
  const [stageIndex, setStageIndex] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);

  const stage = STAGES[stageIndex];

  // Layers highlighted at each stage. Stage 1 (overview) highlights none —
  // everything is at full opacity. Later stages dim non-active layers.
  const highlightedLayers: Set<Layer> | null = useMemo(() => {
    switch (stage.id) {
      case 2:
        return new Set<Layer>(["spine"]);
      case 3:
        return new Set<Layer>(["extraction"]);
      case 4:
        return new Set<Layer>(["identity"]);
      case 5:
        return new Set<Layer>(["audit", "telemetry", "beta"]);
      case 6:
        return null; // cascade flow renders separately
      default:
        return null; // stage 1 (whole) + stage 7 (worked example) → no dimming
    }
  }, [stage.id]);

  const handleSelect = (next: Selection | null) => {
    setSelection((cur) => {
      const curKey = selectionKey(cur);
      const nextKey = selectionKey(next);
      if (curKey === nextKey) return null;
      return next;
    });
  };

  if (!isAdmin) {
    return (
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          color: "var(--session-ink-ghost)",
          letterSpacing: "1px",
          padding: "80px 24px",
          textAlign: "center",
        }}
      >
        Not authorized.
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--session-linen)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--session-error)",
          textAlign: "center",
          padding: "6px 0",
          borderBottom: "1px solid var(--session-error-ghost)",
          background: "var(--session-error-banner)",
          flexShrink: 0,
        }}
      >
        Read Only — Admin
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <AdminNavRail activeId="schema-map" />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <Header />

          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "1.55fr 1fr",
              gap: 32,
              padding: "28px 32px",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div style={{ overflowY: "auto", paddingRight: 12 }}>
              <Diagram
                stageId={stage.id}
                highlightedLayers={highlightedLayers}
                selection={selection}
                onSelect={handleSelect}
              />
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
                minHeight: 0,
              }}
            >
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  background: "var(--session-linen)",
                  paddingBottom: 16,
                  marginBottom: 16,
                  borderBottom: "1px solid var(--session-ink-hairline)",
                  zIndex: 1,
                }}
              >
                <Stepper
                  stageIndex={stageIndex}
                  setStageIndex={(i) => {
                    setStageIndex(i);
                    setSelection(null);
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {selection ? (
                  <TableDetail
                    table={TABLES.find((t) => t.name === selection.name)!}
                    onClose={() => setSelection(null)}
                  />
                ) : (
                  <StageCaption stage={stage} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header + Stepper
// ---------------------------------------------------------------------------

function Header() {
  return (
    <div
      style={{
        borderBottom: "1px solid var(--session-ink-hairline)",
        padding: "18px 32px",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: "22px",
          fontWeight: 400,
          fontStyle: "italic",
          color: "var(--session-ink)",
          letterSpacing: "-0.005em",
        }}
      >
        Database schema
      </div>
      <p
        style={{
          margin: "8px 0 0",
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: "14.5px",
          lineHeight: 1.55,
          color: "var(--session-ink-soft)",
          maxWidth: 820,
        }}
      >
        The database, walked layer by layer. {TABLES.length} tables across
        public and auth schemas — four make up the user-data spine, the rest
        handle identity, audit trails, telemetry, and signup. Step through to
        see what each layer holds, then click a table for its columns,
        foreign keys, and on-delete behavior.
      </p>
    </div>
  );
}

function Stepper({
  stageIndex,
  setStageIndex,
}: {
  stageIndex: number;
  setStageIndex: (i: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={() => setStageIndex(Math.max(0, stageIndex - 1))}
        disabled={stageIndex === 0}
        aria-label="Previous stage"
        style={arrowBtnStyle(stageIndex === 0)}
      >
        ←
      </button>
      <div
        style={{
          display: "flex",
          gap: 4,
          flex: 1,
          justifyContent: "space-between",
        }}
      >
        {STAGES.map((s, i) => {
          const active = i === stageIndex;
          const visited = i <= stageIndex;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStageIndex(i)}
              aria-label={`Stage ${s.id}: ${s.title}`}
              title={s.title}
              style={{
                all: "unset",
                cursor: "pointer",
                width: 24,
                height: 24,
                borderRadius: 999,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: active
                  ? "var(--session-walnut-highlight)"
                  : visited
                    ? "var(--session-walnut-tint)"
                    : "transparent",
                color: active
                  ? "var(--session-ink)"
                  : visited
                    ? "var(--session-ink-soft)"
                    : "var(--session-ink-ghost)",
                border: `1px solid ${
                  active
                    ? "var(--session-walnut-border)"
                    : "var(--session-walnut-border-soft)"
                }`,
                fontWeight: active ? 500 : 400,
              }}
            >
              {s.id}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setStageIndex(Math.min(STAGES.length - 1, stageIndex + 1))}
        disabled={stageIndex === STAGES.length - 1}
        aria-label="Next stage"
        style={arrowBtnStyle(stageIndex === STAGES.length - 1)}
      >
        →
      </button>
    </div>
  );
}

function arrowBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    all: "unset",
    cursor: disabled ? "default" : "pointer",
    width: 24,
    height: 24,
    borderRadius: 5,
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: disabled ? "var(--session-ink-ghost)" : "var(--session-ink-soft)",
    background: disabled ? "transparent" : "var(--session-walnut-tint)",
    border: `1px solid ${
      disabled
        ? "var(--session-walnut-border-soft)"
        : "var(--session-walnut-border)"
    }`,
    opacity: disabled ? 0.5 : 1,
  };
}

// ---------------------------------------------------------------------------
// Right column — stage caption or table detail
// ---------------------------------------------------------------------------

function StageCaption({ stage }: { stage: Stage }) {
  return (
    <>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "1.5px",
          color: "var(--session-walnut-meta)",
          textTransform: "uppercase",
        }}
      >
        Stage {stage.id}
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 22,
          fontStyle: "italic",
          fontWeight: 400,
          lineHeight: 1.25,
          color: "var(--session-ink)",
        }}
      >
        {stage.title}
      </h2>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 15.5,
          lineHeight: 1.6,
          color: "var(--session-ink-soft)",
        }}
      >
        {stage.caption}
      </p>
      <p
        style={{
          margin: "12px 0 0",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.5px",
          color: "var(--session-ink-ghost)",
          fontStyle: "italic",
        }}
      >
        Click any table card to inspect its columns, foreign keys, and notes.
      </p>
    </>
  );
}

function TableDetail({
  table,
  onClose,
}: {
  table: Table;
  onClose: () => void;
}) {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "1.5px",
            color: "var(--session-walnut-meta)",
            textTransform: "uppercase",
          }}
        >
          {table.layers.map((l) => LAYER_LABEL[l]).join(" · ")}
          {table.deprecated && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                letterSpacing: "1.2px",
                fontWeight: 500,
                padding: "2px 6px",
                borderRadius: 3,
                background: "var(--session-warning-soft)",
                color: "var(--session-warning)",
                border: "1px solid var(--session-warning-soft)",
              }}
            >
              DEPRECATED
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            all: "unset",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.5px",
            color: "var(--session-ink-soft)",
            padding: "4px 10px",
            borderRadius: 5,
            border: "1px solid var(--session-walnut-border-soft)",
            background: "var(--session-walnut-tint)",
          }}
          aria-label="Close detail"
        >
          ← Back to stage
        </button>
      </div>

      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 19,
          fontWeight: 500,
          lineHeight: 1.25,
          color: "var(--session-ink)",
          letterSpacing: "-0.005em",
        }}
      >
        {table.name}
      </h2>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 15,
          fontStyle: "italic",
          lineHeight: 1.5,
          color: "var(--session-ink-soft)",
        }}
      >
        {table.oneLine}
      </p>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 14.5,
          lineHeight: 1.6,
          color: "var(--session-ink-soft)",
        }}
      >
        {table.description}
      </p>

      <DetailSection title="Columns">
        {table.columns.map((c) => (
          <ColumnRow key={c.name} column={c} />
        ))}
      </DetailSection>

      {table.connections.length > 0 && (
        <DetailSection title="Foreign keys">
          {table.connections.map((c) => (
            <ConnectionRow key={`${c.to}-${c.via}`} conn={c} />
          ))}
        </DetailSection>
      )}

      {table.notes && (
        <DetailSection title="Notes">
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--session-ink)",
              fontStyle: "italic",
            }}
          >
            {table.notes}
          </p>
        </DetailSection>
      )}
    </>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginTop: 8,
        paddingTop: 12,
        borderTop: "1px solid var(--session-walnut-border-soft)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "1px",
          textTransform: "uppercase",
          color: "var(--session-ink-ghost)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function ColumnRow({ column }: { column: Column }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        background: column.emphasized
          ? "var(--session-walnut-surface-soft)"
          : "var(--session-walnut-tint)",
        border: `1px solid ${
          column.emphasized
            ? "var(--session-walnut-border)"
            : "var(--session-walnut-border-soft)"
        }`,
        borderRadius: 5,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 2,
        }}
      >
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            color: "var(--session-ink)",
            fontWeight: column.emphasized ? 500 : 400,
          }}
        >
          {column.name}
        </code>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--session-ink-ghost)",
          }}
        >
          {column.type}
        </span>
      </div>
      <div
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 13,
          lineHeight: 1.45,
          color: "var(--session-ink-soft)",
        }}
      >
        {column.plain}
      </div>
    </div>
  );
}

function ConnectionRow({ conn }: { conn: Connection }) {
  const onDeleteColor: Record<Connection["onDelete"], string> = {
    CASCADE: "var(--session-error)",
    "SET NULL": "var(--session-warning)",
    RESTRICT: "var(--session-ink)",
    "—": "var(--session-ink-ghost)",
  };
  return (
    <div
      style={{
        padding: "8px 10px",
        background: "var(--session-walnut-tint)",
        border: "1px solid var(--session-walnut-border-soft)",
        borderRadius: 5,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            color: "var(--session-ink)",
          }}
        >
          → {conn.to} <span style={{ color: "var(--session-ink-ghost)" }}>via {conn.via}</span>
        </code>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.5px",
            color: onDeleteColor[conn.onDelete],
            textTransform: "uppercase",
          }}
        >
          {conn.cardinality} · ON DELETE {conn.onDelete}
        </span>
      </div>
      <div
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 13,
          lineHeight: 1.45,
          color: "var(--session-ink-soft)",
        }}
      >
        {conn.explanation}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reading guide — vocabulary primer for non-tech readers. Visible on every
// stage so the technical names below (CASCADE, FK, JSONB…) have a glossary
// the reader can glance at without leaving the page.
// ---------------------------------------------------------------------------

const READING_GUIDE: { term: string; def: string }[] = [
  { term: "Table", def: "Structured rows. Think spreadsheet." },
  { term: "Column", def: "A field in a table, with a type (text, integer, jsonb…)." },
  { term: "Foreign key (FK)", def: "A link from one table to another." },
  { term: "CASCADE", def: "When the parent is deleted, this row goes with it." },
  { term: "SET NULL", def: "Parent deleted, link becomes empty but row survives." },
  { term: "JSONB", def: "A flexible JSON column. Schema lives inside the value, not the table." },
  { term: "RLS", def: "Row-level security. The database enforces who can read which rows." },
];

function ReadingGuide() {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 8,
        background: "var(--session-walnut-tint)",
        border: "1px dashed var(--session-walnut-border-soft)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "1.5px",
          color: "var(--session-walnut-meta)",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Reading guide
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          columnGap: 14,
          rowGap: 4,
        }}
      >
        {READING_GUIDE.map((g) => (
          <Fragment key={g.term}>
            <code
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                color: "var(--session-ink)",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              {g.term}
            </code>
            <span
              style={{
                fontFamily: "var(--font-spectral, var(--font-serif))",
                fontSize: 12.5,
                color: "var(--session-ink-soft)",
                lineHeight: 1.4,
              }}
            >
              {g.def}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diagram
// ---------------------------------------------------------------------------

function Diagram({
  stageId,
  highlightedLayers,
  selection,
  onSelect,
}: {
  stageId: number;
  highlightedLayers: Set<Layer> | null;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  if (stageId === 6) {
    return (
      <>
        <ReadingGuide />
        <CascadeDiagram selection={selection} onSelect={onSelect} />
      </>
    );
  }
  if (stageId === 7) {
    return (
      <>
        <ReadingGuide />
        <WorkedExampleFooter />
      </>
    );
  }

  // Filter tables: for stage 3, only spine tables + extraction-tagged ones
  // are shown (focus on extraction). For stages 2/4/5, show all but dim the
  // ones outside the highlighted layer set.
  const focusedView = stageId === 3;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <ReadingGuide />
      {focusedView && (
        <ExtractionFocusPanel selection={selection} onSelect={onSelect} />
      )}

      <SpineRow
        highlightedLayers={highlightedLayers}
        selection={selection}
        onSelect={onSelect}
      />

      {!focusedView && (
        <AdjacentGrid
          highlightedLayers={highlightedLayers}
          selection={selection}
          onSelect={onSelect}
        />
      )}

      {!focusedView && (
        <DeprecatedRow
          highlightedLayers={highlightedLayers}
          selection={selection}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spine row — profiles → conversations → messages → manual_entries
// ---------------------------------------------------------------------------

function SpineRow({
  highlightedLayers,
  selection,
  onSelect,
}: {
  highlightedLayers: Set<Layer> | null;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  const spineNames = ["profiles", "conversations", "messages", "manual_entries"];
  const spineTables = spineNames
    .map((n) => TABLES.find((t) => t.name === n))
    .filter((t): t is Table => !!t);

  const isHighlighted =
    !highlightedLayers ||
    highlightedLayers.has("spine") ||
    highlightedLayers.has("extraction");

  return (
    <div
      style={{
        opacity: isHighlighted ? 1 : 0.35,
        transition: "opacity 220ms ease",
        padding: 14,
        borderRadius: 10,
        background: isHighlighted
          ? "var(--session-walnut-surface-soft)"
          : "var(--session-walnut-tint)",
        border: `1px solid ${
          isHighlighted
            ? "var(--session-walnut-border)"
            : "var(--session-walnut-border-soft)"
        }`,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "1.5px",
          color: "var(--session-walnut-meta-strong)",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        The spine — user-data path
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr)",
          alignItems: "stretch",
          gap: 8,
        }}
      >
        {spineTables.flatMap((t, idx) => {
          const arr: React.ReactNode[] = [
            <TableCard
              key={t.name}
              table={t}
              dimmed={false}
              selected={selection?.kind === "table" && selection.name === t.name}
              onClick={() => onSelect({ kind: "table", name: t.name })}
              size="medium"
            />,
          ];
          if (idx < spineTables.length - 1) {
            arr.push(
              <span
                key={`arrow-${idx}`}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  color: "var(--session-walnut-meta)",
                  textAlign: "center",
                }}
              >
                →
              </span>,
            );
          }
          return arr;
        })}
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 12,
          fontStyle: "italic",
          color: "var(--session-ink-ghost)",
        }}
      >
        Each arrow is a foreign key. All four cascade-delete from a user.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Adjacent grid — identity / audit / telemetry / beta
// ---------------------------------------------------------------------------

function AdjacentGrid({
  highlightedLayers,
  selection,
  onSelect,
}: {
  highlightedLayers: Set<Layer> | null;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  const groups: { layer: Layer; tables: Table[] }[] = [
    { layer: "identity", tables: TABLES.filter((t) => t.layers.includes("identity") && !t.layers.includes("spine")) },
    { layer: "audit", tables: TABLES.filter((t) => t.layers.includes("audit")) },
    { layer: "telemetry", tables: TABLES.filter((t) => t.layers.includes("telemetry")) },
    { layer: "beta", tables: TABLES.filter((t) => t.layers.includes("beta")) },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 10,
      }}
    >
      {groups.map((g) => {
        const isHighlighted =
          !highlightedLayers || highlightedLayers.has(g.layer);
        return (
          <div
            key={g.layer}
            style={{
              opacity: isHighlighted ? 1 : 0.3,
              transition: "opacity 220ms ease",
              padding: 12,
              borderRadius: 8,
              background: isHighlighted
                ? "var(--session-walnut-tint)"
                : "transparent",
              border: `1px solid ${
                isHighlighted
                  ? "var(--session-walnut-border-soft)"
                  : "var(--session-walnut-border-soft)"
              }`,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                letterSpacing: "1.5px",
                color: "var(--session-walnut-meta)",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              {LAYER_LABEL[g.layer]}
              <span
                style={{
                  marginLeft: 6,
                  color: "var(--session-ink-ghost)",
                  fontWeight: 400,
                }}
              >
                {g.tables.length}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {g.tables.map((t) => (
                <TableCard
                  key={t.name}
                  table={t}
                  dimmed={false}
                  selected={
                    selection?.kind === "table" && selection.name === t.name
                  }
                  onClick={() => onSelect({ kind: "table", name: t.name })}
                  size="small"
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deprecated row
// ---------------------------------------------------------------------------

function DeprecatedRow({
  highlightedLayers,
  selection,
  onSelect,
}: {
  highlightedLayers: Set<Layer> | null;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  const deprecated = TABLES.filter((t) => t.layers.includes("deprecated"));
  if (deprecated.length === 0) return null;
  // Highlighted when no specific layers are active (stage 1) or when
  // "deprecated" is explicitly in the highlighted set (not the current case).
  const isHighlighted = !highlightedLayers;
  return (
    <div
      style={{
        opacity: isHighlighted ? 0.7 : 0.3,
        transition: "opacity 220ms ease",
        padding: 12,
        borderRadius: 8,
        background: "var(--session-walnut-tint)",
        border: "1px dashed var(--session-walnut-border-soft)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "1.5px",
          color: "var(--session-walnut-meta)",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Deprecated
        <span
          style={{
            marginLeft: 6,
            color: "var(--session-ink-ghost)",
            fontWeight: 400,
          }}
        >
          {deprecated.length}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {deprecated.map((t) => (
          <TableCard
            key={t.name}
            table={t}
            dimmed={false}
            selected={selection?.kind === "table" && selection.name === t.name}
            onClick={() => onSelect({ kind: "table", name: t.name })}
            size="small"
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table card — small / medium / large clickable cell
// ---------------------------------------------------------------------------

function TableCard({
  table,
  selected,
  onClick,
  size,
}: {
  table: Table;
  dimmed: boolean;
  selected: boolean;
  onClick: () => void;
  size: "small" | "medium" | "large";
}) {
  const padding =
    size === "large" ? "12px 14px" : size === "medium" ? "10px 12px" : "8px 10px";
  const titleSize = size === "large" ? 14.5 : size === "medium" ? 13.5 : 12.5;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "block",
        padding,
        background: table.deprecated
          ? "var(--session-warning-soft)"
          : "var(--session-walnut-surface-soft)",
        border: `1px solid ${
          table.deprecated
            ? "var(--session-warning-soft)"
            : "var(--session-walnut-border)"
        }`,
        borderRadius: 6,
        boxShadow: selected ? SELECTED_RING : "none",
        transition: "box-shadow 120ms ease",
        boxSizing: "border-box",
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: titleSize,
            fontWeight: 500,
            color: table.deprecated
              ? "var(--session-warning)"
              : "var(--session-ink)",
            textDecoration: table.deprecated ? "line-through" : "none",
          }}
        >
          {table.name}
        </code>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--session-ink-ghost)",
            whiteSpace: "nowrap",
          }}
        >
          {table.columns.length} cols · {table.connections.length} FK
        </span>
      </div>
      {size !== "small" && (
        <div
          style={{
            marginTop: 4,
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: 12,
            fontStyle: "italic",
            color: "var(--session-ink-soft)",
            lineHeight: 1.35,
          }}
        >
          {table.oneLine}
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Stage 3 — Extraction focus panel
// ---------------------------------------------------------------------------

function ExtractionFocusPanel({
  selection,
  onSelect,
}: {
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 10,
        background: "var(--session-walnut-tint)",
        border: "1px solid var(--session-walnut-border)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "1.5px",
          color: "var(--session-walnut-meta-strong)",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        Where Jove’s working memory lives
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "var(--session-walnut-surface-soft)",
            border: "1px solid var(--session-walnut-border)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.5px",
              color: "var(--session-walnut-meta)",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Live state — written every turn
          </div>
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--session-ink)",
              fontWeight: 500,
              display: "block",
              marginBottom: 4,
            }}
          >
            conversations.extraction_state
          </code>
          <div
            style={{
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: 12.5,
              lineHeight: 1.45,
              color: "var(--session-ink-soft)",
              fontStyle: "italic",
            }}
          >
            JSONB column. The background Sonnet extraction call writes here every turn. The 21 fields drive the next turn’s prompt assembly. See the Extraction consumer map for the field-by-field breakdown.
          </div>
        </div>
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "var(--session-walnut-surface-soft)",
            border: "1px solid var(--session-walnut-border)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.5px",
              color: "var(--session-walnut-meta)",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Frozen snapshot — per message
          </div>
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--session-ink)",
              fontWeight: 500,
              display: "block",
              marginBottom: 4,
            }}
          >
            messages.extraction_snapshot
          </code>
          <div
            style={{
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: 12.5,
              lineHeight: 1.45,
              color: "var(--session-ink-soft)",
              fontStyle: "italic",
            }}
          >
            JSONB column. A copy of the extraction state at the moment each message was sent — used for replay and debugging. Lets you reconstruct what Jove was thinking at any past turn.
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--session-ink-soft)",
          fontStyle: "italic",
        }}
      >
        Both live on tables you’ve already met — conversations and messages. Click either card below to see the column layout in detail.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginTop: 10,
        }}
      >
        {["conversations", "messages"].map((name) => {
          const t = TABLES.find((x) => x.name === name)!;
          return (
            <TableCard
              key={t.name}
              table={t}
              dimmed={false}
              selected={selection?.kind === "table" && selection.name === t.name}
              onClick={() => onSelect({ kind: "table", name: t.name })}
              size="medium"
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage 6 — Cascade diagram
// ---------------------------------------------------------------------------

function CascadeDiagram({
  selection,
  onSelect,
}: {
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  // Compute cascade chain from auth.users → profiles → everything that
  // cascades from it. Group by behavior so the contrast is visible.
  const fromProfiles: { table: Table; conn: Connection }[] = [];
  for (const t of TABLES) {
    for (const c of t.connections) {
      if (c.to === "profiles" || c.to === "auth.users") {
        fromProfiles.push({ table: t, conn: c });
      }
    }
  }
  const cascading = fromProfiles.filter((x) => x.conn.onDelete === "CASCADE");
  const setNull = fromProfiles.filter((x) => x.conn.onDelete === "SET NULL");
  const surviving = TABLES.filter(
    (t) =>
      t.connections.every(
        (c) => c.to !== "profiles" && c.to !== "auth.users",
      ) && !t.layers.includes("spine"),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          padding: 14,
          borderRadius: 10,
          background: "var(--session-walnut-surface-soft)",
          border: "1px solid var(--session-walnut-border)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "1.5px",
            color: "var(--session-walnut-meta-strong)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Trigger
        </div>
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            color: "var(--session-ink)",
            fontWeight: 500,
          }}
        >
          DELETE FROM auth.users WHERE id = $1
        </code>
        <div
          style={{
            marginTop: 6,
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: 13,
            fontStyle: "italic",
            color: "var(--session-ink-soft)",
          }}
        >
          The profile cascades from auth.users. Then everything below cascades from the profile.
        </div>
      </div>

      <CascadeGroup
        title={`Cascading — ${cascading.length} tables`}
        subtitle="Row deleted with the user."
        accent="var(--session-error)"
        accentBg="var(--session-error-ghost)"
        items={cascading}
        selection={selection}
        onSelect={onSelect}
      />

      <CascadeGroup
        title={`Set null — ${setNull.length} table${setNull.length === 1 ? "" : "s"}`}
        subtitle="Row survives, FK becomes null."
        accent="var(--session-warning)"
        accentBg="var(--session-warning-soft)"
        items={setNull}
        selection={selection}
        onSelect={onSelect}
      />

      <div
        style={{
          padding: 14,
          borderRadius: 10,
          background: "var(--session-walnut-tint)",
          border: "1px solid var(--session-walnut-border-soft)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "1.5px",
              color: "var(--session-walnut-meta-strong)",
              textTransform: "uppercase",
            }}
          >
            Outliving the user — {surviving.length} tables
          </div>
        </div>
        <div
          style={{
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: 13,
            fontStyle: "italic",
            color: "var(--session-ink-soft)",
            marginBottom: 10,
            lineHeight: 1.45,
          }}
        >
          Tables with no FK to profiles or auth.users — audit and telemetry rows that survive user deletion by design. admin_access_logs in particular is meant to outlast the data it records.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {surviving.map((t) => (
            <TableCard
              key={t.name}
              table={t}
              dimmed={false}
              selected={selection?.kind === "table" && selection.name === t.name}
              onClick={() => onSelect({ kind: "table", name: t.name })}
              size="small"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CascadeGroup({
  title,
  subtitle,
  accent,
  accentBg,
  items,
  selection,
  onSelect,
}: {
  title: string;
  subtitle: string;
  accent: string;
  accentBg: string;
  items: { table: Table; conn: Connection }[];
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        background: accentBg,
        border: `1px solid ${accent}`,
        borderColor: accent,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "1.5px",
            color: accent,
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 13,
          fontStyle: "italic",
          color: "var(--session-ink-soft)",
          marginBottom: 10,
          lineHeight: 1.45,
        }}
      >
        {subtitle}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map(({ table, conn }) => (
          <button
            key={`${table.name}-${conn.via}`}
            type="button"
            onClick={() => onSelect({ kind: "table", name: table.name })}
            style={{
              all: "unset",
              cursor: "pointer",
              padding: "6px 10px",
              background: "var(--session-walnut-tint)",
              border: "1px solid var(--session-walnut-border-soft)",
              borderRadius: 5,
              boxShadow:
                selection?.kind === "table" && selection.name === table.name
                  ? SELECTED_RING
                  : "none",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <code
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                color: "var(--session-ink)",
                fontWeight: 500,
              }}
            >
              {table.name}
            </code>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                color: "var(--session-ink-ghost)",
                letterSpacing: "0.5px",
              }}
            >
              via {conn.via}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage 7 — Worked example footer
// ---------------------------------------------------------------------------

function WorkedExampleFooter() {
  const totalTables = TABLES.length;
  const totalColumns = TABLES.reduce((s, t) => s + t.columns.length, 0);
  const totalFKs = TABLES.reduce((s, t) => s + t.connections.length, 0);
  const cascading = TABLES.reduce(
    (s, t) => s + t.connections.filter((c) => c.onDelete === "CASCADE").length,
    0,
  );
  const settingNull = TABLES.reduce(
    (s, t) => s + t.connections.filter((c) => c.onDelete === "SET NULL").length,
    0,
  );
  const deprecated = TABLES.filter((t) => t.deprecated).length;
  const layerCounts: { layer: Layer; count: number }[] = (
    [
      { layer: "spine" as Layer, count: TABLES.filter((t) => t.layers.includes("spine")).length },
      { layer: "identity" as Layer, count: TABLES.filter((t) => t.layers.includes("identity") && !t.layers.includes("spine")).length },
      { layer: "audit" as Layer, count: TABLES.filter((t) => t.layers.includes("audit")).length },
      { layer: "telemetry" as Layer, count: TABLES.filter((t) => t.layers.includes("telemetry")).length },
      { layer: "beta" as Layer, count: TABLES.filter((t) => t.layers.includes("beta")).length },
      { layer: "deprecated" as Layer, count: TABLES.filter((t) => t.layers.includes("deprecated")).length },
    ]
  ).filter((x) => x.count > 0);

  const layerColors: Record<Layer, string> = {
    spine: "var(--session-walnut-surface)",
    extraction: "var(--session-walnut-highlight)",
    identity: "var(--session-walnut-surface-soft)",
    audit: "var(--session-walnut-tint)",
    telemetry: "var(--session-persona-muted)",
    beta: "var(--session-warning-soft)",
    deprecated: "var(--session-warning-soft)",
  };

  return (
    <div
      style={{
        padding: 18,
        borderRadius: 12,
        border: "1px solid var(--session-walnut-border)",
        background: "var(--session-walnut-tint)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "1.5px",
          color: "var(--session-walnut-meta-strong)",
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        Schema by the numbers
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <HeroStat value={totalTables} label="Tables" />
        <HeroStat value={totalColumns} label="Columns" />
        <HeroStat value={totalFKs} label="Foreign keys" />
        <HeroStat value={cascading} label="Cascading FKs" />
        <HeroStat value={settingNull} label="Set-null FKs" />
        <HeroStat value={deprecated} label="Deprecated" />
      </div>

      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "1px",
          color: "var(--session-walnut-meta)",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        Tables by layer
      </div>
      <div
        style={{
          display: "flex",
          height: 12,
          borderRadius: 4,
          overflow: "hidden",
          border: "1px solid var(--session-walnut-border-soft)",
          marginBottom: 8,
        }}
      >
        {layerCounts.map((l) => (
          <div
            key={l.layer}
            style={{
              flexGrow: l.count,
              background: layerColors[l.layer],
              minWidth: 0,
            }}
            title={`${LAYER_LABEL[l.layer]}: ${l.count}`}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {layerCounts.map((l) => (
          <div
            key={l.layer}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--session-ink-soft)",
              letterSpacing: "0.5px",
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                background: layerColors[l.layer],
                border: "1px solid var(--session-walnut-border-soft)",
                display: "inline-block",
              }}
            />
            {LAYER_LABEL[l.layer]}
            <span style={{ color: "var(--session-ink-ghost)" }}>{l.count}</span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 12.5,
          fontStyle: "italic",
          color: "var(--session-ink-ghost)",
          lineHeight: 1.5,
        }}
      >
        Hand-curated for now. A follow-up will introspect information_schema
        for live counts (real columns, real FKs, real RLS policies) plus add
        row counts for the current admin user.
      </div>
    </div>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 36,
          fontStyle: "italic",
          fontWeight: 400,
          lineHeight: 1,
          color: "var(--session-ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 4,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "1px",
          color: "var(--session-ink-ghost)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}
