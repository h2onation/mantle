-- Remove so_what as a separate field. The "what changes now" content is
-- merged into the entry's prose (the content column) instead of living
-- in its own column. This migration:
--   1. Drops the so_what column if it exists (it was never applied to prod).
--   2. Recreates confirm_checkpoint_write without the p_so_what parameter.

ALTER TABLE public.manual_entries DROP COLUMN IF EXISTS so_what;

-- Drop all overloaded signatures so the CREATE below is clean.
DROP FUNCTION IF EXISTS public.confirm_checkpoint_write(uuid, uuid, integer, text, text, text, text, text[]);
DROP FUNCTION IF EXISTS public.confirm_checkpoint_write(uuid, uuid, integer, text, text, text, text[]);

CREATE OR REPLACE FUNCTION public.confirm_checkpoint_write(
  p_message_id uuid,
  p_user_id uuid,
  p_layer integer,
  p_name text,
  p_content text,
  p_summary text DEFAULT NULL,
  p_key_words text[] DEFAULT NULL
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
  SELECT
    checkpoint_meta->>'status',
    conversation_id
  INTO v_status, v_conversation_id
  FROM public.messages
  WHERE id = p_message_id AND is_checkpoint = true
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'checkpoint_not_found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_status = 'confirmed' THEN
    SELECT id INTO v_existing_entry
    FROM public.manual_entries
    WHERE user_id = p_user_id AND source_message_id = p_message_id
    LIMIT 1;
    RETURN QUERY SELECT v_existing_entry, true;
    RETURN;
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'checkpoint_not_pending'
      USING ERRCODE = 'P0001';
  END IF;

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

  UPDATE public.messages
  SET checkpoint_meta = jsonb_set(checkpoint_meta, '{status}', '"confirmed"')
  WHERE id = p_message_id;

  INSERT INTO public.messages (conversation_id, role, content)
  VALUES (v_conversation_id, 'system', '[User confirmed the checkpoint]');

  RETURN QUERY SELECT v_new_entry, false;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_checkpoint_write(uuid, uuid, integer, text, text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_checkpoint_write(uuid, uuid, integer, text, text, text, text[]) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_checkpoint_write(uuid, uuid, integer, text, text, text, text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_checkpoint_write(uuid, uuid, integer, text, text, text, text[]) TO service_role;

COMMENT ON FUNCTION public.confirm_checkpoint_write IS
  'Atomic checkpoint confirm: inserts manual_entries row, updates message status to confirmed, inserts system message. Idempotent.';
