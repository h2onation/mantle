-- Drop the dead manual_changelog table.
--
-- manual_changelog has zero application writers — manual_entries are
-- insert-only and there is no edit / version / replace flow. The admin
-- schema-map documented it as "reserved for explicit edits ... There is no
-- replace-existing flow today." Removed 2026-06-04 per the overbuild review
-- (sibling to ADR-045).
--
-- One live dependency: cleanup_stale_anonymous_users() deletes from it. We
-- recreate that function WITHOUT the manual_changelog line first, then drop
-- the table, so the cleanup job keeps working. The function body below is
-- identical to 20260417000001_fix_cleanup_function.sql minus that one DELETE.
-- (The 20260603 reorder_strengths data migration also touched the table
-- historically; that migration has already run and is unaffected.)

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

DROP TABLE IF EXISTS public.manual_changelog;
