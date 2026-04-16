-- Track 2 of docs/checkpoint-hardening-plan.md:
-- Make the checkpoint confirm path idempotent and transactional.
--
-- Before this migration:
-- - confirm-checkpoint.ts did THREE separate DB writes (insert entry,
--   update message status, insert system message). No transaction.
--   Partial failure left the system in an inconsistent state.
-- - "Already confirmed" was treated as an error and returned 500 to
--   the user. A retry after a flaky-network blip would fail loudly.
-- - No unique constraint on (user_id, source_message_id). Concurrent
--   confirms could create duplicate manual_entries rows.
--
-- After this migration:
-- - Partial unique index prevents duplicate rows for the same source
--   checkpoint. Partial so dev-populate rows (null source_message_id)
--   are unaffected.
-- - confirm_checkpoint_write() runs all three writes in one transaction
--   with FOR UPDATE locking on the message row. Idempotent: repeat
--   calls with the same message_id return the existing entry id and
--   was_already_confirmed=true, not an error.
--
-- Pre-flight requirement: no existing duplicate rows. This migration
-- uses CREATE UNIQUE INDEX IF NOT EXISTS, which fails loudly if there
-- are duplicates.

-- ── Partial unique index ────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS manual_entries_user_source_msg_uniq
  ON public.manual_entries (user_id, source_message_id)
  WHERE source_message_id IS NOT NULL;

COMMENT ON INDEX public.manual_entries_user_source_msg_uniq IS
  'Prevents duplicate manual_entries rows for the same source checkpoint. Partial so populate-shaped rows (null source) are allowed.';

-- ── Transactional confirm function ──────────────────────────────────────────
-- Returns (entry_id uuid, was_already_confirmed boolean). Signals errors
-- via RAISE EXCEPTION with specific SQLSTATE codes the TS caller parses:
--   P0002 checkpoint_not_found  — message missing or not a checkpoint
--   P0001 checkpoint_not_pending — status is 'rejected' or 'refined'

CREATE OR REPLACE FUNCTION public.confirm_checkpoint_write(
  p_message_id uuid,
  p_user_id uuid,
  p_layer integer,
  p_name text,
  p_content text,
  p_summary text,
  p_key_words text[]
) RETURNS TABLE (entry_id uuid, was_already_confirmed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_conversation_id uuid;
  v_existing_entry uuid;
  v_new_entry uuid;
BEGIN
  -- Lock the message row for the duration of this transaction so a
  -- concurrent confirm on the same checkpoint blocks here and sees the
  -- flipped status on retry.
  SELECT
    checkpoint_meta->>'status',
    conversation_id
  INTO v_status, v_conversation_id
  FROM public.messages
  WHERE id = p_message_id AND is_checkpoint = true
  FOR UPDATE;

  IF v_status IS NULL THEN
    -- Message doesn't exist, or is_checkpoint = false, or no checkpoint_meta.
    RAISE EXCEPTION 'checkpoint_not_found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Already confirmed → idempotent success. Return the existing entry id.
  IF v_status = 'confirmed' THEN
    SELECT id INTO v_existing_entry
    FROM public.manual_entries
    WHERE user_id = p_user_id AND source_message_id = p_message_id
    LIMIT 1;
    RETURN QUERY SELECT v_existing_entry, true;
    RETURN;
  END IF;

  -- Rejected or refined → terminal non-confirm state; surface to caller.
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'checkpoint_not_pending'
      USING ERRCODE = 'P0001';
  END IF;

  -- Insert the entry. The partial unique index enforces at most one row
  -- per (user_id, source_message_id). DO NOTHING + fallback SELECT
  -- handles the edge case where a concurrent insert beat us here
  -- (shouldn't happen thanks to FOR UPDATE, but belt-and-suspenders).
  INSERT INTO public.manual_entries
    (user_id, layer, name, content, source_message_id, summary, key_words)
  VALUES
    (p_user_id, p_layer, p_name, p_content, p_message_id, p_summary, p_key_words)
  ON CONFLICT (user_id, source_message_id) WHERE source_message_id IS NOT NULL
    DO NOTHING
  RETURNING id INTO v_new_entry;

  IF v_new_entry IS NULL THEN
    SELECT id INTO v_new_entry
    FROM public.manual_entries
    WHERE user_id = p_user_id AND source_message_id = p_message_id
    LIMIT 1;
  END IF;

  -- Flip the meta status to 'confirmed'.
  UPDATE public.messages
  SET checkpoint_meta = jsonb_set(checkpoint_meta, '{status}', '"confirmed"')
  WHERE id = p_message_id;

  -- Insert the system message so Jove's next turn sees the confirmation.
  INSERT INTO public.messages (conversation_id, role, content)
  VALUES (v_conversation_id, 'system', '[User confirmed the checkpoint]');

  RETURN QUERY SELECT v_new_entry, false;
END;
$$;

-- Admin-only access via service_role (mirrors admin_list_migrations pattern).
REVOKE ALL ON FUNCTION public.confirm_checkpoint_write(uuid, uuid, integer, text, text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_checkpoint_write(uuid, uuid, integer, text, text, text, text[]) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_checkpoint_write(uuid, uuid, integer, text, text, text, text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_checkpoint_write(uuid, uuid, integer, text, text, text, text[]) TO service_role;

COMMENT ON FUNCTION public.confirm_checkpoint_write IS
  'Atomic checkpoint confirm: inserts manual_entries row, updates message status to confirmed, inserts system message. Idempotent — repeat calls with the same message_id return the existing entry id and was_already_confirmed=true. Errors: P0002 checkpoint_not_found, P0001 checkpoint_not_pending.';
