-- Track 4 of docs/checkpoint-hardening-plan.md: observability.
--
-- Captures /api/checkpoint/confirm failures so we can see production
-- reliability without waiting for users to report problems. Writes are
-- fire-and-forget from the route — best-effort, never blocks the client.
-- Admin-only read (no end-user policy, service_role writes).
--
-- Structured JSON logs still go to Vercel (see src/lib/observability/log.ts)
-- with more detail per event; this table is the queryable rollup for the
-- admin Schema Health panel.

CREATE TABLE IF NOT EXISTS public.confirm_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id uuid,
  conversation_id uuid,
  error_kind text NOT NULL,
  error_detail text,
  status_code integer,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS on, no policies — service_role writes, service_role reads via the
-- admin API. anon/authenticated cannot see failures (would leak other
-- users' errors even anonymously).
ALTER TABLE public.confirm_failures ENABLE ROW LEVEL SECURITY;

-- Recent-feed queries scan by created_at DESC.
CREATE INDEX IF NOT EXISTS idx_confirm_failures_created_at
  ON public.confirm_failures (created_at DESC);

-- Per-user admin drill-down.
CREATE INDEX IF NOT EXISTS idx_confirm_failures_user_id
  ON public.confirm_failures (user_id);

-- Error-kind histogram.
CREATE INDEX IF NOT EXISTS idx_confirm_failures_error_kind_created
  ON public.confirm_failures (error_kind, created_at DESC);

COMMENT ON TABLE public.confirm_failures IS
  'Failed /api/checkpoint/confirm attempts. Fire-and-forget writes from route on any 4xx/5xx. Admin-only via service_role.';

-- Admin stats RPC — returns counts grouped by error_kind over a time
-- window, plus a total. Mirrors admin_list_migrations pattern: callable
-- only by service_role from the admin API route.
CREATE OR REPLACE FUNCTION public.admin_confirm_stats(
  p_window_seconds integer DEFAULT 86400
) RETURNS TABLE (
  total_failures bigint,
  error_kind text,
  kind_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recent AS (
    SELECT error_kind
    FROM public.confirm_failures
    WHERE created_at > now() - make_interval(secs => p_window_seconds)
  ),
  totals AS (
    SELECT COUNT(*) AS total FROM recent
  )
  SELECT
    totals.total AS total_failures,
    recent.error_kind,
    COUNT(*) AS kind_count
  FROM recent, totals
  GROUP BY totals.total, recent.error_kind
  ORDER BY kind_count DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_confirm_stats(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_confirm_stats(integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_confirm_stats(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_stats(integer) TO service_role;

-- Recent feed — last N rows, admin drill-down.
CREATE OR REPLACE FUNCTION public.admin_confirm_recent_failures(
  p_limit integer DEFAULT 20
) RETURNS TABLE (
  id uuid,
  user_id uuid,
  message_id uuid,
  conversation_id uuid,
  error_kind text,
  error_detail text,
  status_code integer,
  duration_ms integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, user_id, message_id, conversation_id,
    error_kind, error_detail, status_code, duration_ms, created_at
  FROM public.confirm_failures
  ORDER BY created_at DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.admin_confirm_recent_failures(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_confirm_recent_failures(integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_confirm_recent_failures(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_recent_failures(integer) TO service_role;
