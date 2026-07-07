// Single source of truth for PostHog events.
// NEVER inline string literals at call sites — add a new tracker here.
// NEVER include message content, entry content, rejection reasons, or any
// user-authored text in event properties. Events describe WHAT the user
// did, not WHAT they said.

import { posthog } from "./posthog-client";

// ──────────────────────────────────────────────
// Stage 1 events — core loop
// ──────────────────────────────────────────────

// Web for MainApp, sms for the Linq incoming-webhook path.
export type Channel = "web" | "sms";

// ConversationMode is the canonical conversation-mode union in
// @/lib/persona/config. EntryPoint extends it with "explore" — the
// layer-scoped "go deeper" entry, which is not a conversation mode and
// must not leak into /api/chat mode validation (hence the union, not a
// widening of ConversationMode itself).
import type { ConversationMode } from "@/lib/persona/config";
export type { ConversationMode };
export type EntryPoint = ConversationMode | "explore";

export function trackConversationStarted(props: {
  conversation_id: string;
  entry_point: EntryPoint;
  channel: Channel;
}) {
  posthog.capture("conversation_started", props);
}

export function trackMessageSent(props: {
  conversation_id: string;
  role: "user" | "assistant";
  message_number: number;
  channel: Channel;
  // DO NOT add content, content_length, or any excerpt.
}) {
  posthog.capture("message_sent", props);
}

export function trackConversationEnded(props: {
  conversation_id: string;
  end_type: "natural" | "abandoned" | "error";
  message_count: number;
  duration_seconds: number;
  mode: ConversationMode;
}) {
  posthog.capture("conversation_ended", props);
}

export function trackCheckpointProposed(props: {
  conversation_id: string;
  checkpoint_id: string;
  section: string | null;
  message_number: number;
  // Count of user messages in the conversation at the moment the
  // checkpoint fires. Lets the dashboard answer "how fast does guided
  // intake reach a checkpoint?" without deriving from message_number.
  // Counted client-side from the React messages array (role === "user").
  user_turn_count: number;
  mode: ConversationMode;
}) {
  posthog.capture("checkpoint_proposed", props);
}

export function trackCheckpointConfirmed(props: {
  conversation_id: string;
  checkpoint_id: string;
  section: string | null;
  time_to_decision_ms: number;
  mode: ConversationMode;
}) {
  posthog.capture("checkpoint_confirmed", props);
}

export function trackCheckpointRejected(props: {
  conversation_id: string;
  checkpoint_id: string;
  section: string | null;
  time_to_decision_ms: number;
  mode: ConversationMode;
  // DO NOT include rejection reason text.
}) {
  posthog.capture("checkpoint_rejected", props);
}

export function trackCheckpointRefined(props: {
  conversation_id: string;
  checkpoint_id: string;
  section: string | null;
  time_to_decision_ms: number;
  mode: ConversationMode;
}) {
  posthog.capture("checkpoint_refined", props);
}

export function trackManualViewed(props: {
  entry_count: number;
  days_since_last_view: number | null;
}) {
  posthog.capture("manual_viewed", props);
}

export function trackManualExported(props: {
  format: "pdf";
  entry_count: number;
}) {
  posthog.capture("manual_exported", props);
}

// ──────────────────────────────────────────────
// Session lifecycle
// ──────────────────────────────────────────────

export function trackSessionStarted(props: {
  days_since_last_session: number | null;
  is_first_session: boolean;
}) {
  posthog.capture("session_started", props);
}

// ──────────────────────────────────────────────
// Onboarding modal progression (Track A)
// PostHog auto-populates distinct_id and $session_id on every event.
// Do NOT duplicate user_id or session_id as explicit props — the
// events.test.ts PII guard forbids user_id in any payload anyway.
// time_since_signup_ms is the only explicit property: PostHog does
// not compute it, and it lets us answer "how long did it take this
// user to reach modal N from signup" without joining against profiles.
// ──────────────────────────────────────────────

type ModalProgressEventProps = {
  time_since_signup_ms: number;
};

export function trackModal1Shown(props: ModalProgressEventProps) {
  posthog.capture("modal_1_shown", props);
}
