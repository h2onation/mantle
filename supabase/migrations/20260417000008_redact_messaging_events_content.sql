-- Redact pre-fix content from messaging_events.content.
--
-- Context (ADR-037):
--   The initial messaging_events schema (20260417000005) stored full message
--   text in the `content` column for debugging convenience. Review at
--   Checkpoint E of the Sendblue migration identified this as a CLAUDE.md
--   Security Rule violation ("Never log user message content, phone numbers,
--   or auth tokens."). ADR-037 switched the column to metadata-only going
--   forward.
--
-- This migration purges any legacy rows so historical message content does
-- not persist in the audit table. It is idempotent: only rows whose content
-- is not already in a marker shape (e.g. "[OTP_SEND]", "[USER_MSG len=N]",
-- "[JOVE_REPLY len=N]", "[SYSTEM_MSG len=N]") are touched, so re-running is a
-- no-op.

update public.messaging_events
set content = null
where content is not null
  and content not like '[%';
