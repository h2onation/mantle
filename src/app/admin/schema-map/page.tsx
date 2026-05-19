"use client";

import { useMemo, useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";

// ---------------------------------------------------------------------------
// Schema map.
//
// Static documentation page. Traces the 15 tables in the public schema,
// what each represents, what columns matter, what each is connected to,
// and what happens when a parent row is deleted. Designed for non-
// technical reading: progressive disclosure with plain-English explanations
// of foreign keys and cascade behavior.
//
// Edit the TABLES array below if the schema shifts. The squash baseline at
// supabase/migrations/20260417000000_squash_baseline.sql is the source of
// truth for shapes; subsequent migrations layer columns on top.
// ---------------------------------------------------------------------------

type Tier = "core" | "adjacent" | "messaging" | "beta" | "telemetry";

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
  tier: Tier;
  oneLine: string;
  rowMeans: string;
  description: string;
  columns: Column[];
  connections: Connection[];
  notes?: string;
  deprecated?: boolean;
}

const TIERS: { id: Tier; title: string; blurb: string }[] = [
  {
    id: "core",
    title: "Core",
    blurb:
      "The main user-data path. Every interactive feature reads or writes one of these four.",
  },
  {
    id: "adjacent",
    title: "Adjacent",
    blurb:
      "Tables that hang directly off the core — edit history, phone linking, safety events.",
  },
  {
    id: "messaging",
    title: "Messaging",
    blurb: "Group-chat infrastructure. Linq is deprecated and slated for removal.",
  },
  {
    id: "beta",
    title: "Beta & signup",
    blurb: "Email allowlist, in-app feedback, waitlist.",
  },
  {
    id: "telemetry",
    title: "Telemetry & ops",
    blurb:
      "Audit trails and error capture. Service-role write only — RLS blocks ordinary user reads.",
  },
];

