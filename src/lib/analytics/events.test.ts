import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./posthog-client", () => ({
  posthog: { capture: vi.fn() },
}));

import { posthog } from "./posthog-client";
import * as events from "./events";

// If someone later adds one of these keys to an event payload, this test
// fails. Events describe what the user did, not what they said. Raw
// content, message bodies, excerpts, auth identifiers, rejection reasons
// must never reach PostHog. Strict equality — subkeys like
// "message_number" or "message_count" are fine.
const FORBIDDEN_KEYS = [
  "content",
  "message",
  "text",
  "body",
  "email",
  "phone",
  "user_id",
  "display_name",
  "reason",
  "excerpt",
];

type Case = { event: string; call: () => void; expectedKeys: string[] };

const CASES: Case[] = [
  {
    event: "conversation_started",
    call: () =>
      events.trackConversationStarted({
        conversation_id: "c1",
        entry_point: "situation",
        channel: "web",
      }),
    expectedKeys: ["conversation_id", "entry_point", "channel"],
  },
  {
    event: "message_sent",
    call: () =>
      events.trackMessageSent({
        conversation_id: "c1",
        role: "user",
        message_number: 1,
        channel: "web",
      }),
    expectedKeys: ["conversation_id", "role", "message_number", "channel"],
  },
  {
    event: "conversation_ended",
    call: () =>
      events.trackConversationEnded({
        conversation_id: "c1",
        end_type: "natural",
        message_count: 4,
        duration_seconds: 120,
      }),
    expectedKeys: ["conversation_id", "end_type", "message_count", "duration_seconds"],
  },
  {
    event: "checkpoint_proposed",
    call: () =>
      events.trackCheckpointProposed({
        conversation_id: "c1",
        checkpoint_id: "m1",
        layer: 3,
        message_number: 5,
      }),
    expectedKeys: ["conversation_id", "checkpoint_id", "layer", "message_number"],
  },
  {
    event: "checkpoint_confirmed",
    call: () =>
      events.trackCheckpointConfirmed({
        conversation_id: "c1",
        checkpoint_id: "m1",
        layer: 3,
        time_to_decision_ms: 2500,
      }),
    expectedKeys: ["conversation_id", "checkpoint_id", "layer", "time_to_decision_ms"],
  },
  {
    event: "checkpoint_rejected",
    call: () =>
      events.trackCheckpointRejected({
        conversation_id: "c1",
        checkpoint_id: "m1",
        layer: 3,
        time_to_decision_ms: 2500,
      }),
    expectedKeys: ["conversation_id", "checkpoint_id", "layer", "time_to_decision_ms"],
  },
  {
    event: "checkpoint_refined",
    call: () =>
      events.trackCheckpointRefined({
        conversation_id: "c1",
        checkpoint_id: "m1",
        layer: 3,
        time_to_decision_ms: 2500,
      }),
    expectedKeys: ["conversation_id", "checkpoint_id", "layer", "time_to_decision_ms"],
  },
  {
    event: "manual_viewed",
    call: () =>
      events.trackManualViewed({ entry_count: 5, days_since_last_view: 2 }),
    expectedKeys: ["entry_count", "days_since_last_view"],
  },
  {
    event: "manual_exported",
    call: () => events.trackManualExported({ format: "pdf", entry_count: 5 }),
    expectedKeys: ["format", "entry_count"],
  },
  {
    event: "entry_edited",
    call: () =>
      events.trackEntryEdited({ entry_id: "e1", layer: 2, edit_type: "content" }),
    expectedKeys: ["entry_id", "layer", "edit_type"],
  },
  {
    event: "session_started",
    call: () =>
      events.trackSessionStarted({
        days_since_last_session: 1,
        is_first_session: false,
      }),
    expectedKeys: ["days_since_last_session", "is_first_session"],
  },
];

describe("analytics events — PII guard", () => {
  beforeEach(() => {
    vi.mocked(posthog.capture).mockClear();
  });

  for (const c of CASES) {
    it(`${c.event} carries expected keys and no forbidden ones`, () => {
      c.call();
      expect(posthog.capture).toHaveBeenCalledTimes(1);
      const [name, props] = vi.mocked(posthog.capture).mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(name).toBe(c.event);
      const keys = Object.keys(props ?? {});
      for (const forbidden of FORBIDDEN_KEYS) {
        expect(keys, `${c.event} must not carry "${forbidden}"`).not.toContain(
          forbidden
        );
      }
      for (const expected of c.expectedKeys) {
        expect(keys, `${c.event} must carry "${expected}"`).toContain(expected);
      }
    });
  }
});
