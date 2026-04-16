import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ErrorKindCount {
  error_kind: string;
  count: number;
}

interface RecentFailure {
  id: string;
  user_id: string;
  message_id: string | null;
  conversation_id: string | null;
  error_kind: string;
  error_detail: string | null;
  status_code: number | null;
  duration_ms: number | null;
  created_at: string;
}

interface ConfirmStatsResponse {
  windowSeconds: number;
  totalFailures: number;
  byKind: ErrorKindCount[];
  recent: RecentFailure[];
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

  // Parallel queries: stats rollup + recent feed.
  const [{ data: statsRows, error: statsError }, { data: recentRows, error: recentError }] =
    await Promise.all([
      admin.rpc("admin_confirm_stats", { p_window_seconds: windowSeconds }),
      admin.rpc("admin_confirm_recent_failures", { p_limit: 20 }),
    ]);

  if (statsError) {
    console.error("[admin/confirm-stats] stats RPC error:", statsError);
    return Response.json(
      { error: "Failed to query confirm stats" },
      { status: 500 }
    );
  }
  if (recentError) {
    console.error("[admin/confirm-stats] recent RPC error:", recentError);
    return Response.json(
      { error: "Failed to query recent failures" },
      { status: 500 }
    );
  }

  // statsRows is a flattened "(total_failures, error_kind, kind_count)[]"
  // where total_failures is duplicated on every row. Normalize.
  type StatsRow = {
    total_failures: number;
    error_kind: string;
    kind_count: number;
  };
  const rows = (statsRows || []) as StatsRow[];
  const totalFailures = rows[0]?.total_failures ?? 0;
  const byKind: ErrorKindCount[] = rows.map((r) => ({
    error_kind: r.error_kind,
    count: Number(r.kind_count) || 0,
  }));

  const response: ConfirmStatsResponse = {
    windowSeconds,
    totalFailures: Number(totalFailures) || 0,
    byKind,
    recent: (recentRows || []) as RecentFailure[],
    checkedAt: new Date().toISOString(),
  };

  return Response.json(response);
}