const TABLES: Table[] = [
  // ── CORE ────────────────────────────────────────────────────────────────
  {
    name: "profiles",
    tier: "core",
    oneLine: "One row per user. The root of every user-owned chain.",
    rowMeans: "One mywalnut user. The id mirrors Supabase's auth.users.id.",
    description:
      "When someone signs up through Supabase Auth, a corresponding profiles row is created with the same id. Everything user-scoped — conversations, manual entries, phone numbers, modal progress — points back to this row. Deleting a profile cascades through almost every user-owned table.",
    columns: [
      { name: "id", type: "uuid", plain: "Mirrors auth.users.id. The user's unique identifier across the whole app." },
      { name: "display_name", type: "text", plain: "Optional name shown in UI.", emphasized: false },
      { name: "persona_modes", type: "text[]", plain: "Which Jove voice modes apply to this user (e.g. ['autistic', 'audhd']). Drives prompt assembly.", emphasized: true },
      { name: "modal_progress", type: "integer", plain: "Onboarding modal step (0-3). Gates which one-time modals fire. The Halfway-there modal fires when this is 1.", emphasized: true },
      { name: "onboarding_completed_at", type: "timestamptz", plain: "When the user finished initial onboarding. Null until completed." },
    ],
    connections: [
      {
        to: "auth.users",
        via: "id",
        cardinality: "1:1",
        onDelete: "CASCADE",
        explanation:
          "If the underlying Supabase auth user is deleted, the profile goes with it.",
      },
    ],
    notes:
      "Almost everything user-scoped (conversations, manual_entries, phone_numbers, etc.) cascades from this row. Deleting a profile effectively deletes the user's product data.",
  },
  {
    name: "conversations",
    tier: "core",
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
      { name: "linq_group_chat_id", type: "uuid", plain: "Links a group conversation to a linq_group_chats row. Null for normal 1:1 conversations.", emphasized: false },
    ],
    connections: [
      {
        to: "profiles",
        via: "user_id",
        cardinality: "N:1",
        onDelete: "CASCADE",
        explanation:
          "Delete a user, and every conversation they ever had is deleted too.",
      },
      {
        to: "linq_group_chats",
        via: "linq_group_chat_id",
        cardinality: "N:1",
        onDelete: "SET NULL",
        explanation:
          "If the group chat is deleted, this column becomes null but the conversation row survives.",
      },
    ],
    notes:
      "The extraction_state column is huge in product impact — it's the entire context for Jove's next turn. There's NO row-per-extraction history table; only the current state is kept here (with frozen per-message copies on messages.extraction_snapshot).",
  },
  {
    name: "messages",
    tier: "core",
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
    ],
    connections: [
      {
        to: "conversations",
        via: "conversation_id",
        cardinality: "N:1",
        onDelete: "CASCADE",
        explanation:
          "Delete a conversation, and every message in it is deleted.",
      },
    ],
    notes:
      "manual_entries.source_message_id points back here — that's how each Manual entry traces to the specific checkpoint message that proposed it.",
  },
  {
    name: "manual_entries",
    tier: "core",
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
        explanation:
          "Delete a user, every Manual entry they confirmed is deleted.",
      },
      {
        to: "messages",
        via: "source_message_id",
        cardinality: "N:1",
        onDelete: "—",
        explanation:
          "No cascade specified. If the source message is deleted, the entry stays but loses its traceback.",
      },
    ],
    notes:
      "Confirmation is always an INSERT. There is no replace-existing flow today. The manual_changelog table is reserved for explicit edits.",
  },

  // ── ADJACENT ────────────────────────────────────────────────────────────
  {
    name: "manual_changelog",
    tier: "adjacent",
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
        explanation:
          "If the conversation is deleted, the edit log survives but loses its conversation link.",
      },
    ],
    notes:
      "Rarely written today. Confirmed in docs/system.md: 'current write paths do not exercise it.'",
  },
  {
    name: "phone_numbers",
    tier: "adjacent",
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
    ],
    connections: [
      {
        to: "profiles",
        via: "user_id",
        cardinality: "N:1",
        onDelete: "CASCADE",
        explanation:
          "Phone links go away when the user is deleted.",
      },
    ],
  },
  {
    name: "safety_events",
    tier: "adjacent",
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
        explanation:
          "If the conversation is deleted, safety events for it are deleted too.",
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

  // ── MESSAGING ─────────────────────────────────────────────────────────────
  {
    name: "linq_group_chats",
    tier: "messaging",
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
        explanation:
          "If the owner deletes their account, the group chat survives but becomes ownerless (rare in practice).",
      },
    ],
    deprecated: true,
    notes:
      "Slated for removal. Per project memory: 'Moving away from Linq; no further investment in Linq code.'",
  },

  // ── BETA & SIGNUP ─────────────────────────────────────────────────────────
  {
    name: "beta_allowlist",
    tier: "beta",
    oneLine: "Email gate for beta signups.",
    rowMeans:
      "An email approved for beta access. The signup flow checks against this list.",
    description:
      "Pure allowlist with no foreign keys. Just emails + creation timestamps + optional notes. Emails must be lowercase + trimmed (CHECK constraint).",
    columns: [
      { name: "id", type: "uuid", plain: "Unique allowlist-entry identifier." },
      { name: "email", type: "text (unique, lowercased)", plain: "The approved email address.", emphasized: true },
      { name: "notes", type: "text", plain: "Optional admin notes (e.g. 'invited by Jeff, ND advocate')." },
    ],
    connections: [],
  },
  {
    name: "beta_feedback",
    tier: "beta",
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
    tier: "beta",
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
    tier: "beta",
    oneLine: "Pre-allowlist email capture.",
    rowMeans:
      "An email captured from the marketing site or signup flow before they're approved for beta.",
    description:
      "Pre-allowlist staging. status moves through 'waiting' → 'invited' → 'declined'. When an email is approved, it's copied to beta_allowlist and the waitlist row's status is updated.",
    columns: [
      { name: "id", type: "uuid", plain: "Unique waitlist identifier." },
      { name: "email", type: "text (unique, lowercased)", plain: "The email captured." },
      { name: "source", type: "text", plain: "Where the email came from ('landing', 'referral', etc.)." },
      { name: "status", type: "text", plain: "'waiting', 'invited', or 'declined'.", emphasized: true },
    ],
    connections: [],
  },

  // ── TELEMETRY & OPS ─────────────────────────────────────────────────────
  {
    name: "admin_access_logs",
    tier: "telemetry",
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
      "No FK constraints on admin_id / target_user_id / conversation_id — just UUID columns. Service-role write only.",
  },
  {
    name: "api_errors",
    tier: "telemetry",
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
    tier: "telemetry",
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
        explanation:
          "Failure records cascade when the user is deleted.",
      },
    ],
    notes:
      "RLS-on, no policies. message_id and conversation_id are deliberately not FKs to avoid coupling telemetry to the lifetime of the source rows.",
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type FilterKey = "all" | Tier;

