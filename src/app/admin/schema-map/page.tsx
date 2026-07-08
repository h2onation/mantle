"use client";

import { Fragment, useMemo, useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";

// ---------------------------------------------------------------------------
// Schema map — "follow one user's words."
//
// The database is one short spine: each user (profiles) has chats
// (conversations), each chat has messages, and a few confirmed messages
// become Manual entries. Everything else — phone links, audit logs,
// telemetry, beta signups — hangs off the side of that spine, watching or
// guarding the path the words travel.
//
// The page is organized around that frame: a front door, a lifecycle
// walkthrough (the spine → the working memory → the watchers → who can see
// what → what survives a delete → the numbers), and a table-by-table map.
//
// Data is hand-curated (the schema doesn't change daily; migrations are
// deliberate). When migrations land, update TABLES below.
// ---------------------------------------------------------------------------

// Fine-grained role each table plays. Drives the satellite grouping + the
// "tables by family" bar. (Renamed from "Layer" to avoid colliding with the
// product's five Manual Layers.)
type Family =
  | "spine"
  | "extraction"
  | "identity"
  | "audit"
  | "telemetry"
  | "beta"
  | "config"
  | "deprecated";

// Who can read a table's rows — the security posture.
type Access = "user" | "backend" | "signup";

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
  families: Family[];
  access: Access;
  notes?: string;
  deprecated?: boolean;
}

interface Step {
  id: number;
  title: string;
  caption: string;
}

const STEPS: Step[] = [
  {
    id: 1,
    title: "The spine",
    caption:
      "Follow one user's words. They sign up (a profiles row), they start a chat (a conversations row), every turn is stored (a messages row), and a few confirmed turns graduate into their Manual (manual_entries). That four-table path is the product. Each arrow is a foreign key; all four delete together when the user is deleted. Everything else in the database hangs off this spine.",
  },
  {
    id: 2,
    title: "The working memory",
    caption:
      "Riding on each conversation is one JSONB blob — extraction_state — that the background call rewrites every turn so Jove remembers between turns. It's JSONB (a flexible JSON field) rather than columns because its shape is owned by the app's code and changes with the prompt; pinning it to columns would mean a migration per field. messages.extraction_snapshot keeps a frozen per-turn copy for replay.",
  },
  {
    id: 3,
    title: "The watchers",
    caption:
      "Off the spine sit the satellite tables — they record, route, or guard the path but never sit on it. Identity (phone links), audit (who did what), telemetry (sends, errors, safety), and beta signup. Most are never on the live user flow; several are write-only or dead weight.",
  },
  {
    id: 4,
    title: "Who can see what",
    caption:
      "Every table with user data has row-level security (RLS) on. Two patterns: tables a user can read their own rows from (scoped to their login), and backend-only tables no user can read at all (only the server and admins). A couple go further — api_errors stores a hashed user id, not a real link, and only the OTP verify route may ever flip phone_numbers.verified to true.",
  },
  {
    id: 5,
    title: "What survives a delete",
    caption:
      "When a user is deleted, a chain fires. Most user-scoped tables CASCADE (the rows go too). A few SET NULL — the row survives but forgets who it belonged to. And the audit/telemetry tables are deliberately wired to outlive the user they describe, so the record of what happened can't be erased by deleting an account.",
  },
  {
    id: 6,
    title: "By the numbers",
    caption:
      "The whole schema at a glance — tables, columns, foreign keys, and how many cascade vs. survive a delete. Hand-curated for now (live row counts are a follow-up). Use it to spot dead weight: tables nothing reads, or kept only until a later migration drops them.",
  },
];

const FAMILY_LABEL: Record<Family, string> = {
  spine: "Spine",
  extraction: "Working memory",
  identity: "Identity",
  audit: "Audit",
  telemetry: "Telemetry",
  beta: "Beta & signup",
  config: "Admin config",
  deprecated: "Deprecated",
};

const ACCESS_LABEL: Record<Access, string> = {
  user: "User-readable",
  backend: "Backend-only",
  signup: "Signup gate",
};

// spine / satellite / deprecated — the top-level tag shown on cards + detail.
type GroupTag = "spine" | "satellite" | "deprecated";

function groupTag(t: Table): GroupTag {
  if (t.deprecated) return "deprecated";
  if (t.families.includes("spine")) return "spine";
  return "satellite";
}

function tagTone(tag: GroupTag): { bg: string; fg: string; border: string; label: string } {
  switch (tag) {
    case "spine":
      return {
        bg: "var(--session-persona-tint)",
        fg: "var(--session-persona)",
        border: "var(--session-persona-border)",
        label: "spine",
      };
    case "satellite":
      return {
        bg: "var(--session-walnut-tint)",
        fg: "var(--session-walnut-meta-strong)",
        border: "var(--session-walnut-border)",
        label: "satellite",
      };
    case "deprecated":
      return {
        bg: "var(--session-warning-soft)",
        fg: "var(--session-warning)",
        border: "var(--session-warning)",
        label: "deprecated",
      };
  }
}

// ---------------------------------------------------------------------------
// TABLES — every table in the public schema, hand-mapped to track the
// migrations. The columns + foreign keys are real; verify against
// supabase/migrations/ when the schema changes.
// ---------------------------------------------------------------------------

