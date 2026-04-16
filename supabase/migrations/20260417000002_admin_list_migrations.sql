-- Expose Supabase CLI's migration state to the admin dashboard.
--
-- supabase_migrations.schema_migrations lives in a non-public schema,
-- so the Supabase JS client can't query it directly without schema
-- configuration. This wrapper function lives in public and is callable
-- via .rpc('admin_list_migrations') from the admin API route.
--
-- SECURITY DEFINER: runs as the function owner (postgres), which has
-- read access to supabase_migrations. EXECUTE granted to service_role
-- only so nothing via anon/authenticated can list migrations.
-- The admin API route already enforces admin auth before calling this.

CREATE OR REPLACE FUNCTION public.admin_list_migrations()
RETURNS TABLE(version text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, supabase_migrations
AS $$
  SELECT version, name
  FROM supabase_migrations.schema_migrations
  ORDER BY version ASC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_migrations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_migrations() FROM anon;
REVOKE ALL ON FUNCTION public.admin_list_migrations() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_migrations() TO service_role;
