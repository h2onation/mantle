"use client";

import { useEffect, useState } from "react";
import OverrideFieldEditor from "./OverrideFieldEditor";

// One editable field as the API returns it.
interface FieldView {
  key: string;
  label: string;
  default: string;
  override: string | null;
  enabled: boolean;
}

// One door's editable config, grouped for display. `opener` is null for
// guided-intake (generated live); `openerNote` explains why in that case.
interface DoorView {
  mode: string;
  name: string;
  opener: FieldView | null;
  openerNote?: string;
  title: FieldView;
  body: FieldView;
}

// Rows-per-field by purpose: title is one line, body + opener are prose.
const ROWS: Record<string, number> = { title: 2, body: 6, opener: 4 };

export default function IntakeDoorsPanel() {
  const [doors, setDoors] = useState<DoorView[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/intake-doors")
      .then((r) => r.json())
      .then((d) => {
        if (d?.doors) {
          setDoors(d.doors);
          const seed: Record<string, string> = {};
          for (const door of d.doors as DoorView[]) {
            for (const f of [door.opener, door.title, door.body]) {
              if (!f) continue;
              seed[f.key] = f.enabled && f.override !== null ? f.override : f.default;
            }
          }
          setDrafts(seed);
        }
      })
      .catch(() => setError("Could not load intake doors."));
  }

  useEffect(() => {
    load();
  }, []);

  async function persist(key: string, payload: object, successMsg: string) {
    setPending(key);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/intake-doors", {
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
    persist(key, { text: drafts[key] }, "Saved. Live on the next session.");
  const reset = (key: string) =>
    persist(key, { reset: true }, "Reset to the shipped default.");

  function renderField(f: FieldView, kind: keyof typeof ROWS) {
    const live = f.enabled && f.override !== null;
    const draft = drafts[f.key] ?? "";
    const dirty = draft !== (live ? f.override : f.default);
    return (
      <div style={{ marginTop: 14 }}>
        <OverrideFieldEditor
          label={f.label}
          value={draft}
          isEdited={live}
          dirty={dirty}
          busy={pending === f.key}
          rows={ROWS[kind]}
          onChange={(v) => setDrafts((d) => ({ ...d, [f.key]: v }))}
          onSave={() => save(f.key)}
          onReset={() => reset(f.key)}
        />
      </div>
    );
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
          Intake doors
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
        Each door a user can open from the welcome screen. The{" "}
        <strong>intro</strong> (title + body) is the one-time &ldquo;how this
        works&rdquo; card shown the first time they open that door. The{" "}
        <strong>opening message</strong> is the first thing Jove says inside.
        Edits go live on the next session; Reset returns a field to its shipped
        default.
      </p>

      {doors === null && !error && (
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

      {doors?.map((door) => (
        <div
          key={door.mode}
          style={{
            border: "1px solid var(--session-walnut-border-soft)",
            borderRadius: 10,
            padding: "16px 18px",
            marginBottom: 16,
            background: "var(--session-walnut-surface-soft)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              fontWeight: 700,
              color: "var(--session-ink)",
              marginBottom: 2,
            }}
          >
            {door.name}
          </div>
          {renderField(door.title, "title")}
          {renderField(door.body, "body")}
          {door.opener ? (
            renderField(door.opener, "opener")
          ) : (
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--session-ink)",
                  marginBottom: 4,
                }}
              >
                Opening message
              </div>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "12.5px",
                  lineHeight: 1.5,
                  color: "var(--session-walnut-meta)",
                  margin: 0,
                }}
              >
                {door.openerNote}
              </p>
            </div>
          )}
        </div>
      ))}

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