const TABLES: Table[] = [
  {
    name: "profiles",
    families: ["spine", "identity"],
    access: "user",
    oneLine: "One row per user. The root of every user-owned chain.",
    rowMeans: "One mywalnut user. The id mirrors Supabase's auth.users.id.",
    description:
      "When someone signs up through Supabase Auth, a matching profiles row is created with the same id. Everything user-scoped — conversations, manual entries, phone numbers — points back to this row. Deleting a profile cascades through almost every user-owned table.",
    columns: [
      { name: "id", type: "uuid", plain: "Mirrors auth.users.id. The user's unique identifier across the whole app." },
      { name: "display_name", type: "text", plain: "Optional name shown in UI." },
      { name: "persona_modes", type: "text[]", plain: "Which Jove voice modes apply to this user (e.g. ['autistic', 'adhd']). Drives prompt assembly. Default is ['general']; 'general' is exclusive.", emphasized: true },
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
    families: ["spine", "extraction"],
    access: "user",
    oneLine: "One row per chat session. Holds the per-turn working memory.",
    rowMeans:
      "A single conversation session between the user and Jove. Created when the user starts a new chat, lives across many message turns.",
    description:
      "Each conversation accumulates messages and a working-memory blob. extraction_state is the JSONB the background call rewrites every turn — see the Extraction map for the field-by-field breakdown. summary is the AI-generated session recap used to orient Jove when the user returns. mode controls which entry path the conversation is on: situation (default), guided-intake, or upload.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique conversation identifier." },
      { name: "user_id", type: "uuid", plain: "Which user owns this conversation.", emphasized: true },
      { name: "status", type: "text", plain: "'active' or 'completed'. Set to completed when the user wraps the session." },
      { name: "summary", type: "text", plain: "AI-generated multi-sentence summary of the session. Read by Jove on the user's next session for context.", emphasized: true },
      { name: "extraction_state", type: "jsonb", plain: "The case file the extractor rewrites every turn — where Jove's working memory lives. Mapped field-by-field in the Extraction map.", emphasized: true },
      { name: "mode", type: "text", plain: "'situation' (default open exploration), 'guided-intake' (directed path), or 'upload' (pasted content). Drives which prompt block loads.", emphasized: true },
      { name: "channel", type: "text", plain: "'web' (default) or 'sms'. Tracks which surface the conversation came through." },
      { name: "processing_sms", type: "boolean", plain: "True while an SMS turn is mid-flight. Guards against double-processing concurrent inbound texts." },
      { name: "calibration_ratings", type: "text", plain: "Dead column — never read or written. Documented in system.md as safe to ignore. Left in place, not yet dropped.", emphasized: true },
      { name: "linq_group_chat_id", type: "uuid", plain: "Links a group conversation to a (deprecated) linq_group_chats row. Null for normal 1:1 conversations." },
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
        explanation: "If the (deprecated) group chat is deleted, this column becomes null but the conversation row survives.",
      },
    ],
    notes:
      "extraction_state is huge in product impact — it's the entire context for Jove's next turn. There's NO row-per-extraction history table; only the current state is kept here, with frozen per-message copies on messages.extraction_snapshot.",
  },
  {
    name: "messages",
    families: ["spine", "extraction"],
    access: "user",
    oneLine: "Every chat turn. User, assistant, and system messages.",
    rowMeans:
      "One message in a conversation. Either the user said something, Jove responded, or the system inserted a marker (e.g. checkpoint confirmation).",
    description:
      "All chat history lives here. Each row knows its role (user/assistant/system) and whether it was a checkpoint moment. When a turn is a checkpoint, is_checkpoint flips true and checkpoint_meta carries the composed entry preview. extraction_snapshot is a frozen per-message copy of the working memory at that point — used for debugging and replay.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique message identifier." },
      { name: "conversation_id", type: "uuid", plain: "Which conversation this message belongs to.", emphasized: true },
      { name: "role", type: "text", plain: "'user', 'assistant' (Jove), or 'system' (checkpoint markers).", emphasized: true },
      { name: "content", type: "text", plain: "The actual message text." },
      { name: "is_checkpoint", type: "boolean", plain: "True on the system message written when the user pulled and confirmed/rejected an entry (capture is user-pulled; Jove never proposes).", emphasized: true },
      { name: "checkpoint_meta", type: "jsonb", plain: "When is_checkpoint is true: composed_content, composed_name, layer, refinement_count, status (pending/confirmed/rejected/refined).", emphasized: true },
      { name: "extraction_snapshot", type: "jsonb", plain: "Frozen copy of the conversation's working memory at this turn. Lets you replay history.", emphasized: true },
      { name: "metadata", type: "jsonb", plain: "Extensible per-message flags. Carries the checkpoint-suppressed marker, guided-intake chip taps, etc." },
      { name: "channel", type: "text", plain: "'web' or 'sms'. Tracks the message's origin surface." },
      { name: "processing_text", type: "text", plain: "Legacy column — transient 'thinking…' text. Still selected by the admin message viewer." },
      { name: "sender_phone", type: "text", plain: "Legacy column — the phone number an SMS message came from." },
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
    families: ["spine"],
    access: "user",
    oneLine: "The user's confirmed Manual entries. The product output.",
    rowMeans:
      "One confirmed entry homed on one of the five life-area sections of the user's Manual. Created when the user accepts a checkpoint.",
    description:
      "The Manual itself. Each row is one entry on one of the five sections — composition always assigns one. Entries are inserted, never replaced — there's no upsert, no per-section cap. summary and key_words are the compressed-form data that keeps older entries readable to Jove without re-shipping their full prose every turn.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique entry identifier." },
      { name: "user_id", type: "uuid", plain: "Which user this entry belongs to.", emphasized: true },
      { name: "section", type: "text, nullable", plain: "Life-area home — the live structural key. Closed set: relationships, work-money, routines-structure, sensory-burnout, interests-flow. Composition always assigns one (column stays nullable for frozen legacy provenance). CHECK-constrained.", emphasized: true },
      { name: "tags", type: "text[] (default '{}')", plain: "Closed cross-cutting tag set: 'strength' on any section; 'romantic'/'family'/'friends' only when section='relationships'. NOT NULL, defaults to empty.", emphasized: true },
      { name: "layer", type: "integer, nullable", plain: "FROZEN legacy pattern-type id. Was the structural key; now provenance only (nullable). New rows are born with a section and a NULL layer.", emphasized: false },
      { name: "name", type: "text", plain: "The entry's headline (e.g. 'I Freeze When Asked What I Want').", emphasized: true },
      { name: "content", type: "text", plain: "The entry's body — first-person prose, 80+ words, body-anchored.", emphasized: true },
      { name: "source_message_id", type: "uuid", plain: "Points back to the message the entry was saved from (the turn where the user pulled it).", emphasized: true },
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
      "Confirmation is always an INSERT. There is no replace-existing flow today.",
  },
  {
    name: "phone_numbers",
    families: ["identity"],
    access: "user",
    oneLine: "Linked phone number for SMS-based interaction. One per user.",
    rowMeans:
      "The phone number a user has linked for SMS chat, plus its OTP verification state. One row per user (enforced by a unique constraint).",
    description:
      "Stores the phone number a user links for SMS access. The verification flow uses otp_code + otp_expires_at. service_type tracks which provider routes for this number. The only code path allowed to set verified=true is the OTP verify route after hash comparison — a hard product rule. A UNIQUE(user_id) constraint means one linked number per user.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique phone-link identifier." },
      { name: "user_id", type: "uuid", plain: "Which user owns this phone number. UNIQUE — one row per user.", emphasized: true },
      { name: "phone", type: "text", plain: "E.164-formatted phone number (the international '+countrycode…' format).", emphasized: true },
      { name: "verified", type: "boolean", plain: "Whether the OTP was verified. Only the /api/user/phone/verify route may set this to true.", emphasized: true },
      { name: "otp_code", type: "text", plain: "Hashed one-time passcode. Cleared after verification. (Renamed from verification_code.)" },
      { name: "otp_expires_at", type: "timestamptz", plain: "When the one-time passcode expires. (Renamed from code_expires_at.)" },
      { name: "service_type", type: "text", plain: "Which messaging provider routes for this number." },
      { name: "otp_attempts", type: "integer", plain: "Brute-force-protection counter. Capped at OTP_MAX_ATTEMPTS (5). Verify route returns 429 at cap. Resets on successful verify or fresh OTP send.", emphasized: true },
      { name: "linked_at", type: "timestamptz", plain: "When the number was first linked." },
      { name: "linq_chat_id", type: "text", plain: "Per-phone Linq chat pointer. Dead with the Linq deprecation — still a live column." },
    ],
    connections: [
      {
        to: "profiles",
        via: "user_id",
        cardinality: "1:1",
        onDelete: "CASCADE",
        explanation: "Phone link goes away when the user is deleted.",
      },
    ],
    notes:
      "UNIQUE(user_id) was added so a user can't accumulate multiple linked numbers. OTP columns were renamed from verification_code / code_expires_at to otp_code / otp_expires_at.",
  },
  {
    name: "messaging_events",
    families: ["telemetry"],
    access: "backend",
    oneLine: "Audit trail of every outbound send and inbound webhook.",
    rowMeans:
      "One SMS/iMessage event — either an outbound message Jove sent or an inbound webhook event from a provider (Sendblue or Linq).",
    description:
      "Telemetry for debugging send/receive issues across both messaging providers. Inbound rows back the idempotency check (a partial unique index on provider + provider_message_id catches retry storms without an in-memory map). Outbound rows track status, error codes, and downgrade events. Designed to outlive user deletion — the FK to profiles is SET NULL.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique event identifier." },
      { name: "direction", type: "text", plain: "'outbound' (Jove sent) or 'inbound' (provider webhook).", emphasized: true },
      { name: "provider", type: "text", plain: "'linq' or 'sendblue'. Used for cutover monitoring during the Linq → Sendblue migration.", emphasized: true },
      { name: "provider_message_id", type: "text", plain: "Provider-side ID. Backs inbound idempotency via a partial unique index.", emphasized: true },
      { name: "from_number", type: "text", plain: "Sender phone number (E.164)." },
      { name: "to_number", type: "text", plain: "Recipient phone number (E.164)." },
      { name: "content", type: "text", plain: "Message text. Redacted after a retention window." },
      { name: "status", type: "text", plain: "Provider-reported delivery status." },
      { name: "delivered_at", type: "timestamptz", plain: "When the provider confirmed delivery. Backs the Sendblue delivery-latency check.", emphasized: true },
      { name: "error_code", type: "text", plain: "Provider-reported error code if delivery failed." },
      { name: "error_message", type: "text", plain: "Provider-reported error detail if delivery failed." },
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
      "RLS enabled with no public policies — only the service-role backend writes; admins read via is_admin(). Same security pattern as safety_events.",
  },
  {
    name: "safety_events",
    families: ["telemetry"],
    access: "backend",
    oneLine: "Crisis-language detection log.",
    rowMeans:
      "One row per turn where the crisis detector fired. Records whether Jove appended the 988 resources.",
    description:
      "Whenever crisis language is detected in a user message, a row lands here. crisis_detected is always true (any row implies detection). persona_included_988 tracks whether the model's response actually mentioned 988, so we can audit cases where the model failed to include it and the appendix added it instead.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique safety-event identifier." },
      { name: "conversation_id", type: "uuid", plain: "Which conversation the event happened in.", emphasized: true },
      { name: "user_id", type: "uuid", plain: "Which user.", emphasized: true },
      { name: "crisis_detected", type: "boolean", plain: "Always true. Any row here means detection fired." },
      { name: "persona_included_988", type: "boolean", plain: "Whether the original response mentioned 988. Audit signal for the safety pipeline.", emphasized: true },
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
    notes: "RLS-on, no public policies — service-role writes, admins read.",
  },
  {
    name: "linq_group_chats",
    families: ["deprecated"],
    access: "backend",
    oneLine: "Group facilitator chat state. Deprecated.",
    rowMeans:
      "One Linq group chat that Jove participated in as facilitator. Tracks owner, participants, and recency of Jove's involvement.",
    description:
      "Per project memory, Linq is deprecated. This table and the conversation pathway that uses it (linq_group_chat_id on conversations) are slated for removal as 1:1 SMS migrates to Sendblue. No further investment.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique group-chat identifier." },
      { name: "linq_chat_id", type: "text", plain: "External Linq-side chat identifier.", emphasized: true },
      { name: "owner_user_id", type: "uuid", plain: "The mywalnut user who owns this group chat. SET NULL on user delete (group survives).", emphasized: true },
      { name: "is_active", type: "boolean", plain: "Whether Jove is still participating in this chat." },
      { name: "non_persona_participant_count", type: "integer", plain: "Count of non-Jove participants. Drives facilitator behavior." },
      { name: "messages_since_persona_spoke", type: "integer", plain: "How many messages since Jove last spoke. Pacing signal." },
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
      "Slated for removal. Per project memory: 'Moving away from Linq; no further investment in Linq code.' Columns abbreviated — the live table also carries intro_sent, intro_sent_at, last_inactive_reminder_at, and last_persona_spoke_at (pacing/reminder state), not enumerated here because the table is dead.",
  },
  {
    name: "beta_feedback",
    families: ["beta"],
    access: "user",
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
    families: ["beta"],
    access: "user",
    oneLine: "Older generic feedback widget. Predates beta_feedback.",
    rowMeans:
      "One feedback submission. Distinct from beta_feedback; tied to a session via session_id.",
    description:
      "Older feedback table predating beta_feedback. session_id references a conversation but is informational — no FK constraint enforced.",
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
    families: ["beta"],
    access: "signup",
    oneLine: "Beta access list — status is the access gate.",
    rowMeans:
      "One person in the beta funnel. Their status IS their access: 'invited' means allowed to sign up / log in.",
    description:
      "Single source of truth for beta access (it replaced the separate beta_allowlist table). status moves 'waiting' → 'invited' → 'declined'. The signup + OAuth gates read this table WHERE status='invited'. Inviting is a single atomic status flip — no copy/delete between tables. Emails are unique + lowercase (CHECK constraint). Anon inserts are locked down — signups flow through /api/waitlist with the service-role client.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique row identifier." },
      { name: "email", type: "text (unique, lowercased)", plain: "The email." },
      { name: "source", type: "text", plain: "Freeform 'what brought you here' from the public form (null for manual invites)." },
      { name: "status", type: "text", plain: "'waiting', 'invited', or 'declined'. 'invited' === beta access.", emphasized: true },
      { name: "seen", type: "boolean", plain: "Admin has acknowledged this signup (clears the 'new signups' badge). Manual invites land seen=true." },
      { name: "invited_at", type: "timestamptz", plain: "When the status flipped to 'invited'. Null for rows invited before this column existed.", emphasized: true },
      { name: "notes", type: "text", plain: "Optional admin note (e.g. on a manual invite)." },
    ],
    connections: [],
    notes:
      "No FK — a waitlist row exists before any auth user does. The anon-insert hole was closed; only the backend writes here now.",
  },
  {
    name: "beta_allowlist",
    families: ["deprecated"],
    access: "signup",
    oneLine: "Retired beta access list. Dead — kept until prod login is verified.",
    rowMeans:
      "An email that was once allowed into beta. No longer consulted by anything.",
    description:
      "The old beta-access table, replaced by waitlist.status='invited' in the beta-access unification. No code references it anymore. RLS is on with no policies. It's deliberately left in place — to be dropped in a later migration once production login is fully verified — so it's a live, empty-of-purpose table, not a clean part of the schema.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique row identifier." },
      { name: "email", type: "text", plain: "The allowlisted email (lowercased, CHECK-enforced)." },
      { name: "notes", type: "text", plain: "Optional admin note." },
      { name: "created_at", type: "timestamptz", plain: "When the row was added." },
    ],
    connections: [],
    deprecated: true,
    notes:
      "Dead leftover. Superseded by waitlist (see unify_beta_access migration). Slated to be dropped once prod login is verified — until then it's a real table the schema still carries.",
  },
  {
    name: "admin_access_logs",
    families: ["audit"],
    access: "backend",
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
      "No FK constraints on admin_id / target_user_id / conversation_id — just UUID columns. Service-role write only. Survives user deletion by design — the audit trail outlives the data it records.",
  },
  {
    name: "api_errors",
    families: ["telemetry"],
    access: "backend",
    oneLine: "Generic API route error capture.",
    rowMeans:
      "One error from any API route that called recordApiError(). Captures the route, method, status, message, and a hashed user ID.",
    description:
      "RLS-on with no policies — service-role write and read only. Important: the user_id is HASHED, not a foreign key. That's deliberate, so cross-user error correlation can't leak through accidental row exposure.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique error identifier." },
      { name: "route", type: "text", plain: "Which API route errored (e.g. '/api/chat')." },
      { name: "method", type: "text", plain: "HTTP method." },
      { name: "status_code", type: "integer", plain: "HTTP status code returned." },
      { name: "error_message", type: "text", plain: "Error message." },
      { name: "error_stack", type: "text", plain: "Captured stack trace for the error." },
      { name: "user_id_hash", type: "text (16-char hex)", plain: "Hashed user identifier. NOT a foreign key — deliberate, so users can't be correlated across rows.", emphasized: true },
      { name: "request_id", type: "text", plain: "Structured-log correlation ID." },
    ],
    connections: [],
    notes:
      "No FK to profiles. The hashing means even if RLS were misconfigured, cross-user correlation would require unhashing.",
  },
  {
    name: "confirm_failures",
    families: ["telemetry"],
    access: "backend",
    oneLine: "Checkpoint-confirm failure telemetry.",
    rowMeans:
      "One row per failed checkpoint confirm attempt. Captures the error kind, status code, and duration.",
    description:
      "Service-role-only telemetry for failures in the /api/checkpoint/confirm path. error_kind classifies the failure. message_id and conversation_id are UUID references but not foreign-key-enforced.",
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
      "RLS-on, no policies. message_id and conversation_id are deliberately not FKs, to avoid coupling telemetry to the lifetime of the source rows.",
  },
  {
    name: "feature_gates",
    families: ["config"],
    access: "backend",
    oneLine: "Global on/off switches for ancillary Jove subsystems.",
    rowMeans:
      "One feature gate — a named subsystem an admin can disable at runtime. Four live keys: situation / guided_intake / upload (each hides its home-screen door) and extraction_brief (turns the per-message extraction call off — voice-only mode). (The persona_deltas gate was removed 2026-07-08 — a dead switch the conductor never read.)",
    description:
      "Holds NO user data — global app config, four seeded rows, all defaulting ON. The door gates are read by /api/onboarding-status (Home door state); extraction_brief is read once per turn inside loadConversationContext (folded into its existing parallel DB batch — no extra round-trip). Written only via /api/admin/feature-gates. Debug scaffolding, not a permanent fork: the stated deletion condition is once the doors are permanent and the extraction loop is settled, drop the table and its read sites.",
    columns: [
      { name: "key", type: "text (PK)", plain: "Gate name: situation, guided_intake, upload, or extraction_brief.", emphasized: true },
      { name: "enabled", type: "boolean", plain: "Whether the subsystem is on. Default true.", emphasized: true },
      { name: "updated_at", type: "timestamptz", plain: "When the gate was last toggled." },
    ],
    connections: [],
    notes:
      "RLS enabled with NO policies — deny-all to anon/auth clients; server access is service-role only (bypasses RLS). Same convention as persona_voice_overrides.",
  },
  {
    name: "persona_voice_overrides",
    families: ["config"],
    access: "backend",
    oneLine: "Admin-editable replacements for a fixed set of voice-text fields.",
    rowMeans:
      "One overridden voice field (the whole conductor prompt, the two openers, the post-confirm line, the composer's entry bar) — live-tunable from admin without a deploy. A field is overridden only when its row exists AND is enabled.",
    description:
      "Holds NO user data — global app config, a handful of rows, none seeded (absence of a row = use the code default). The code constants stay the permanent floor. Read once per turn inside loadConversationContext (folded into its parallel DB batch), written only via /api/admin/persona-voice. 'Reset to default' sets enabled=false (non-destructive). The conductor_prompt key (Jove's whole prompt, edited on the Tuning page) is save-guarded: an edit that drops the crisis lines or the hidden UI markers is rejected. The CRISIS_PHRASES pipeline detector, the composer's entry schema, and OTP caps stay code-only.",
    columns: [
      { name: "key", type: "text (PK)", plain: "Which voice field is overridden.", emphasized: true },
      { name: "text_override", type: "text", plain: "The admin-supplied replacement text." },
      { name: "enabled", type: "boolean", plain: "Whether the override is live. Default false.", emphasized: true },
      { name: "updated_at", type: "timestamptz", plain: "When the override was last saved." },
      { name: "updated_by", type: "uuid", plain: "Admin user id who saved it. No FK — id only, per the log-ids-not-content rule." },
    ],
    connections: [],
    notes:
      "RLS enabled with NO policies — service-role only. Paired with persona_voice_override_history (append-only audit of edits).",
  },
  {
    name: "persona_voice_override_history",
    families: ["config", "audit"],
    access: "backend",
    oneLine: "Append-only audit of voice-override edits.",
    rowMeans:
      "One edit to a persona_voice_overrides field — old text, new text, who, when. For 'who changed what when' and rollback by eye.",
    description:
      "Append-only history backing persona_voice_overrides. old_text is null on the first edit of a key. No FK on updated_by (admin user id only). Indexed on (key, created_at desc).",
    columns: [
      { name: "id", type: "uuid (PK)", plain: "Unique history-row identifier." },
      { name: "key", type: "text", plain: "Which voice field was edited.", emphasized: true },
      { name: "old_text", type: "text", plain: "Prior text. Null on the first edit of a key." },
      { name: "new_text", type: "text", plain: "The new text saved." },
      { name: "updated_by", type: "uuid", plain: "Admin user id who made the edit. No FK." },
      { name: "created_at", type: "timestamptz", plain: "When the edit was made." },
    ],
    connections: [],
    notes: "RLS enabled with NO policies — service-role only.",
  },
];

