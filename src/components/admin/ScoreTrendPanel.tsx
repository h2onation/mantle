"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SCORE_DIMENSIONS,
  scoreAverage,
  type ScoreResult,
} from "@/lib/scoring/dimensions";
import { formatAdminDate } from "./admin-shared";

// Score trend for the Tuning page: six small-multiple rows (one per rubric
// dimension, fixed 1–5 axis, single accent hue) over session time, with a
// vertical marker wherever the conductor prompt was edited — the
// edit-the-prompt → did-the-lines-move loop. Data: GET ?view=trend on the
// scoring route. The batch button works through ?view=unscored one session
// at a time from the client, so each request stays one model call.

interface TrendScore {
  id: string;
  conversation_id: string;
  rubric_sha: string;
  result: ScoreResult;
  created_at: string;
}

interface Point {
  x: number; // 0–100 (% of time domain)
  score: number;
  createdAt: string;
  rubricSha: string;
}

const panelText: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "12.5px",
  lineHeight: 1.5,
  color: "var(--session-walnut-meta)",
};

const smallButton = (active: boolean): React.CSSProperties => ({
  fontFamily: "var(--font-sans)",
  fontSize: "12px",
  padding: "4px 12px",
  borderRadius: 999,
  border: "1px solid var(--session-walnut-border)",
  background: active ? "var(--session-persona-tint)" : "var(--session-walnut-surface)",
  color: active ? "var(--session-persona)" : "var(--session-walnut-meta-strong)",
  cursor: "pointer",
});