export default function SchemaMapPage() {
  const isAdmin = useIsAdmin();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [expandedName, setExpandedName] = useState<string | null>(null);

  const filteredTables = useMemo(() => {
    if (filter === "all") return TABLES;
    return TABLES.filter((t) => t.tier === filter);
  }, [filter]);

  const counts = useMemo(() => {
    const byTier = new Map<Tier, number>();
    for (const t of TABLES) byTier.set(t.tier, (byTier.get(t.tier) ?? 0) + 1);
    return {
      total: TABLES.length,
      byTier,
    };
  }, []);

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
          {/* Header strip */}
          <div
            style={{
              borderBottom: "1px solid var(--session-ink-hairline)",
              padding: "18px 32px",
              display: "flex",
              flexWrap: "wrap",
              gap: 18,
              alignItems: "center",
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
              Schema map
            </div>
            <div
              style={{
                width: 1,
                height: 22,
                background: "var(--session-ink-hairline)",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "var(--session-ink-ghost)",
                letterSpacing: "0.5px",
              }}
            >
              {counts.total} tables · {counts.byTier.get("core") ?? 0} core · {TABLES.filter((t) => t.deprecated).length} deprecated
            </span>
          </div>

          {/* Scrollable content */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "28px 32px 80px",
            }}
          >
            <CoreFlow />
            <Glossary />
            <FilterChips filter={filter} setFilter={setFilter} counts={counts} />
            <TableList
              tables={filteredTables}
              expandedName={expandedName}
              setExpandedName={setExpandedName}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero flow diagram — the core data path
// ---------------------------------------------------------------------------

function CoreFlow() {
  return (
    <div
      style={{
        marginBottom: 28,
        padding: "22px 24px",
        background: "var(--session-walnut-tint)",
        border: "1px solid var(--session-ink-hairline)",
        borderRadius: 10,
      }}
    >
      <p
        style={{
          margin: "0 0 18px",
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: "15px",
          lineHeight: 1.55,
          color: "var(--session-ink)",
        }}
      >
        The data flows top to bottom. A user has many conversations. A
        conversation has many messages. Some messages, once confirmed, become
        Manual entries — those still point back to the message that proposed
        them.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
        }}
      >
        {/* Left column: spine */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          <SpineBox label="profiles" sub="One row per user" />
          <SpineConnector text="user_id" />
          <SpineBox label="conversations" sub="One row per session" />
          <SpineConnector text="conversation_id" />
          <SpineBox label="messages" sub="One row per chat turn" />
          <SpineConnector text="source_message_id" tone="dashed" />
          <SpineBox label="manual_entries" sub="One row per confirmed entry" />
        </div>

        {/* Right column: adjacent + notes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <NoteBlock
            heading="Side branches off the core"
            lines={[
              "manual_changelog — edit history (rarely written today)",
              "phone_numbers — SMS linking + OTP",
              "safety_events — crisis detection log",
            ]}
          />
          <NoteBlock
            heading="What happens when a user is deleted"
            lines={[
              "Almost everything CASCADES from profiles: conversations, manual_entries, phone_numbers, safety_events, beta_feedback, confirm_failures.",
              "linq_group_chats SET NULL — group chats survive ownerless.",
            ]}
          />
          <NoteBlock
            heading="Where the extraction state lives"
            lines={[
              "It's a JSONB column on conversations — not a separate table.",
              "Every turn, the extractor rewrites it. messages.extraction_snapshot keeps a frozen per-turn copy.",
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function SpineBox({
  label,
  sub,
}: {
  label: string;
  sub: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 280,
        padding: "12px 16px",
        background: "var(--session-linen)",
        border: "1.5px solid var(--session-walnut-border)",
        borderRadius: 8,
        textAlign: "center",
      }}
    >
      <code
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "14px",
          color: "var(--session-ink)",
          fontWeight: 500,
        }}
      >
        {label}
      </code>
      <div
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: "12.5px",
          color: "var(--session-ink-soft)",
          marginTop: 2,
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function SpineConnector({ text, tone }: { text: string; tone?: "solid" | "dashed" }) {
  const isDashed = tone === "dashed";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "2px 0",
      }}
    >
      <div
        style={{
          width: 0,
          height: 18,
          borderLeft: isDashed
            ? "1.5px dashed var(--session-walnut-light)"
            : "1.5px solid var(--session-walnut-light)",
        }}
      />
      <code
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10.5px",
          color: "var(--session-ink-ghost)",
          letterSpacing: "0.5px",
          background: "var(--session-walnut-tint)",
          padding: "1px 6px",
          borderRadius: 3,
        }}
      >
        {text}
      </code>
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: "6px solid var(--session-walnut-light)",
          marginTop: 2,
        }}
      />
    </div>
  );
}

function NoteBlock({
  heading,
  lines,
}: {
  heading: string;
  lines: string[];
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--session-linen)",
        border: "1px solid var(--session-ink-hairline)",
        borderRadius: 6,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10.5px",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: "var(--session-walnut-meta)",
          marginBottom: 6,
        }}
      >
        {heading}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, listStyle: "disc" }}>
        {lines.map((line, i) => (
          <li
            key={i}
            style={{
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: "13.5px",
              lineHeight: 1.45,
              color: "var(--session-ink-soft)",
              marginBottom: 4,
            }}
          >
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Glossary — non-technical primer
// ---------------------------------------------------------------------------

function Glossary() {
  const items: { term: string; definition: string }[] = [
    {
      term: "Table",
      definition:
        "A spreadsheet-like container of rows. Every table here lives in the Supabase Postgres database.",
    },
    {
      term: "Row",
      definition:
        "One record in a table. E.g. one row in profiles = one user; one row in messages = one chat turn.",
    },
    {
      term: "Column",
      definition:
        "A named field on every row of a table. E.g. profiles has a display_name column.",
    },
    {
      term: "Foreign key (FK)",
      definition:
        "A column that points to another table's row. E.g. messages.conversation_id points to conversations.id, linking each message to its conversation.",
    },
    {
      term: "CASCADE",
      definition:
        "On-delete behavior: when the parent row is deleted, child rows are deleted too. E.g. delete a profile → all their conversations are deleted.",
    },
    {
      term: "SET NULL",
      definition:
        "On-delete behavior: when the parent row is deleted, the child's pointer is cleared but the child row stays.",
    },
    {
      term: "JSONB",
      definition:
        "A column that holds a structured JSON object. Lets one column store many fields. The extraction_state column is JSONB.",
    },
    {
      term: "RLS (Row-Level Security)",
      definition:
        "Postgres feature that filters rows per-user automatically. Every user-data table has RLS enabled so users can only read their own rows.",
    },
  ];

  return (
    <details
      style={{
        marginBottom: 24,
        padding: "10px 14px",
        background: "var(--session-walnut-tint)",
        border: "1px solid var(--session-ink-hairline)",
        borderRadius: 6,
      }}
    >
      <summary
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "1.5px",
          color: "var(--session-ink-soft)",
          cursor: "pointer",
          textTransform: "uppercase",
        }}
      >
        Glossary — what these terms mean
      </summary>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          columnGap: 14,
          rowGap: 8,
          marginTop: 12,
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: "13.5px",
          lineHeight: 1.5,
        }}
      >
        {items.map((it) => (
          <FragmentRow key={it.term} term={it.term} definition={it.definition} />
        ))}
      </div>
    </details>
  );
}

function FragmentRow({ term, definition }: { term: string; definition: string }) {
  return (
    <>
      <span style={{ color: "var(--session-ink)", fontWeight: 500 }}>{term}</span>
      <span style={{ color: "var(--session-ink-soft)" }}>{definition}</span>
    </>
  );
}

// ---------------------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------------------

function FilterChips({
  filter,
  setFilter,
  counts,
}: {
  filter: FilterKey;
  setFilter: (k: FilterKey) => void;
  counts: { total: number; byTier: Map<Tier, number> };
}) {
  const chips: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.total },
    ...TIERS.map((t) => ({
      key: t.id as FilterKey,
      label: t.title,
      count: counts.byTier.get(t.id) ?? 0,
    })),
  ];

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 18,
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "1.5px",
          color: "var(--session-ink-ghost)",
          marginRight: 4,
        }}
      >
        FILTER
      </span>
      {chips.map((c) => {
        const active = filter === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            style={{
              all: "unset",
              cursor: "pointer",
              padding: "5px 11px",
              borderRadius: 999,
              fontFamily: "var(--font-sans)",
              fontSize: "12.5px",
              letterSpacing: "0.1px",
              color: active ? "var(--session-ink)" : "var(--session-ink-soft)",
              background: active
                ? "var(--session-walnut-highlight)"
                : "var(--session-walnut-tint)",
              border: active
                ? "1px solid var(--session-walnut-border)"
                : "1px solid var(--session-ink-hairline)",
              fontWeight: active ? 500 : 400,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{c.label}</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10.5px",
                color: "var(--session-ink-ghost)",
                fontWeight: 400,
              }}
            >
              {c.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table list — compact rows, expandable
// ---------------------------------------------------------------------------

const TIER_LABEL: Record<Tier, string> = {
  core: "CORE",
  adjacent: "ADJACENT",
  messaging: "MESSAGING",
  beta: "BETA",
  telemetry: "TELEMETRY",
};

function TableList({
  tables,
  expandedName,
  setExpandedName,
}: {
  tables: Table[];
  expandedName: string | null;
  setExpandedName: (n: string | null) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--session-ink-hairline)",
        borderRadius: 8,
        background: "var(--session-walnut-tint)",
        overflow: "hidden",
      }}
    >
      {tables.map((t, i) => (
        <TableRow
          key={t.name}
          table={t}
          expanded={expandedName === t.name}
          onToggle={() =>
            setExpandedName(expandedName === t.name ? null : t.name)
          }
          isLast={i === tables.length - 1}
        />
      ))}
      {tables.length === 0 && (
        <div
          style={{
            padding: 28,
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--session-ink-ghost)",
            letterSpacing: "0.5px",
          }}
        >
          No tables match this filter.
        </div>
      )}
    </div>
  );
}

function TableRow({
  table,
  expanded,
  onToggle,
  isLast,
}: {
  table: Table;
  expanded: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  return (
    <div
      style={{
        borderBottom: isLast ? "none" : "1px solid var(--session-ink-hairline)",
        background: expanded ? "var(--session-walnut-surface-soft)" : "transparent",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "grid",
          gridTemplateColumns: "auto 1fr auto auto",
          gap: 12,
          alignItems: "center",
          padding: "12px 16px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Dot */}
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 99,
            background: table.deprecated
              ? "var(--session-error, #a14)"
              : table.tier === "core"
              ? "var(--session-walnut, #6e3a1e)"
              : "var(--session-ink-ghost)",
            opacity: table.deprecated ? 0.55 : table.tier === "core" ? 1 : 0.55,
            flexShrink: 0,
          }}
        />

        {/* Name + summary */}
        <div style={{ minWidth: 0 }}>
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "13.5px",
              color: "var(--session-ink)",
              fontWeight: 500,
              display: "block",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              textDecoration: table.deprecated ? "line-through" : "none",
              textDecorationColor: "var(--session-walnut-light)",
            }}
          >
            {table.name}
          </code>
          <div
            style={{
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: "13.5px",
              lineHeight: 1.4,
              color: "var(--session-ink-soft)",
              marginTop: 2,
            }}
          >
            {table.oneLine}
          </div>
        </div>

        {/* Tier badge */}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "1.5px",
            color: "var(--session-ink-ghost)",
            background: "var(--session-walnut-tint)",
            padding: "3px 7px",
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          {TIER_LABEL[table.tier]}
        </span>

        {/* Chevron */}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--session-ink-ghost)",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 120ms ease",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          ›
        </span>
      </button>

      {expanded && <TableDetail table={table} />}
    </div>
  );
}

