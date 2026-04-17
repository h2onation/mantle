# Sendblue Migration — Closeout (2026-04)

## Summary

Between 2026-04-16 and 2026-04-17, mywalnut's 1:1 text channel migrated from Linq Partner API V3 to Sendblue. Before: all text (1:1 and iMessage groups) routed through Linq. After: 1:1 text routes through Sendblue at `+16292925296` with full outbound delivery visibility; iMessage group facilitator remains on Linq because Sendblue does not expose `participant.added` / `participant.removed` / `chat.created` events that the group flow requires. Both providers run in parallel permanently; dispatch lives in `src/lib/messaging/send.ts` keyed off a feature flag.

## Architecture

Unified send interface at `src/lib/messaging/send.ts:sendMessage()`. Callers pass `{to, content, ownerUserId?, linqGroupChatId?, contentKind?}`; the function routes based on:

- `linqGroupChatId` present → always Linq group path (groups have no Sendblue equivalent)
- Otherwise → provider selected by `process.env.MESSAGING_PROVIDER` (defaults to `"sendblue"`)

Inbound events from Sendblue arrive at `POST /api/webhooks/sendblue` (`src/app/api/webhooks/sendblue/route.ts`). Sendblue sends both event types to the same URL, distinguished by `payload.is_outbound`:

- `is_outbound: false` → inbound user text → signature-verified → PII-redacted audit insert → typing indicator fires → `routeInboundMessage()` in `src/lib/linq/message-router.ts` dispatches to Jove
- `is_outbound: true` → status callback → signature-verified → lookup existing audit row by `(provider, provider_message_id, direction)` → forward-progress rank guard → update `status` plus `delivered_at` (on DELIVERED) or `error_code` + `error_message` (on FAILED)

The router is shared with Linq inbound. `chatId?: string` is optional on `InboundMessageData`; Sendblue callers leave it undefined, and Linq-specific surfaces (typing API, read receipts, `linq_chat_id` write-back) are guarded on `chatId` presence.

Audit table: `messaging_events`. Base schema in `supabase/migrations/20260417000005_messaging_events.sql`; `delivered_at` column added in `20260417000010_add_delivered_at.sql`. The `content` column stores metadata markers only (`[OTP_SEND]`, `[USER_MSG len=N]`, `[JOVE_REPLY len=N]`, `[SYSTEM_MSG len=N]`) — never raw text (ADR-037).

## Key decisions

Six ADRs cover the migration. ADR-040 was skipped and is reserved for unrelated work.

1. **ADR-035** — Dual-provider messaging: Sendblue for 1:1, Linq for groups, permanently. Rebuilding group detection on Sendblue was rejected as out of scope.
2. **ADR-036** — No dev Supabase environment. Migrations apply to prod via dashboard paste. Infrastructure debt to resolve before beta scale.
3. **ADR-037** — `messaging_events.content` is metadata-only. Raw message text and OTP codes never land in audit rows. Fixed pre-ship after review.
4. **ADR-038** — The per-row OTP `attempts` counter was removed because its schema column never existed and every increment silently no-op'd. Abuse protection now relies solely on Upstash rate limits — which are currently missing in Vercel production. Beta-blocker.
5. **ADR-039** — Sendblue webhook auth is shared-secret, not HMAC. Constant-time compare of `sb-signing-secret` header against `SENDBLUE_WEBHOOK_SECRET`. Fail-closed on missing env.
6. **ADR-041** — Migration shipped. Closes the loop with end-to-end delivery verification.

Full ADR text in `docs/decisions.md`.

## Current state (as of 2026-04-17)

- Verified working end-to-end. Inbound text on 2026-04-17 20:42:55 → Jove reply handed to Sendblue API by 20:43:01 → Sendblue's outbound-status callback confirmed DELIVERED at 20:43:05. Ten-second measurable round-trip.
- `messaging_events` rows now carry `delivered_at` on outbound Jove replies when they transition to DELIVERED.
- Signature verification active on both inbound and outbound events, using the same `SENDBLUE_WEBHOOK_SECRET`.
- PII redaction confirmed: `content` column shows only metadata markers; `raw_payload` on outbound rows is null (omitted), on inbound rows is a fields-only projection with no message body.
- Rollback flag live: `MESSAGING_PROVIDER=linq` reverts outbound without a code change.

Commit range 33f2431 → 0247e78:

- `33f2431` phone-schema alignment
- `2afda55` ADR-038 + Upstash flag
- `54245f3` inbound routing + signature verification
- `69dca2a` latency instrumentation
- `4be91db` typing indicator
- `af18e18` outbound-status probe scaffold (deleted in `7cded30`)
- `b4897bc` scaffold env-gate hardening (deleted in `7cded30`)
- `7cded30` outbound status callbacks wired to `messaging_events`
- `0247e78` quiet outbound status logs in production

## Known limitations

**Sendblue outbound queue variance.** During the latency investigation on 2026-04-17, outbound messages through Sendblue's phone-pool identifier `IC-Qb-008` showed queue delays ranging from 3.7 to 44.8 seconds between our API call returning QUEUED and Sendblue's `date_updated` timestamp on DELIVERED. Median approximately 30 seconds. This is Sendblue-internal queueing between their API ack and actual iMessage delivery, outside our instrumentation surface. Support ticket open; awaiting response on whether variance at this range is expected for dedicated lines or indicates a pool contention issue.

**Typing indicator not visible to end user.** `sendTypingIndicatorViaSendblue()` in `src/lib/messaging/sendblue.ts` fires on every verified inbound and Sendblue's API returns 200. But during end-to-end testing only about one second of typing dots was visible on the recipient iPhone before Jove's reply landed. Either Sendblue's typing API propagation to Apple's infrastructure is slow, or Apple expires the indicator quickly unless the sender refreshes it. Root cause unknown; not blocking.

