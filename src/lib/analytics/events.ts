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

// Extend this union when resonant-content and personal-upload entry
// points ship. As of 2026-04-16 only the situation entry point exists.
export type EntryPoint = "situation";

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
}) {
  posthog.capture("conversation_ended", props);
}

export function trackCheckpointProposed(props: {
  conversation_id: string;
  checkpoint_id: string;
  layer: number;
  message_number: number;
}) {
  posthog.capture("checkpoint_proposed", props);
}

export function trackCheckpointConfirmed(props: {
  conversation_id: string;
  checkpoint_id: string;
  layer: number;
  time_to_decision_ms: number;
}) {
  posthog.capture("checkpoint_confirmed", props);
}

export function trackCheckpointRejected(props: {
  conversation_id: string;
  checkpoint_id: string;
  layer: number;
  time_to_decision_ms: number;
  // DO NOT include rejection reason text.
}) {
  posthog.capture("checkpoint_rejected", props);
}

export function trackCheckpointRefined(props: {
  conversation_id: string;
  checkpoint_id: string;
  layer: number;
  time_to_decision_ms: number;
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