function TableDetail({ table }: { table: Table }) {
  return (
    <div
      style={{
        padding: "0 16px 22px 38px",
        borderTop: "1px solid var(--session-walnut-border-soft)",
        paddingTop: 16,
        marginTop: 0,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* What a row means */}
      <Section heading="What a row means">
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: "14px",
            lineHeight: 1.55,
            color: "var(--session-ink)",
          }}
        >
          {table.rowMeans}
        </p>
      </Section>

      {/* Description */}
      <Section heading="In plain English">
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-spectral, var(--font-serif))",
            fontSize: "14px",
            lineHeight: 1.6,
            color: "var(--session-ink-soft)",
          }}
        >
          {table.description}
        </p>
      </Section>

      {/* Notable columns */}
      <Section heading="Notable columns">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "max-content max-content 1fr",
            columnGap: 14,
            rowGap: 8,
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          {table.columns.map((col) => (
            <ColumnRow key={col.name} column={col} />
          ))}
        </div>
      </Section>

      {/* Connections */}
      <Section heading="Connected to">
        {table.connections.length === 0 ? (
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: "13.5px",
              fontStyle: "italic",
              color: "var(--session-ink-ghost)",
            }}
          >
            Standalone. No foreign keys to other tables.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {table.connections.map((conn, i) => (
              <ConnectionCard key={i} conn={conn} />
            ))}
          </div>
        )}
      </Section>

      {/* Notes */}
      {table.notes && (
        <Section heading="Note">
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-spectral, var(--font-serif))",
              fontSize: "13.5px",
              fontStyle: "italic",
              color: "var(--session-ink-soft)",
              lineHeight: 1.55,
            }}
          >
            {table.notes}
          </p>
        </Section>
      )}
    </div>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10.5px",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: "var(--session-ink-ghost)",
          marginBottom: 6,
        }}
      >
        {heading}
      </div>
      {children}
    </div>
  );
}

