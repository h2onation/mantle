// Admin-only endpoint: returns uncaught API errors (api_errors table)
// grouped by route over a time window, plus a recent feed. Mirrors the
// shape and guard pattern of /api/admin/confirm-stats.

import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteCount {
  route: string;
  count: number;
}

interface RecentError {
  id: string;
  route: string;
  method: string;
  status_code: number | null;
  error_message: string | null;
  user_id_hash: string | null;
  request_id: string | null;
  created_at: string;
}

interface ApiErrorStatsResponse {
  windowSeconds: number;
  totalErrors: number;
  byRoute: RouteCount[];
  recent: RecentError[];
  checkedAt: string;
}

export async function GET(request: Request): Promise<Response> {
  const { isAdmin } = await verifyAdmin();
  if (!isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const windowSecondsRaw = url.searchParams.get("windowSeconds");
  const windowSeconds = Math.max(
    60,
    Math.min(7 * 24 * 3600, parseInt(windowSecondsRaw || "86400", 10) || 86400)
  );

  const admin = createAdminClient();

  const [{ data: statsRows, error: statsError }, { data: recentRows, error: recentError }] =
    await Promise.all([
      admin.rpc("admin_api_error_stats", { p_window_seconds: windowSeconds }),
      admin.rpc("admin_api_error_recent", { p_limit: 50 }),
    ]);

  if (statsError) {
    console.error("[admin/errors] stats RPC error:", statsError);
    return Response.json(
      { error: "Failed to query error stats" },
      { status: 500 }
    );
  }
  if (recentError) {
    console.error("[admin/errors] recent RPC error:", recentError);
    return Response.json(
      { error: "Failed to query recent errors" },
      { status: 500 }
    );
  }

  // statsRows is a flattened "(total_errors, route, route_count)[]"
  // where total_errors is duplicated on every row. Normalize.
  type StatsRow = {
    total_errors: number;
    route: string;
    route_count: number;
  };
  const rows = (statsRows || []) as StatsRow[];
  const totalErrors = rows[0]?.total_errors ?? 0;
  const byRoute: RouteCount[] = rows.map((r) => ({
    route: r.route,
    count: Number(r.route_count) || 0,
  }));

  const response: ApiErrorStatsResponse = {
    windowSeconds,
    totalErrors: Number(totalErrors) || 0,
    byRoute,
    recent: (recentRows || []) as RecentError[],
    checkedAt: new Date().toISOString(),
  };

  return Response.json(response);
}
