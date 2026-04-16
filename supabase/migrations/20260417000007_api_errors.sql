-- Beta Health panel, part 1 of 3: errors from the last 24h.
--
-- Companion to confirm_failures (domain-specific). api_errors catches
-- any uncaught 500 or thrown exception from any wrapped API route so
-- we can see silent failures users never report.
--
-- Writes are fire-and-forget from route handlers (see
-- src/lib/observability/record-api-error.ts). Admin-only read via
-- service_role RPCs.

CREATE TABLE IF NOT EXISTS public.api_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL,
  method text NOT NULL,
  status_code integer,
  error_message text,
  error_stack text,
  user_id_hash text,            -- 16-char hex from hashUserId(); no FK
  request_id text,              -- correlation with Vercel structured logs
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS on, no policies — service_role writes, service_role reads via the
-- admin API. anon/authenticated must never see cross-user errors.
ALTER TABLE public.api_errors ENABLE ROW LEVEL SECURITY;

-- Recent-feed queries scan by created_at DESC.
CREATE INDEX IF NOT EXISTS idx_api_errors_created_at
  ON public.api_errors (created_at DESC);

-- Per-route drill-down + histogram.
CREATE INDEX IF NOT EXISTS idx_api_errors_route_created
  ON public.api_errors (route, created_at DESC);

COMMENT ON TABLE public.api_errors IS
  'Uncaught API route errors. Fire-and-forget writes from route handlers. Admin-only via service_role.';

-- Stats RPC: counts grouped by route over a time window, plus a total.
-- Mirrors admin_confirm_stats pattern.
CREATE OR REPLACE FUNCTION public.admin_api_error_stats(
  p_window_seconds integer DEFAULT 86400
) RETURNS TABLE (
  total_errors bigint,
  route text,
  route_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recent AS (
    SELECT route
    FROM public.api_errors
    WHERE created_at > now() - make_interval(secs => p_window_seconds)
  ),
  totals AS (
    SELECT COUNT(*) AS total FROM recent
  )
  SELECT
    totals.total AS total_errors,
    recent.route,
    COUNT(*) AS route_count
  FROM recent, totals
  GROUP BY totals.total, recent.route
  ORDER BY route_count DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_api_error_stats(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_api_error_stats(integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_api_error_stats(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_api_error_stats(integer) TO service_role;

-- Recent feed — last N rows, admin drill-down.
CREATE OR REPLACE FUNCTION public.admin_api_error_recent(
  p_limit integer DEFAULT 50
) RETURNS TABLE (
  id uuid,
  route text,
  method text,
  status_code integer,
  error_message text,
  user_id_hash text,
  request_id text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, route, method, status_code, error_message,
    user_id_hash, request_id, created_at
  FROM public.api_errors
  ORDER BY created_at DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.admin_api_error_recent(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_api_error_recent(integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_api_error_recent(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_api_error_recent(integer) TO service_role;