function ColumnRow({ column }: { column: Column }) {
  return (
    <>
      <code
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          color: "var(--session-ink)",
          fontWeight: column.emphasized ? 500 : 400,
        }}
      >
        {column.name}
      </code>
      <code
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--session-ink-ghost)",
        }}
      >
        {column.type}
      </code>
      <span
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: "13px",
          lineHeight: 1.5,
          color: "var(--session-ink-soft)",
        }}
      >
        {column.plain}
      </span>
    </>
  );
}

function ConnectionCard({ conn }: { conn: Connection }) {
  const onDeleteBadge: Record<Connection["onDelete"], { label: string; tone: string }> = {
    CASCADE: { label: "DELETES WITH PARENT", tone: "var(--session-error-ghost)" },
    "SET NULL": { label: "POINTER CLEARED", tone: "var(--session-walnut-surface-soft)" },
    RESTRICT: { label: "DELETE BLOCKED", tone: "var(--session-warning-soft)" },
    "—": { label: "NO CASCADE RULE", tone: "var(--session-walnut-tint)" },
  };
  const badge = onDeleteBadge[conn.onDelete];
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--session-linen)",
        border: "1px solid var(--session-ink-hairline)",
        borderRadius: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 4,
        }}
      >
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "12.5px",
            color: "var(--session-ink)",
            fontWeight: 500,
          }}
        >
          → {conn.to}
        </code>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            color: "var(--session-ink-ghost)",
          }}
        >
          via {conn.via}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            color: "var(--session-ink-ghost)",
          }}
        >
          {conn.cardinality}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9.5px",
            letterSpacing: "1.2px",
            color: "var(--session-ink-soft)",
            background: badge.tone,
            padding: "2px 6px",
            borderRadius: 3,
            marginLeft: "auto",
          }}
        >
          {badge.label}
        </span>
      </div>
      <div
        style={{
          fontFamily: "var(--font-spectral, var(--font-serif))",
          fontSize: "13px",
          lineHeight: 1.5,
          color: "var(--session-ink-soft)",
        }}
      >
        {conn.explanation}
      </div>
    </div>
  );
}