export default function ScoreTrendPanel() {
  const [scores, setScores] = useState<TrendScore[]>([]);
  const [promptEdits, setPromptEdits] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<"chart" | "table">("chart");

  // Batch scoring: idle → armed (count known) → running (i/n).
  const [batch, setBatch] = useState<
    | { state: "idle" }
    | { state: "arming" }
    | { state: "armed"; ids: string[] }
    | { state: "running"; done: number; total: number; failed: number }
  >({ state: "idle" });
  const [batchNote, setBatchNote] = useState<string | null>(null);

  const loadTrend = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/score-conversation?view=trend");
      if (!res.ok) return;
      const data = await res.json();
      setScores(data.scores || []);
      setPromptEdits(data.promptEdits || []);
    } catch (err) {
      console.error("[admin] load score trend failed:", err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

  // Latest run per conversation (re-scores replace, never double-plot),
  // in time order.
  const sessions = useMemo(() => {
    const byConv = new Map<string, TrendScore>();
    for (const s of scores) byConv.set(s.conversation_id, s); // oldest→newest; last wins
    return Array.from(byConv.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [scores]);

  // Shared time domain across all rows, padded so edge points don't clip.
  const domain = useMemo(() => {
    if (sessions.length === 0) return null;
    const times = sessions.map((s) => new Date(s.created_at).getTime());
    let min = Math.min(...times);
    let max = Math.max(...times);
    if (min === max) {
      min -= 86_400_000;
      max += 86_400_000;
    }
    const pad = (max - min) * 0.04;
    return { min: min - pad, max: max + pad };
  }, [sessions]);

  const toX = useCallback(
    (iso: string) => {
      if (!domain) return 0;
      const t = new Date(iso).getTime();
      return ((t - domain.min) / (domain.max - domain.min)) * 100;
    },
    [domain],
  );

  const editMarkers = useMemo(
    () =>
      domain
        ? promptEdits
            .filter((iso) => {
              const t = new Date(iso).getTime();
              return t >= domain.min && t <= domain.max;
            })
            .map((iso) => ({ iso, x: toX(iso) }))
        : [],
    [promptEdits, domain, toX],
  );

  async function armBatch() {
    setBatch({ state: "arming" });
    setBatchNote(null);
    try {
      const res = await fetch("/api/admin/score-conversation?view=unscored");
      const data = await res.json();
      const ids: string[] = (data.conversations || []).map((c: { id: string }) => c.id);
      if (ids.length === 0) {
        setBatch({ state: "idle" });
        setBatchNote("Nothing to score — every completed session with enough turns has a score.");
        return;
      }
      setBatch({ state: "armed", ids });
    } catch {
      setBatch({ state: "idle" });
      setBatchNote("Could not load the unscored list — try again.");
    }
  }

  async function runBatch(ids: string[]) {
    let failed = 0;
    setBatch({ state: "running", done: 0, total: ids.length, failed });
    // Sequential on purpose: one Opus call in flight at a time.
    for (let i = 0; i < ids.length; i++) {
      try {
        const res = await fetch("/api/admin/score-conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: ids[i] }),
        });
        if (!res.ok) failed += 1;
      } catch {
        failed += 1;
      }
      setBatch({ state: "running", done: i + 1, total: ids.length, failed });
    }
    setBatch({ state: "idle" });
    setBatchNote(
      failed === 0
        ? `Scored ${ids.length} session${ids.length === 1 ? "" : "s"}.`
        : `Scored ${ids.length - failed} of ${ids.length} — ${failed} failed (re-run to retry).`,
    );
    loadTrend();
  }

  return (
    <div
      style={{
        border: "1px solid var(--session-walnut-border)",
        background: "var(--session-walnut-surface)",
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 28,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--session-walnut-meta-soft)",
          }}
        >
          Session scores over time
        </div>
        <span style={{ flex: 1 }} />
        {sessions.length > 0 && (
          <button onClick={() => setView(view === "chart" ? "table" : "chart")} style={smallButton(false)}>
            {view === "chart" ? "Table" : "Chart"}
          </button>
        )}
        {batch.state === "idle" && (
          <button onClick={armBatch} style={smallButton(false)}>
            Score unscored sessions
          </button>
        )}
        {batch.state === "arming" && (
          <span style={panelText}>Checking…</span>
        )}
        {batch.state === "armed" && (
          <>
            <button onClick={() => runBatch(batch.ids)} style={smallButton(true)}>
              Run {batch.ids.length} scoring call{batch.ids.length === 1 ? "" : "s"} (~1 min each)
            </button>
            <button onClick={() => setBatch({ state: "idle" })} style={smallButton(false)}>
              Cancel
            </button>
          </>
        )}
        {batch.state === "running" && (
          <span style={{ ...panelText, color: "var(--session-persona)" }}>
            Scoring {batch.done}/{batch.total}
            {batch.failed > 0 ? ` (${batch.failed} failed)` : ""}…
          </span>
        )}
      </div>

      {batchNote && <div style={{ ...panelText, marginTop: 8 }}>{batchNote}</div>}

      {loaded && sessions.length === 0 && (
        <div style={{ ...panelText, marginTop: 10 }}>
          No scored sessions yet. Score one from a transcript (Users → open a
          session → Score session), or use the batch button above.
        </div>
      )}

      {sessions.length > 0 && view === "chart" && (
        <TrendChart sessions={sessions} editMarkers={editMarkers} toX={toX} />
      )}
      {sessions.length > 0 && view === "table" && <TrendTable sessions={sessions} />}

      {sessions.length > 0 && (
        <div style={{ ...panelText, marginTop: 10, color: "var(--session-walnut-meta-soft)" }}>
          One point per scored session (latest run wins) on a fixed 1–5 axis.
          <span style={{ color: "var(--session-warning)" }}> ¦ </span>
          marks a conductor-prompt edit — the question is whether the lines move
          after it. Runs under different rubric versions aren&rsquo;t comparable;
          hover a point for its rubric fingerprint.
        </div>
      )}
    </div>
  );
}

function TrendChart({
  sessions,
  editMarkers,
  toX,
}: {
  sessions: TrendScore[];
  editMarkers: { iso: string; x: number }[];
  toX: (iso: string) => number;
}) {
  const [tooltip, setTooltip] = useState<{
    rowIdx: number;
    xPct: number;
    text: string;
  } | null>(null);

  return (
    <div style={{ marginTop: 12 }}>
      {SCORE_DIMENSIONS.map((spec, rowIdx) => {
        const points: Point[] = sessions
          .map((s) => {
            const dim = s.result.dimensions.find((d) => d.id === spec.id);
            return dim
              ? {
                  x: toX(s.created_at),
                  score: dim.score,
                  createdAt: s.created_at,
                  rubricSha: s.rubric_sha,
                }
              : null;
          })
          .filter((p): p is Point => p !== null);
        // y: score 1 at bottom (88%), 5 at top (12%) — 1–5 fixed domain.
        const toY = (score: number) => 88 - ((score - 1) / 4) * 76;

        return (
          <div key={spec.id} style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
            <div
              style={{
                width: 150,
                flexShrink: 0,
                fontFamily: "var(--font-sans)",
                fontSize: "11.5px",
                color: "var(--session-walnut-meta-strong)",
                display: "flex",
                alignItems: "center",
              }}
            >
              {spec.id} · {spec.label}
            </div>
            <div
              style={{
                flex: 1,
                position: "relative",
                height: 52,
                borderBottom: "1px solid var(--session-walnut-border-soft)",
                minWidth: 0,
              }}
            >
              {/* midline (score 3) */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "50%",
                  borderTop: "1px dotted var(--session-walnut-border-soft)",
                }}
              />
              {/* prompt-edit markers */}
              {editMarkers.map((m) => (
                <div
                  key={m.iso}
                  title={rowIdx === 0 ? `Prompt edited ${formatAdminDate(m.iso)}` : undefined}
                  style={{
                    position: "absolute",
                    left: `${m.x}%`,
                    top: 2,
                    bottom: 2,
                    borderLeft: "1px dashed var(--session-warning)",
                    opacity: 0.6,
                  }}
                />
              ))}
              {/* connecting line */}
              {points.length > 1 && (
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                >
                  <polyline
                    points={points.map((p) => `${p.x},${toY(p.score)}`).join(" ")}
                    fill="none"
                    stroke="var(--session-persona)"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    opacity={0.55}
                  />
                </svg>
              )}
              {/* points — HTML dots so hover targets stay ≥8px circles */}
              {points.map((p) => (
                <div
                  key={p.createdAt + p.x}
                  onMouseEnter={() =>
                    setTooltip({
                      rowIdx,
                      xPct: p.x,
                      text: `${spec.id}: ${p.score} · ${formatAdminDate(p.createdAt)} · rubric ${p.rubricSha.slice(0, 6)}`,
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    position: "absolute",
                    left: `${p.x}%`,
                    top: `${toY(p.score)}%`,
                    width: 9,
                    height: 9,
                    marginLeft: -4.5,
                    marginTop: -4.5,
                    borderRadius: "50%",
                    background: "var(--session-persona)",
                    border: "2px solid var(--session-walnut-surface)",
                    boxSizing: "border-box",
                    cursor: "default",
                  }}
                />
              ))}
              {/* tooltip for this row */}
              {tooltip && tooltip.rowIdx === rowIdx && (
                <div
                  style={{
                    position: "absolute",
                    left: `${Math.min(tooltip.xPct, 70)}%`,
                    bottom: "100%",
                    marginBottom: 2,
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    whiteSpace: "nowrap",
                    color: "var(--session-ink)",
                    background: "var(--session-walnut-surface)",
                    border: "1px solid var(--session-walnut-border)",
                    borderRadius: 6,
                    padding: "3px 8px",
                    zIndex: 2,
                    pointerEvents: "none",
                  }}
                >
                  {tooltip.text}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {/* time axis: first and last session dates */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginLeft: 162,
          marginTop: 4,
          fontFamily: "var(--font-mono)",
          fontSize: "10.5px",
          color: "var(--session-walnut-meta-soft)",
        }}
      >
        <span>{formatAdminDate(sessions[0].created_at)}</span>
        <span>{formatAdminDate(sessions[sessions.length - 1].created_at)}</span>
      </div>
    </div>
  );
}

function TrendTable({ sessions }: { sessions: TrendScore[] }) {
  const cell: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "11.5px",
    color: "var(--session-walnut-meta-strong)",
    padding: "5px 10px 5px 0",
    textAlign: "left" as const,
  };
  return (
    <div style={{ marginTop: 12, overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--session-walnut-border)" }}>
            <th style={cell}>scored</th>
            {SCORE_DIMENSIONS.map((d) => (
              <th key={d.id} style={cell} title={d.label}>
                {d.id}
              </th>
            ))}
            <th style={cell}>avg</th>
            <th style={cell}>rubric</th>
          </tr>
        </thead>
        <tbody>
          {[...sessions].reverse().map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid var(--session-walnut-border-soft)" }}>
              <td style={cell}>{formatAdminDate(s.created_at)}</td>
              {SCORE_DIMENSIONS.map((spec) => (
                <td key={spec.id} style={cell}>
                  {s.result.dimensions.find((d) => d.id === spec.id)?.score ?? "—"}
                </td>
              ))}
              <td style={cell}>{scoreAverage(s.result).toFixed(1)}</td>
              <td style={cell}>{s.rubric_sha.slice(0, 6)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
