-- Structure migration — STEP 3 (code cutover) schema half.
--
-- 1. `layer` becomes NULLABLE. New entries are born under the section model
--    with a NULL layer (the pattern-type concept is gone for new rows).
--    EXISTING rows keep their frozen layer — no data is touched. This honors
--    the data-freeze (no value overwritten) while letting new + parked entries
--    omit a layer. (Judgment call, structure-migration Step 3.)
-- 2. confirm_checkpoint_write gains p_section / p_tags so new entries persist
--    their section + tags. p_layer is now nullable.
-- 3. extraction_state null-out: recently-active conversations have their
--    ephemeral extraction_state cleared so the first post-deploy turn rebuilds
--    under the section model instead of rendering stale layer-id signals under
--    new section labels (the decided one-turn mitigation, plan §6).

-- ── 1. layer nullable + widened CHECK ───────────────────────────────────────
ALTER TABLE public.manual_entries ALTER COLUMN layer DROP NOT NULL;
ALTER TABLE public.manual_entries DROP CONSTRAINT IF EXISTS manual_components_layer_check;
ALTER TABLE public.manual_entries
  ADD CONSTRAINT manual_components_layer_check
  CHECK (layer IS NULL OR layer = ANY (ARRAY[1, 2, 3, 4, 5]));

-- ── 2. confirm_checkpoint_write: add p_section, p_tags; p_layer nullable ─────
-- Drop the prior signature explicitly (Postgres overloads by signature).
DROP FUNCTION IF EXISTS public.confirm_checkpoint_write(uuid, uuid, integer, text, text, text, text[]);

CREATE OR REPLACE FUNCTION public.confirm_checkpoint_write(
  p_message_id uuid,
  p_user_id uuid,
  p_layer integer,
  p_section text,
  p_tags text[],
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
    RAISE EXCEPTION 'checkpoint_not_found' USING ERRCODE = 'P0002';
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
    RAISE EXCEPTION 'checkpoint_not_pending' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.manual_entries
    (user_id, layer, section, tags, name, content, source_message_id, summary, key_words)
  VALUES
    (p_user_id, p_layer, p_section, COALESCE(p_tags, '{}'::text[]), p_name, p_content, p_message_id, p_summary, p_key_words)
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

REVOKE ALL ON FUNCTION public.confirm_checkpoint_write(uuid, uuid, integer, text, text[], text, text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_checkpoint_write(uuid, uuid, integer, text, text[], text, text, text, text[]) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_checkpoint_write(uuid, uuid, integer, text, text[], text, text, text, text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_checkpoint_write(uuid, uuid, integer, text, text[], text, text, text, text[]) TO service_role;

COMMENT ON FUNCTION public.confirm_checkpoint_write IS
  'Atomic checkpoint confirm: inserts manual_entries row (with section + tags), updates status, inserts system message. Idempotent.';

-- ── 3. extraction_state null-out at cutover (decided mitigation, plan §6) ────
UPDATE public.conversations
SET extraction_state = NULL
WHERE updated_at > now() - interval '24 hours';