const SELECTED_RING = "0 0 0 2px var(--session-walnut-meta)";

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

type Selection = { kind: "table"; name: string };

function selectionKey(s: Selection | null): string | null {
  if (!s) return null;
  return `table:${s.name}`;
}

// Which families the diagram spotlights at each step. null = no spotlight.
function spotlightForStep(stepId: number): Set<Family> | null {
  switch (stepId) {
    case 1:
      return new Set<Family>(["spine"]);
    case 2:
      return new Set<Family>(["spine", "extraction"]);
    case 3:
      return new Set<Family>(["identity", "audit", "telemetry", "beta"]);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SchemaMapPage() {
  const isAdmin = useIsAdmin();
  const [stepIndex, setStepIndex] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);

  const step = STEPS[stepIndex];
  const spotlight = useMemo(() => spotlightForStep(step.id), [step.id]);

  const handleSelect = (next: Selection | null) => {
    setSelection((cur) => {
      const curKey = selectionKey(cur);
      const nextKey = selectionKey(next);
      if (curKey === nextKey) return null;
      return next;
    });
  };

  const jumpToStep = (i: number) => {
    setStepIndex(i);
    setSelection(null);
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
              <FrontDoor onJump={jumpToStep} />
              <div style={{ height: 12 }} />
              <GlossaryBox />
              <div style={{ height: 18 }} />
              <Diagram
                stepId={step.id}
                spotlight={spotlight}
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
                <Stepper stepIndex={stepIndex} setStepIndex={jumpToStep} />
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
                  <StepCaption step={step} />
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
// Header
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
        Where a user&rsquo;s data lives
      </div>
      <p
        style={{
          margin: "8px 0 0",
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: "14.5px",
          lineHeight: 1.55,
          color: "var(--session-ink-soft)",
          maxWidth: 880,
        }}
      >
        Every table in mywalnut&rsquo;s database ({TABLES.length} of them),
        hand-mapped — what each one holds, who can see it, and what happens when
        a user is deleted. Follow one user&rsquo;s words from signup to a Manual
        entry; everything else watches or guards that path.
      </p>
      <a
        href="/admin/extraction-map"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginTop: 10,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.3px",
          color: "var(--session-walnut-meta-strong)",
          textDecoration: "none",
        }}
      >
        ↳ The <code style={{ fontFamily: "var(--font-mono)" }}>extraction_state</code>{" "}
        blob is mapped field-by-field in the Extraction map →
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Front door — "follow one user's words," open by default.
// ---------------------------------------------------------------------------

function FrontDoor({ onJump }: { onJump: (i: number) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid var(--session-walnut-border)",
        background: "var(--session-walnut-surface-soft)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          width: "100%",
          boxSizing: "border-box",
          padding: "14px 16px",
        }}
        aria-expanded={open}
      >
        <span
          style={{
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: 16,
            fontStyle: "italic",
            color: "var(--session-ink)",
          }}
        >
          Follow one user&rsquo;s words
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "var(--session-ink-ghost)",
          }}
        >
          {open ? "hide ▲" : "what is this? ▼"}
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          <p
            style={{
              margin: "0 0 14px",
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "var(--session-ink-soft)",
            }}
          >
            The whole database is one short path the user&rsquo;s words travel,
            plus the tables that watch or guard it.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <FrontDoorCard
              tag="spine"
              title="The spine"
              body="The four tables a user's words travel through: their profile → each chat → every message → the entries that land in their Manual."
              onJump={() => onJump(0)}
            />
            <FrontDoorCard
              tag="spine"
              title="The working memory"
              body="One JSONB blob on each conversation (extraction_state) the background call rewrites every turn, so Jove remembers between turns."
              onJump={() => onJump(1)}
              accent="persona"
            />
            <FrontDoorCard
              tag="satellite"
              title="Everything else"
              body="Phone links, audit logs, telemetry, beta signups — tables that watch or guard the path but never sit on it. Plus who can see what, and what survives a delete."
              onJump={() => onJump(2)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FrontDoorCard({
  tag,
  title,
  body,
  onJump,
  accent,
}: {
  tag: GroupTag;
  title: string;
  body: string;
  onJump: () => void;
  accent?: "persona";
}) {
  const tone = tagTone(tag);
  const border = accent === "persona" ? "var(--session-persona-border)" : tone.border;
  const bg = accent === "persona" ? "var(--session-persona-tint)" : tone.bg;
  return (
    <div
      style={{
        padding: "11px 13px",
        borderRadius: 8,
        border: `1px solid ${border}`,
        background: bg,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--session-ink)",
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 12.5,
          lineHeight: 1.5,
          color: "var(--session-ink-soft)",
        }}
      >
        {body}
      </div>
      <JumpButton label="Show it below ↓" onClick={onJump} />
    </div>
  );
}

function JumpButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        marginTop: 8,
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        letterSpacing: "0.5px",
        color: "var(--session-walnut-meta-strong)",
        borderBottom: "1px solid var(--session-walnut-border)",
        paddingBottom: 1,
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Glossary — collapsed by default; schema jargon one click away.
// ---------------------------------------------------------------------------

const GLOSSARY: { term: string; def: string }[] = [
  { term: "Table", def: "Structured rows. Think spreadsheet." },
  { term: "Column", def: "A field in a table, with a type (text, integer, jsonb…)." },
  { term: "Foreign key (FK)", def: "A link from one table to another." },
  { term: "CASCADE", def: "When the parent is deleted, this row goes with it." },
  { term: "SET NULL", def: "Parent deleted, the link goes empty but the row survives." },
  { term: "JSONB", def: "A flexible JSON column. Schema lives inside the value, not the table." },
  { term: "RLS", def: "Row-level security. The database enforces who can read which rows." },
  { term: "auth.users", def: "Supabase's hidden login table. Our profiles table mirrors its id." },
];

function GlossaryBox() {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        borderRadius: 8,
        border: "1px dashed var(--session-walnut-border-soft)",
        background: "var(--session-walnut-tint)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          boxSizing: "border-box",
          padding: "9px 14px",
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: "var(--session-walnut-meta)",
        }}
        aria-expanded={open}
      >
        <span>Plain-English glossary</span>
        <span style={{ color: "var(--session-ink-ghost)" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div
          style={{
            padding: "0 14px 12px",
            display: "grid",
            gridTemplateColumns: "max-content 1fr",
            columnGap: 14,
            rowGap: 4,
          }}
        >
          {GLOSSARY.map((g) => (
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
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

function Stepper({
  stepIndex,
  setStepIndex,
}: {
  stepIndex: number;
  setStepIndex: (i: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
        disabled={stepIndex === 0}
        aria-label="Previous step"
        style={arrowBtnStyle(stepIndex === 0)}
      >
        ←
      </button>
      <div style={{ display: "flex", gap: 4, flex: 1, justifyContent: "space-between" }}>
        {STEPS.map((s, i) => {
          const active = i === stepIndex;
          const visited = i <= stepIndex;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStepIndex(i)}
              aria-label={`Step ${s.id}: ${s.title}`}
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
                  active ? "var(--session-walnut-border)" : "var(--session-walnut-border-soft)"
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
        onClick={() => setStepIndex(Math.min(STEPS.length - 1, stepIndex + 1))}
        disabled={stepIndex === STEPS.length - 1}
        aria-label="Next step"
        style={arrowBtnStyle(stepIndex === STEPS.length - 1)}
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
      disabled ? "var(--session-walnut-border-soft)" : "var(--session-walnut-border)"
    }`,
    opacity: disabled ? 0.5 : 1,
  };
}

// ---------------------------------------------------------------------------
// Right column — step caption or table detail
// ---------------------------------------------------------------------------

function StepCaption({ step }: { step: Step }) {
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
        Step {step.id} of {STEPS.length}
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
        {step.title}
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
        {step.caption}
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
        Click any table on the left for what it holds, its links, and what breaks if you remove it.
      </p>
    </>
  );
}

function GroupTagPill({ tag }: { tag: GroupTag }) {
  const tone = tagTone(tag);
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9.5,
        letterSpacing: "1.2px",
        fontWeight: 500,
        textTransform: "uppercase",
        padding: "2px 7px",
        borderRadius: 3,
        background: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.border}`,
      }}
    >
      {tone.label}
    </span>
  );
}

function TableDetail({ table, onClose }: { table: Table; onClose: () => void }) {
  const tag = groupTag(table);
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <GroupTagPill tag={tag} />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              color: "var(--session-ink-ghost)",
            }}
          >
            {ACCESS_LABEL[table.access]}
          </span>
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
          ← Back to step
        </button>
      </div>

      <code
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 18,
          fontWeight: 500,
          color: "var(--session-ink)",
          wordBreak: "break-word",
        }}
      >
        {table.name}
      </code>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 15,
          lineHeight: 1.6,
          color: "var(--session-ink)",
        }}
      >
        {table.description}
      </p>

      {table.notes && (
        <DetailSection title="Notes">
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--session-ink-soft)",
              fontStyle: "italic",
            }}
          >
            {table.notes}
          </p>
        </DetailSection>
      )}

      <DetailSection title="Columns">
        {table.columns.map((c) => (
          <ColumnRow key={c.name} column={c} />
        ))}
      </DetailSection>

      {table.connections.length > 0 && (
        <DetailSection title="Foreign keys (links to other tables)">
          {table.connections.map((c) => (
            <ConnectionRow key={`${c.to}-${c.via}`} conn={c} />
          ))}
        </DetailSection>
      )}
    </>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
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
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
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
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--session-ink-ghost)" }}>
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
        <code style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--session-ink)" }}>
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
          ON DELETE {conn.onDelete}
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
// Diagram — routes per step.
// ---------------------------------------------------------------------------

