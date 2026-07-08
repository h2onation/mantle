"use client";

import { useCallback, useEffect, useState } from "react";
import OverrideFieldEditor from "./OverrideFieldEditor";

// Edit surface for the conversation-scoring rubric — same override semantics
// as every other tunable text: the repo doc (docs/reference/conductor-scoring.md)
// is the floor, an enabled override wins, Reset returns to the doc. Backed by
// /api/admin/scoring-rubric. Editing the rubric changes its fingerprint, so
// runs before and after an edit stop being comparable on the trend chart —
// the panel says so.

interface RubricField {
  key: string;
  label: string;
  default: string;
  override: string | null;
  enabled: boolean;
}

export default function ScoringRubricPanel() {
  const [field, setField] = useState<RubricField | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/scoring-rubric");
      if (!res.ok) {
        setError("Could not load the rubric.");
        return;
      }
      const d = await res.json();
      const f = d?.field as RubricField | undefined;
      if (!f) {
        setError("Could not load the rubric.");
        return;
      }
      setField(f);
      setDraft(f.enabled && f.override !== null ? f.override : f.default);
    } catch {
      setError("Could not load the rubric.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/scoring-rubric", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Save failed");
      setNotice(
        body.reset
          ? "Reset — scoring runs use the shipped rubric doc again."
          : "Saved — the next scoring run uses this version (new fingerprint; earlier scores stop being comparable).",
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!field) {
    return (
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "12.5px",
          color: error ? "var(--session-error-text)" : "var(--session-walnut-meta-soft)",
        }}
      >
        {error || "Loading…"}
      </div>
    );
  }

  const liveText = field.enabled && field.override !== null ? field.override : field.default;

  return (
    <div
      style={{
        border: "1px solid var(--session-walnut-border)",
        background: "var(--session-walnut-surface)",
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      <OverrideFieldEditor
        label={field.label}
        value={draft}
        isEdited={field.enabled && field.override !== null}
        dirty={draft !== liveText}
        busy={busy}
        rows={24}
        onChange={setDraft}
        onSave={() => patch({ text: draft })}
        onReset={() => patch({ reset: true })}
      />
      {(error || notice) && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            lineHeight: 1.5,
            color: error ? "var(--session-error-text)" : "var(--session-persona)",
            margin: "10px 0 0",
          }}
        >
          {error || notice}
        </p>
      )}
    </div>
  );
}
