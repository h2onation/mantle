"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SCORE_DIMENSIONS,
  scoreAverage,
  type ScoreResult,
} from "@/lib/scoring/dimensions";
import { formatAdminDate, adminMetaStyle } from "./admin-shared";

// Rubric scoring panel for one conversation, rendered above the admin
// transcript view. Fetches past runs on mount; the button fires one scoring
// run (a single Opus call — takes up to a minute). Observational only: the
// score never feeds back into Jove.

export interface ConversationScoreRow {
  id: string;
  conversation_id: string;
  rubric_sha: string;
  model: string;
  result: ScoreResult;
  created_at: string;
}

function scoreColor(score: number): string {
  if (score <= 2) return "var(--session-warning)";
  if (score >= 4) return "var(--session-persona)";
  return "var(--session-ink-soft)";
}

const monoLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--size-meta)",
  letterSpacing: "2px",
  textTransform: "uppercase",
  color: "var(--session-ink-ghost)",
};

export default function ConversationScorePanel({
  conversationId,
}: {
  conversationId: string;
}) {
  const [scores, setScores] = useState<ConversationScoreRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setScores([]);
    setLoaded(false);
    setError(null);
    setExpanded(false);
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/score-conversation?conversationId=${encodeURIComponent(conversationId)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setScores(data.scores || []);
      } catch (err) {
        console.error("[admin] load scores failed:", err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const runScore = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/score-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Scoring failed");
        return;
      }
      setScores((prev) => [data.score, ...prev]);
      setExpanded(true);
    } catch (err) {
      console.error("[admin] score run failed:", err);
      setError("Scoring failed — check the connection and try again");
    } finally {
      setRunning(false);
    }
  }, [conversationId]);

  const latest = scores[0] ?? null;

  return (
    <div
      style={{
        border: "1px solid var(--session-ink-hairline)",
        borderRadius: 8,
        padding: "12px 14px",
        margin: "4px 0 12px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={() => latest && setExpanded(!expanded)}
          style={{
            ...monoLabelStyle,
            background: "none",
            border: "none",
            padding: 0,
            cursor: latest ? "pointer" : "default",
            textAlign: "left" as const,
          }}
        >
          {latest ? (expanded ? "▾" : "▸") : "·"} RUBRIC SCORE
          {latest && (
            <span style={{ color: scoreColor(Math.round(scoreAverage(latest.result))) }}>
              {" "}
              {scoreAverage(latest.result).toFixed(1)}
            </span>
          )}
          {latest && (
            <span style={{ letterSpacing: "1px", textTransform: "none" }}>
              {" "}
              · {formatAdminDate(latest.created_at)} · rubric {latest.rubric_sha.slice(0, 6)}
            </span>
          )}
          {!latest && loaded && (
            <span style={{ letterSpacing: "1px", textTransform: "none" }}> — not scored</span>
          )}
        </button>
        <button
          onClick={runScore}
          disabled={running}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--size-meta)",
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: running ? "var(--session-ink-ghost)" : "var(--session-persona)",
            background: "none",
            border: "1px solid var(--session-persona-border)",
            borderRadius: 4,
            padding: "5px 8px",
            cursor: running ? "default" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {running ? "Scoring… (~1 min)" : latest ? "Re-score" : "Score session"}
        </button>
      </div>

      {error && (
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            color: "var(--session-warning)",
            marginTop: 8,
          }}
        >
          {error}
        </div>
      )}

      {expanded && latest && <ScoreDetail row={latest} />}

      {expanded && scores.length > 1 && (
        <div style={{ ...adminMetaStyle, marginTop: 10 }}>
          Earlier runs:{" "}
          {scores
            .slice(1)
            .map(
              (s) =>
                `${scoreAverage(s.result).toFixed(1)} (${formatAdminDate(s.created_at)}, rubric ${s.rubric_sha.slice(0, 6)})`,
            )
            .join(" · ")}
        </div>
      )}
    </div>
  );
}

function ScoreDetail({ row }: { row: ConversationScoreRow }) {
  const { result } = row;
  return (
    <div style={{ marginTop: 12 }}>
      {SCORE_DIMENSIONS.map((spec) => {
        const dim = result.dimensions.find((d) => d.id === spec.id);
        if (!dim) return null;
        return (
          <div
            key={spec.id}
            style={{
              display: "flex",
              gap: 10,
              padding: "7px 0",
              borderBottom: "1px solid var(--session-ink-hairline)",
              alignItems: "baseline",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "14px",
                fontWeight: 600,
                color: scoreColor(dim.score),
                width: 18,
                flexShrink: 0,
              }}
            >
              {dim.score}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--session-ink)",
                }}
              >
                {spec.label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  color: "var(--session-ink-faded)",
                  lineHeight: 1.5,
                }}
              >
                {dim.note}
                {dim.citations.length > 0 && (
                  <span style={{ fontFamily: "var(--font-mono)" }}>
                    {" "}
                    [{dim.citations.join(", ")}]
                  </span>
                )}
              </div>
              {dim.gap && (
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    color: "var(--session-ink-soft)",
                    lineHeight: 1.5,
                    marginTop: 2,
                  }}
                >
                  <span style={{ color: "var(--session-ink-ghost)" }}>Gap → </span>
                  {dim.gap}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "12px",
          color: "var(--session-ink-faded)",
          lineHeight: 1.6,
          marginTop: 10,
        }}
      >
        <div>
          <Strong>Signals:</Strong> bare-yes streak — {result.signals.bare_yes_streak}; boundary
          turn — {result.signals.boundary_turn}; corrections — {result.signals.correction_count}
        </div>
        {result.ruptures.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <Strong>Ruptures:</Strong>{" "}
            {result.ruptures
              .map(
                (r) =>
                  `${r.at} (${r.type}, ${r.repaired ? "repaired" : "unrepaired"})${r.note ? ` — ${r.note}` : ""}`,
              )
              .join(" · ")}
          </div>
        )}
        {result.predicted_bounce && (
          <div style={{ marginTop: 4 }}>
            <Strong>Predicted bounce:</Strong> {result.predicted_bounce}
          </div>
        )}
        <div style={{ marginTop: 4 }}>
          <Strong>Strongest:</Strong> {result.strongest}
        </div>
        <div style={{ marginTop: 4 }}>
          <Strong>Weakest:</Strong> {result.weakest}
        </div>
      </div>

      {result.recommendation && (
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            lineHeight: 1.6,
            color: "var(--session-ink-soft)",
            border: "1px solid var(--session-persona-border)",
            borderRadius: 6,
            padding: "8px 10px",
            marginTop: 10,
          }}
        >
          <Strong>Biggest lever:</Strong>{" "}
          <span style={{ fontFamily: "var(--font-mono)" }}>
            {result.recommendation.pattern}
          </span>{" "}
          ({result.recommendation.dimension}
          {result.recommendation.evidence.length > 0
            ? ` · ${result.recommendation.evidence.join(", ")}`
            : ""}
          ) — {result.recommendation.note}{" "}
          <span style={{ color: "var(--session-ink-ghost)" }}>
            Ledger candidate — the Tuning chart counts recurrence; one sighting
            never earns a prompt line.
          </span>
        </div>
      )}
    </div>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--session-ink-soft)", fontWeight: 500 }}>{children}</span>;
}