**Extraction pipeline errors in the same log stream.** Unrelated bug surfaced during manual testing — the Anthropic-backed extraction layer occasionally errors and its log lines interleave with Sendblue-migration logs in Vercel runtime output. Separate issue, tracked independently. Mentioned here only so an operator reading messaging logs knows to filter by the `[sendblue-webhook]` / `[router]` / `[latency]` prefixes to separate concerns.

## Operational reference

- **Webhook URL (both event types):** `https://mywalnut.app/api/webhooks/sendblue`
- **Signing header:** `sb-signing-secret` (verified against `SENDBLUE_WEBHOOK_SECRET`)
- **Required env vars** — all must be set in Vercel across Production, Preview, and Development:
  - `SENDBLUE_API_KEY_ID` — Sendblue REST API key
  - `SENDBLUE_API_SECRET_KEY` — Sendblue REST API secret
  - `SENDBLUE_FROM_NUMBER` — our provisioned Sendblue line, E.164. Currently `+16292925296`.
  - `SENDBLUE_WEBHOOK_SECRET` — shared secret Sendblue sends as `sb-signing-secret`
  - `NEXT_PUBLIC_MESSAGING_FROM_NUMBER` — public-facing display number shown in the Settings UI
  - `MESSAGING_PROVIDER` — active 1:1 provider, `"sendblue"` or `"linq"`, defaults to `"sendblue"` when unset
- **Sendblue webhook registration:** `receive` and `outbound` are both registered with the same URL and the same secret. Verify via `GET https://api.sendblue.com/api/account/webhooks` with the API key headers.
- **Unified send entry point:** `import { sendMessage } from "@/lib/messaging/send"`. Application code must not call provider-specific clients (`sendMessageViaSendblue`, `sendMessageViaLinq`, or the Linq sender) directly.
- **Log volume per Jove reply** — operator awareness:
  - Three `[sendblue-webhook] event handle=…` lines per turn: one inbound user text, plus one outbound SENT callback and one outbound DELIVERED callback from Sendblue.
  - One `[latency] sendblue_roundtrip …` line per turn, aggregating the full inbound-to-send-ack round-trip.
  - Outbound status handler is silent on success and on idempotent no-ops (silenced in `0247e78`); error and warn paths remain loud. If an outbound row is stuck at `status=QUEUED` with no error visible in logs, check for `outbound_status_unknown_handle` warn lines or examine Vercel request logs for `POST /api/webhooks/sendblue` with `is_outbound=true` in the event log.

## Rollback procedure

Set `MESSAGING_PROVIDER=linq` in Vercel across all three scopes (Production, Preview, Development). Trigger a redeploy — Vercel env changes require a new deployment to take effect on function invocations. Verify by triggering a 1:1 outbound send (for example, the OTP flow in Settings). Confirm the message arrives from the Linq number (`+13213158194`), and `messaging_events` shows a new row with `provider='linq'` for that send.

To also revert the public-facing display number in the Settings UI, flip `NEXT_PUBLIC_MESSAGING_FROM_NUMBER` to the Linq number in the same Vercel change.

Both webhook endpoints (`/api/webhooks/sendblue` and `/api/linq/webhook`) stay permanently live, and both route to the shared Jove pipeline. Inbound traffic continues to work on whichever number the user actually texts, regardless of the flag state. Rollback does not require schema changes or data migration; Sendblue-specific columns (`delivered_at`) stay populated from pre-rollback traffic and simply do not get new writes while the flag is flipped.

## Post-migration cleanup schedule

Do not delete Linq 1:1 code before 2026-05-05 at the earliest — approximately seven days after beta launch, assuming Sendblue has been stable for that entire window. If rollback is triggered during the observation period, the clock resets.

When ready to delete (after stability observation):

- `src/lib/messaging/linq.ts` — the 1:1 Linq wrapper
- The `provider === "linq"` branch in `src/lib/messaging/send.ts`
- `MESSAGING_PROVIDER` flag infrastructure in `src/lib/messaging/provider.ts`
- `LINQ_API_TOKEN`, `LINQ_PHONE_NUMBER`, `LINQ_WEBHOOK_SECRET`, and `NEXT_PUBLIC_LINQ_PHONE_NUMBER` env vars in Vercel (all scopes)
- The 1:1 handling path inside `src/app/api/linq/webhook/route.ts` (the `handleInboundMessage` branch where `isGroup` is false). Keep everything else in that file — `handleParticipantAdded`, `handleParticipantRemoved`, `handleChatCreated`, and the `isGroup` branch all serve the group facilitator.

Do not delete during that cleanup pass:

- `src/lib/linq/sender.ts` — the group facilitator still calls this directly for outbound sends, typing, read receipts, and chat info
- `src/lib/linq/group-bridge.ts`, `group-detection.ts`, `group-state.ts`, `group-gate.ts` — all group facilitator logic
- `linq_chat_id` column on `phone_numbers` — still used by group state lookups
- `linq_group_chat_id` column on `conversations` — still used for joining group state to conversation history

## Open items carried forward (non-migration)

These surfaced during migration work but are not part of it:

1. **Upstash rate-limit env vars missing in Vercel production.** Beta-blocker per ADR-038. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are unset; the rate limiters on `/api/user/phone` and `/api/user/phone/verify` fail open. Close this before opening beta enrollment.
2. **Typing indicator visibility investigation.** See Known limitations. Not blocking, but worth root-causing before any scale that relies on the UX cue.
3. **Extraction pipeline errors.** Separate bug, separate triage track. Not part of this migration.
