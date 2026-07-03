"use client";

import { useEffect, useState } from "react";

// One tunable dial as the API returns it.
interface TuningField {
  field: string;
  label: string;
  help: string;
  kind: "int";
  default: number;
  value: number;
  edited: boolean;
  min: number;
  max: number;
}

export default function CheckpointTuningPanel() {
  const [fields, setFields] = useState<TuningField[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, number | string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/checkpoint-tuning")
      .then((r) => r.json())
      .then((d) => {
        if (d?.fields) {
          setFields(d.fields);
          const seed: Record<string, number | string> = {};
          for (const f of d.fields as TuningField[]) seed[f.field] = f.value;
          setDrafts(seed);
        }
      })
      .catch(() => setError("Could not load the meter dial."));
  }

  useEffect(() => {
    load();
  }, []);

  async function save(field: string) {
    setPending(field);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/checkpoint-tuning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value: drafts[field] }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Save failed");
      setNotice("Saved. Live on the user's next message.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setPending(null);
    }
  }

  async function reset(field: string) {
    setPending(field);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/checkpoint-tuning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, reset: true }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Reset failed");
      setNotice("Reset to the shipped default. Live on the user's next message.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--session-walnut-border)",
        background: "var(--session-walnut-surface)",
        borderRadius: 12,
        padding: "18px 20px",
        marginBottom: 28,
      }}
    >
      <div style={{ marginBottom: 4 }}>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--session-walnut-meta-strong)",
          }}
        >
          Reflection meter dial
        </span>
      </div>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          lineHeight: 1.5,
          color: "var(--session-walnut-meta)",
          margin: "0 0 16px",
        }}
      >
        Paces the reflection meter&rsquo;s recharge after a save — no deploy.
        Capture is pull-only: the user taps the meter and the entry composes.
        Saving takes effect on the next user message. The shipped code is the
        floor: Reset returns the dial instantly.
      </p>

      {fields === null && !error && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--session-walnut-meta-soft)",
            margin: 0,
          }}
        >
          Loading…
        </p>
      )}

      {fields?.map((f, i) => {
        const busy = pending === f.field;
        const draft = drafts[f.field] ?? f.value;
        const dirty = String(draft) !== String(f.value);
        return (
          <div
            key={f.field}
            style={{
              padding: "14px 0",
              borderTop:
                i === 0 ? "none" : "1px solid var(--session-walnut-border-soft)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--session-ink)",
                }}
              >
                {f.label}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  color: f.edited
                    ? "var(--session-persona)"
                    : "var(--session-walnut-meta-soft)",
                }}
              >
                {f.edited ? "EDITED" : "DEFAULT"}
              </span>
            </div>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                lineHeight: 1.45,
                color: "var(--session-walnut-meta)",
                margin: "0 0 8px",
              }}
            >
              {f.help}{" "}
              <span style={{ color: "var(--session-walnut-meta-soft)" }}>
                Default: {String(f.default)} · range {f.min}–{f.max}
              </span>
            </p>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="number"
                value={String(draft)}
                disabled={busy}
                min={f.min}
                max={f.max}
                step={1}
                onChange={(e) =>
                  setDrafts((d) => ({
                    ...d,
                    [f.field]:
                      e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
                style={{
                  width: 80,
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "13px",
                  color: "var(--session-ink)",
                  background: "var(--session-walnut-surface-soft)",
                  border: "1px solid var(--session-walnut-border)",
                  borderRadius: 7,
                  padding: "6px 10px",
                }}
              />
              <button
                type="button"
                disabled={busy || !dirty}
                onClick={() => save(f.field)}
                style={{
                  all: "unset",
                  cursor: busy || !dirty ? "default" : "pointer",
                  fontFamily: "var(--font-sans)",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "var(--session-cream-bright)",
                  background: "var(--session-persona)",
                  borderRadius: 7,
                  padding: "6px 14px",
                  opacity: busy || !dirty ? 0.5 : 1,
                }}
              >
                Save
              </button>
              <button
                type="button"
                disabled={busy || !f.edited}
                onClick={() => reset(f.field)}
                style={{
                  all: "unset",
                  cursor: busy || !f.edited ? "default" : "pointer",
                  fontFamily: "var(--font-sans)",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "var(--session-walnut-meta-strong)",
                  border: "1px solid var(--session-walnut-border)",
                  borderRadius: 7,
                  padding: "5px 13px",
                  opacity: busy || !f.edited ? 0.5 : 1,
                }}
              >
                Reset to default
              </button>
              {dirty && (
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    color: "var(--session-walnut-meta-soft)",
                  }}
                >
                  unsaved
                </span>
              )}
            </div>
          </div>
        );
      })}

      {(error || notice) && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12.5px",
            color: error
              ? "var(--session-error-text)"
              : "var(--session-persona)",
            margin: "12px 0 0",
          }}
        >
          {error || notice}
        </p>
      )}
    </div>
  );
}