function Diagram({
  stepId,
  spotlight,
  selection,
  onSelect,
}: {
  stepId: number;
  spotlight: Set<Family> | null;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  if (stepId === 4) {
    return <RlsLens selection={selection} onSelect={onSelect} />;
  }
  if (stepId === 5) {
    return <CascadeDiagram selection={selection} onSelect={onSelect} />;
  }
  if (stepId === 6) {
    return <WorkedExampleFooter />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {stepId === 2 && <ExtractionFocusPanel selection={selection} onSelect={onSelect} />}
      <SpineRow spotlight={spotlight} selection={selection} onSelect={onSelect} />
      <AdjacentGrid spotlight={spotlight} selection={selection} onSelect={onSelect} />
      <DeprecatedRow spotlight={spotlight} selection={selection} onSelect={onSelect} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spine row — profiles → conversations → messages → manual_entries
// ---------------------------------------------------------------------------

function SpineRow({
  spotlight,
  selection,
  onSelect,
}: {
  spotlight: Set<Family> | null;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  const spineNames = ["profiles", "conversations", "messages", "manual_entries"];
  const spineTables = spineNames
    .map((n) => TABLES.find((t) => t.name === n))
    .filter((t): t is Table => !!t);

  const lit = !spotlight || spotlight.has("spine") || spotlight.has("extraction");

  return (
    <div
      style={{
        opacity: lit ? 1 : 0.32,
        transition: "opacity 220ms ease",
        padding: 14,
        borderRadius: 10,
        background: lit ? "var(--session-persona-tint)" : "var(--session-walnut-tint)",
        border: `1px solid ${lit ? "var(--session-persona-border)" : "var(--session-walnut-border-soft)"}`,
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
        The spine — the path the words travel
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
                  alignSelf: "center",
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
        Each arrow is a foreign key. All four cascade-delete from the user.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Adjacent grid — the watchers (identity / audit / telemetry / beta)
// ---------------------------------------------------------------------------

function AdjacentGrid({
  spotlight,
  selection,
  onSelect,
}: {
  spotlight: Set<Family> | null;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  const groups: { family: Family; tables: Table[] }[] = [
    { family: "identity", tables: TABLES.filter((t) => t.families.includes("identity") && !t.families.includes("spine")) },
    { family: "audit", tables: TABLES.filter((t) => t.families.includes("audit")) },
    { family: "telemetry", tables: TABLES.filter((t) => t.families.includes("telemetry")) },
    { family: "beta", tables: TABLES.filter((t) => t.families.includes("beta")) },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
      {groups.map((g) => {
        const lit = !spotlight || spotlight.has(g.family);
        return (
          <div
            key={g.family}
            style={{
              opacity: lit ? 1 : 0.3,
              transition: "opacity 220ms ease",
              padding: 12,
              borderRadius: 8,
              background: lit ? "var(--session-walnut-tint)" : "transparent",
              border: "1px solid var(--session-walnut-border-soft)",
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
              {FAMILY_LABEL[g.family]}
              <span style={{ marginLeft: 6, color: "var(--session-ink-ghost)", fontWeight: 400 }}>
                {g.tables.length}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {g.tables.map((t) => (
                <TableCard
                  key={t.name}
                  table={t}
                  selected={selection?.kind === "table" && selection.name === t.name}
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

function DeprecatedRow({
  spotlight,
  selection,
  onSelect,
}: {
  spotlight: Set<Family> | null;
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  const deprecated = TABLES.filter((t) => t.deprecated);
  if (deprecated.length === 0) return null;
  // Dead-by-nature — show at a steady muted opacity regardless of the step,
  // but lift slightly when the watchers (its neighbors) are spotlighted.
  const lit = !spotlight || spotlight.has("beta") || spotlight.has("telemetry");
  return (
    <div
      style={{
        opacity: lit ? 0.85 : 0.55,
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
        Deprecated / dead
        <span style={{ marginLeft: 6, color: "var(--session-ink-ghost)", fontWeight: 400 }}>
          {deprecated.length}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {deprecated.map((t) => (
          <TableCard
            key={t.name}
            table={t}
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
// Table card
// ---------------------------------------------------------------------------

function TableCard({
  table,
  selected,
  onClick,
  size,
}: {
  table: Table;
  selected: boolean;
  onClick: () => void;
  size: "small" | "medium" | "large";
}) {
  const padding = size === "large" ? "12px 14px" : size === "medium" ? "10px 12px" : "8px 10px";
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
          table.deprecated ? "var(--session-warning)" : "var(--session-walnut-border)"
        }`,
        borderRadius: 6,
        boxShadow: selected ? SELECTED_RING : "none",
        transition: "box-shadow 120ms ease",
        boxSizing: "border-box",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: titleSize,
            fontWeight: 500,
            color: table.deprecated ? "var(--session-warning)" : "var(--session-ink)",
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
// Step 2 — working memory focus panel
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
        Where Jove&rsquo;s working memory lives
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
            JSONB column. The background extraction call rewrites it every turn; the next turn&rsquo;s prompt reads it.
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
            JSONB column. A copy of that state at the moment each message was sent — used to replay what Jove was working from at any past turn.
          </div>
        </div>
      </div>

      <a
        href="/admin/extraction-map"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginTop: 14,
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          letterSpacing: "0.3px",
          color: "var(--session-walnut-meta-strong)",
          textDecoration: "none",
          padding: "6px 11px",
          borderRadius: 6,
          border: "1px solid var(--session-walnut-border)",
          background: "var(--session-walnut-surface-soft)",
        }}
      >
        Deep dive — every field in this blob → the Extraction map
      </a>

      <div
        style={{
          marginTop: 12,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--session-ink-soft)",
          fontStyle: "italic",
        }}
      >
        Both live on tables you&rsquo;ve already met — conversations and messages. Click either below for the column layout.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        {["conversations", "messages"].map((name) => {
          const t = TABLES.find((x) => x.name === name)!;
          return (
            <TableCard
              key={t.name}
              table={t}
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
// Step 4 — who can see what (RLS lens)
// ---------------------------------------------------------------------------

function RlsLens({
  selection,
  onSelect,
}: {
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
  const groups: { access: Access; subtitle: string }[] = [
    { access: "user", subtitle: "RLS scoped to the logged-in user — a user sees only their own rows (or their own conversation's rows). Admins read via is_admin()." },
    { access: "backend", subtitle: "RLS on with no user policy — no end user can read these at all. Only the service-role backend writes; admins read via is_admin(). Audit, telemetry, errors." },
    { access: "signup", subtitle: "The beta gate. Anon inserts are locked down; the backend writes. A row exists before any auth user does." },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {groups.map((g) => {
        const tables = TABLES.filter((t) => t.access === g.access);
        return (
          <div
            key={g.access}
            style={{
              padding: 14,
              borderRadius: 10,
              background: "var(--session-walnut-tint)",
              border: "1px solid var(--session-walnut-border)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "1.5px",
                color: "var(--session-walnut-meta-strong)",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {ACCESS_LABEL[g.access]}
              <span style={{ marginLeft: 6, color: "var(--session-ink-ghost)", fontWeight: 400 }}>
                {tables.length}
              </span>
            </div>
            <div
              style={{
                fontFamily: "var(--font-spectral, var(--font-serif))",
                fontSize: 13,
                fontStyle: "italic",
                color: "var(--session-ink-soft)",
                lineHeight: 1.45,
                marginBottom: 10,
              }}
            >
              {g.subtitle}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {tables.map((t) => (
                <TableCard
                  key={t.name}
                  table={t}
                  selected={selection?.kind === "table" && selection.name === t.name}
                  onClick={() => onSelect({ kind: "table", name: t.name })}
                  size="small"
                />
              ))}
            </div>
          </div>
        );
      })}

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
            fontSize: 11,
            letterSpacing: "1.5px",
            color: "var(--session-walnut-meta-strong)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Two rules worth knowing
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--session-ink)",
          }}
        >
          <li style={{ marginBottom: 6 }}>
            <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>api_errors</code> stores a{" "}
            <strong style={{ fontWeight: 600 }}>hashed</strong> user id, not a real link — so even a
            misconfigured policy can&rsquo;t correlate errors back to a person.
          </li>
          <li>
            Only the OTP verify route may ever set{" "}
            <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>phone_numbers.verified</code>{" "}
            to true — a hard product rule, not just convention.
          </li>
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — what survives a delete
// ---------------------------------------------------------------------------

function CascadeDiagram({
  selection,
  onSelect,
}: {
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
}) {
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
      t.connections.every((c) => c.to !== "profiles" && c.to !== "auth.users") &&
      !t.families.includes("spine"),
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
          When a user deletes their account
        </div>
        <div
          style={{
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: 14,
            lineHeight: 1.5,
            color: "var(--session-ink)",
            marginBottom: 6,
          }}
        >
          The login row goes first; the profile cascades from it; then everything below cascades from the profile.
        </div>
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            color: "var(--session-ink-ghost)",
          }}
        >
          delete auth.users → profiles → …
        </code>
      </div>

      <CascadeGroup
        title={`Cascading — ${cascading.length} tables`}
        subtitle="Rows deleted with the user."
        accent="var(--session-error)"
        accentBg="var(--session-error-ghost)"
        items={cascading}
        selection={selection}
        onSelect={onSelect}
      />

      <CascadeGroup
        title={`Set null — ${setNull.length} table${setNull.length === 1 ? "" : "s"}`}
        subtitle="Row survives, but forgets who it belonged to."
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
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "1.5px",
            color: "var(--session-walnut-meta-strong)",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Outliving the user — {surviving.length} tables
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
          No FK to profiles or auth.users — audit and telemetry rows that survive user deletion by design. The record of what happened can&rsquo;t be erased by deleting an account.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {surviving.map((t) => (
            <TableCard
              key={t.name}
              table={t}
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
    <div style={{ padding: 14, borderRadius: 10, background: accentBg, border: `1px solid ${accent}` }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "1.5px",
          color: accent,
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {title}
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
            <code style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--session-ink)", fontWeight: 500 }}>
              {table.name}
            </code>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--session-ink-ghost)", letterSpacing: "0.5px" }}>
              via {conn.via}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 6 — by the numbers
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

  const families: Family[] = ["spine", "identity", "audit", "telemetry", "beta", "deprecated"];
  const familyCounts = families
    .map((family) => ({
      family,
      count:
        family === "identity"
          ? TABLES.filter((t) => t.families.includes("identity") && !t.families.includes("spine")).length
          : TABLES.filter((t) => t.families.includes(family)).length,
    }))
    .filter((x) => x.count > 0);

  const familyColors: Record<Family, string> = {
    spine: "var(--session-persona-muted)",
    extraction: "var(--session-walnut-highlight)",
    identity: "var(--session-walnut-surface)",
    audit: "var(--session-walnut-surface-soft)",
    telemetry: "var(--session-walnut-tint)",
    beta: "var(--session-walnut-meta-soft)",
    config: "var(--session-persona-soft)",
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
        The schema by the numbers
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
        <HeroStat value={totalColumns} label="Columns mapped" />
        <HeroStat value={totalFKs} label="Foreign keys" />
        <HeroStat value={cascading} label="Cascading" />
        <HeroStat value={settingNull} label="Set-null" />
        <HeroStat value={deprecated} label="Dead / deprecated" />
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
        Tables by family
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
        {familyCounts.map((l) => (
          <div
            key={l.family}
            style={{ flexGrow: l.count, background: familyColors[l.family], minWidth: 0 }}
            title={`${FAMILY_LABEL[l.family]}: ${l.count}`}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {familyCounts.map((l) => (
          <div
            key={l.family}
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
                background: familyColors[l.family],
                border: "1px solid var(--session-walnut-border-soft)",
                display: "inline-block",
              }}
            />
            {FAMILY_LABEL[l.family]}
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
        Hand-curated to track the migrations. A follow-up will introspect
        information_schema for live counts (real columns, real FKs, real RLS
        policies) plus row counts.
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
