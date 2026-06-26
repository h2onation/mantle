"use client";

import { useEffect, useState } from "react";
import OverrideFieldEditor from "./OverrideFieldEditor";

// One editable field as /api/admin/app-copy returns it.
interface FieldView {
  key: string;
  label: string;
  group: string;
  default: string;
  override: string | null;
  enabled: boolean;
}

// Taller textarea for the prose fields (seed paragraphs); one or two lines for
// the short labels, titles, and buttons.
function rowsFor(key: string): number {
  if (key.startsWith("seed_body")) return 5;
  if (key.endsWith("_desc") || key.endsWith("_body") || key.startsWith("manual_index_sub"))
    return 2;
  return 1;
}

export default function AppCopyPanel() {
  const [fields, setFields] = useState<FieldView[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/app-copy")
      .then((r) => r.json())
      .then((d) => {
        if (d?.fields) {
          setFields(d.fields);
          const seed: Record<string, string> = {};
          for (const f of d.fields as FieldView[]) {
            seed[f.key] = f.enabled && f.override !== null ? f.override : f.default;
          }
          setDrafts(seed);
        }
      })
      .catch(() => setError("Could not load onboarding copy."));
  }

  useEffect(() => {
    load();
  }, []);

  async function persist(key: string, payload: object, successMsg: string) {
    setPending(key);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/app-copy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, ...payload }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Request failed");
      setNotice(successMsg);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setPending(null);
    }
  }

  const save = (key: string) =>
    persist(key, { text: drafts[key] }, "Saved. Live on the next app load.");
  const reset = (key: string) =>
    persist(key, { reset: true }, "Reset to the shipped default. Live on the next app load.");

  // Section order = the order fields arrive in (the API groups them).
  const groups: string[] = [];
  for (const f of fields ?? []) if (!groups.includes(f.group)) groups.push(f.group);

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
          Onboarding &amp; Home copy
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
        The words a new user reads — the entry doors, the Home welcome tile, the
        Manual menu, and the &ldquo;what this is&rdquo; consent screen. Edits go
        live on the next app load; Reset returns a field to its shipped default.
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

      {groups.map((group, gi) => (
        <div
          key={group}
          style={{
            marginTop: gi === 0 ? 0 : 20,
            paddingTop: gi === 0 ? 0 : 16,
            borderTop: gi === 0 ? "none" : "1px solid var(--session-walnut-border)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "var(--session-walnut-meta-soft)",
              marginBottom: 12,
            }}
          >
            {group}
          </div>
          {(fields ?? [])
            .filter((f) => f.group === group)
            .map((f) => {
              const live = f.enabled && f.override !== null;
              const draft = drafts[f.key] ?? "";
              const dirty = draft !== (live ? (f.override as string) : f.default);
              return (
                <div key={f.key} style={{ marginBottom: 16 }}>
                  <OverrideFieldEditor
                    label={f.label}
                    value={draft}
                    isEdited={live}
                    dirty={dirty}
                    busy={pending === f.key}
                    rows={rowsFor(f.key)}
                    onChange={(v) => setDrafts((d) => ({ ...d, [f.key]: v }))}
                    onSave={() => save(f.key)}
                    onReset={() => reset(f.key)}
                  />
                </div>
              );
            })}
        </div>
      ))}

      {(error || notice) && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12.5px",
            color: error ? "var(--session-error-text)" : "var(--session-persona)",
            margin: "12px 0 0",
          }}
        >
          {error || notice}
        </p>
      )}
    </div>
  );
}
