// Single source of truth for PostHog events.
// NEVER inline string literals at call sites — add a new tracker here.
// NEVER include message content, entry content, rejection reasons, or any
// user-authored text in event properties. Events describe WHAT the user
// did, not WHAT they said.

import { posthog } from "./posthog-client";
import type { GuidedIntakeOpenerVariant } from "@/lib/persona/guided-intake-copy";

// ──────────────────────────────────────────────
// Stage 1 events — core loop
// ──────────────────────────────────────────────

// Web for MainApp, sms for the Linq incoming-webhook path.
export type Channel = "web" | "sms";

// Extend this union when resonant-content entry point ships.
export type EntryPoint = "situation" | "guided-intake" | "upload";

// Mirrors the conversations.mode column. Carried on checkpoint and
// session-end events so PostHog can answer "how does guided-intake
// perform vs situation mode" without a DB join.
export type ConversationMode = "situation" | "guided-intake" | "upload";

// GuidedIntakeOpenerVariant is defined alongside the canonical phrases
// in src/lib/persona/guided-intake-copy.ts and re-exported here for
// callers who only import from analytics.
export type { GuidedIntakeOpenerVariant };

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
  layer: number;
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
  layer: number;
  time_to_decision_ms: number;
  mode: ConversationMode;
}) {
  posthog.capture("checkpoint_confirmed", props);
}

export function trackCheckpointRejected(props: {
  conversation_id: string;
  checkpoint_id: string;
  layer: number;
  time_to_decision_ms: number;
  mode: ConversationMode;
  // DO NOT include rejection reason text.
}) {
  posthog.capture("checkpoint_rejected", props);
}

export function trackCheckpointRefined(props: {
  conversation_id: string;
  checkpoint_id: string;
  layer: number;
  time_to_decision_ms: number;
  mode: ConversationMode;
}) {
  posthog.capture("checkpoint_refined", props);
}

// Track A Phase 7-Mid: refinement-ceiling defer. Distinct from
// checkpoint_rejected — both close the entry without writing to
// the Manual, but a defer means the user already explained twice
// what was off and chose to set it aside (vs. a flat "this is not
// me"). Tracking separately lets us see how often the ceiling
// fires in production, which informs whether the "two refinements
// max" threshold is right.
export function trackCheckpointDeferred(props: {
  conversation_id: string;
  checkpoint_id: string;
  layer: number;
  time_to_decision_ms: number;
  mode: ConversationMode;
}) {
  posthog.capture("checkpoint_deferred", props);
}

// Fires once per guided-intake conversation, on the assistant turn where
// the variant becomes detectable. "default" fires on turn 1 (the literal
// opener); the three fallback variants fire on later turns when the
// corresponding phrase is detected. Multiple variants per session are
// possible (e.g. default + recency_drop) — PostHog can compute "deepest
// variant per conversation" downstream.
export function trackGuidedIntakeOpenerFired(props: {
  conversation_id: string;
  variant: GuidedIntakeOpenerVariant;
}) {
  posthog.capture("guided_intake_opener_fired", props);
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

export function trackEntryEdited(props: {
  entry_id: string;
  layer: number;
  edit_type: "content" | "delete";
}) {
  posthog.capture("entry_edited", props);
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

export function trackModal2Shown(props: ModalProgressEventProps) {
  posthog.capture("modal_2_shown", props);
}

export function trackModal3Shown(props: ModalProgressEventProps) {
  posthog.capture("modal_3_shown", props);
}

export function trackModalFlowCompleted(props: ModalProgressEventProps) {
  posthog.capture("modal_flow_completed", props);
}

export function trackFirstCheckpointCompleted(props: {
  conversation_id: string;
  checkpoint_id: string;
  layer: number;
  time_since_signup_ms: number;
}) {
  posthog.capture("first_checkpoint_completed", props);
}
