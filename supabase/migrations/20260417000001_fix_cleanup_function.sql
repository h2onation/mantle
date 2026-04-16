-- Fix cleanup_stale_anonymous_users() function body.
--
-- The function was written when the table was called `manual_components`,
-- but that table was renamed to `manual_entries` in
-- 20260415_rename_manual_components_to_entries.sql. The function body
-- was never updated — it would fail at runtime with "relation
-- manual_components does not exist" if ever called.
--
-- Discovered while generating the 20260417 squash baseline: a grep of
-- the dump output caught this line inside the function body.
--
-- Function is called manually or via cron (per the original intent in
-- supabase/admin-migration.sql). No known production call to date, but
-- we fix it now so the cleanup actually works when someone runs it.

CREATE OR REPLACE FUNCTION public.cleanup_stale_anonymous_users() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  stale_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO stale_ids
  FROM auth.users
  WHERE is_anonymous = true
  AND created_at < now() - interval '7 days';

  IF stale_ids IS NULL OR array_length(stale_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM admin_access_logs WHERE target_user_id = ANY(stale_ids);
  DELETE FROM manual_changelog WHERE user_id = ANY(stale_ids);
  DELETE FROM manual_entries WHERE user_id = ANY(stale_ids);
  DELETE FROM messages WHERE conversation_id IN (
    SELECT id FROM conversations WHERE user_id = ANY(stale_ids)
  );
  DELETE FROM conversations WHERE user_id = ANY(stale_ids);
  DELETE FROM profiles WHERE id = ANY(stale_ids);
  DELETE FROM auth.users WHERE id = ANY(stale_ids);

  RAISE LOG 'Cleaned up % stale anonymous users', array_length(stale_ids, 1);
END;
$$;
