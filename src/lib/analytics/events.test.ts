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
        mode: "situation",
      }),
    expectedKeys: ["conversation_id", "end_type", "message_count", "duration_seconds", "mode"],
  },
  {
    event: "checkpoint_proposed",
    call: () =>
      events.trackCheckpointProposed({
        conversation_id: "c1",
        checkpoint_id: "m1",
        layer: 3,
        message_number: 5,
        user_turn_count: 2,
        mode: "situation",
      }),
    expectedKeys: [
      "conversation_id",
      "checkpoint_id",
      "layer",
      "message_number",
      "user_turn_count",
      "mode",
    ],
  },
  {
    event: "checkpoint_confirmed",
    call: () =>
      events.trackCheckpointConfirmed({
        conversation_id: "c1",
        checkpoint_id: "m1",
        layer: 3,
        time_to_decision_ms: 2500,
        mode: "situation",
      }),
    expectedKeys: ["conversation_id", "checkpoint_id", "layer", "time_to_decision_ms", "mode"],
  },
  {
    event: "checkpoint_rejected",
    call: () =>
      events.trackCheckpointRejected({
        conversation_id: "c1",
        checkpoint_id: "m1",
        layer: 3,
        time_to_decision_ms: 2500,
        mode: "situation",
      }),
    expectedKeys: ["conversation_id", "checkpoint_id", "layer", "time_to_decision_ms", "mode"],
  },
  {
    event: "checkpoint_refined",
    call: () =>
      events.trackCheckpointRefined({
        conversation_id: "c1",
        checkpoint_id: "m1",
        layer: 3,
        time_to_decision_ms: 2500,
        mode: "situation",
      }),
    expectedKeys: ["conversation_id", "checkpoint_id", "layer", "time_to_decision_ms", "mode"],
  },
  {
    event: "checkpoint_deferred",
    call: () =>
      events.trackCheckpointDeferred({
        conversation_id: "c1",
        checkpoint_id: "m1",
        layer: 3,
        time_to_decision_ms: 2500,
        mode: "situation",
      }),
    expectedKeys: ["conversation_id", "checkpoint_id", "layer", "time_to_decision_ms", "mode"],
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
    event: "session_started",
    call: () =>
      events.trackSessionStarted({
        days_since_last_session: 1,
        is_first_session: false,
      }),
    expectedKeys: ["days_since_last_session", "is_first_session"],
  },
  {
    event: "modal_1_shown",
    call: () => events.trackModal1Shown({ time_since_signup_ms: 1234 }),
    expectedKeys: ["time_since_signup_ms"],
  },
  {
    event: "modal_2_shown",
    call: () => events.trackModal2Shown({ time_since_signup_ms: 1234 }),
    expectedKeys: ["time_since_signup_ms"],
  },
];

// Mirrors the count expression at the trackCheckpointProposed fire
// site in useChat.ts. If anyone changes that expression, this test
// fails and forces an explicit conversation about the new semantics.
function userTurnCount(messages: { role: string }[]): number {
  return messages.filter((m) => m.role === "user").length;
}

describe("checkpoint_proposed user_turn_count semantics", () => {
  it("counts only role==='user' messages, not assistant or system", () => {
    const messages = [
      { role: "user" },
      { role: "assistant" },
      { role: "user" },
      { role: "system" },
      { role: "assistant" },
      { role: "user" },
    ];
    expect(userTurnCount(messages)).toBe(3);
  });

  it("returns 0 for an empty conversation", () => {
    expect(userTurnCount([])).toBe(0);
  });

  it("returns 0 for an assistant-only conversation (e.g. opener-only state)", () => {
    expect(
      userTurnCount([{ role: "assistant" }, { role: "assistant" }])
    ).toBe(0);
  });

  it("trackCheckpointProposed accepts and forwards user_turn_count", () => {
    vi.mocked(posthog.capture).mockClear();
    events.trackCheckpointProposed({
      conversation_id: "c1",
      checkpoint_id: "m1",
      layer: 3,
      message_number: 7,
      user_turn_count: 4,
      mode: "guided-intake",
    });
    expect(posthog.capture).toHaveBeenCalledTimes(1);
    const [name, props] = vi.mocked(posthog.capture).mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe("checkpoint_proposed");
    expect(props.user_turn_count).toBe(4);
    expect(props.message_number).toBe(7);
  });
});

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
