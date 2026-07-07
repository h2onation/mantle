"use client";

import { useEffect, useState } from "react";
import OverrideFieldEditor from "./OverrideFieldEditor";

// One editable voice field as the API returns it.
interface VoiceField {
  key: string;
  label: string;
  default: string;
  override: string | null;
  enabled: boolean;
}

// Both prompts are tuned on the Tuning page (/admin/prompt-architecture):
// Jove's whole prompt (conductor_prompt) and the composer's entry bar
// (composer_entry_bar). This panel excludes those keys and keeps the small
// operational copy fields. One edit surface per key.
const TUNING_PAGE_KEYS = ["conductor_prompt", "composer_entry_bar"];

// What stays code-only (shown so the founder sees the boundary and why).
const LOCKED_FIELDS: { label: string; why: string }[] = [
  {
    label: "Crisis phrase detector (pipeline)",
    why: "The hard-coded phrase list that forces crisis resources into the room even if the model misses the signal. Safety layer — a code change with review, never a live textarea.",
  },
  {
    label: "Entry structure + composer schema",
    why: "How a saved entry is shaped and validated at compose time. A wrong edit silently corrupts what lands in the Manual.",
  },
];

export default function VoiceEditorPanel() {
  const [fields, setFields] = useState<VoiceField[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/persona-voice")
      .then((r) => r.json())
      .then((d) => {
        if (d?.fields) {
          // Both prompts live on the Tuning page; this panel edits the
          // small operational fields only.
          const panelFields = (d.fields as VoiceField[]).filter(
            (f) => !TUNING_PAGE_KEYS.includes(f.key),
          );
          setFields(panelFields);
          // Seed each editor with the live value: override if enabled, else default.
          const seed: Record<string, string> = {};
          for (const f of panelFields) {
            seed[f.key] = f.enabled && f.override !== null ? f.override : f.default;
          }
          setDrafts(seed);
        }
      })
      .catch(() => setError("Could not load voice fields."));
  }

  useEffect(() => {
    load();
  }, []);

  async function save(key: string) {
    setPending(key);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/persona-voice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, text: drafts[key] }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Save failed");
      setNotice("Saved. Live on the next turn.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setPending(null);
    }
  }

  async function reset(key: string) {
    setPending(key);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/persona-voice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, reset: true }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Reset failed");
      setNotice("Reset to the shipped default. Live on the next turn.");
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
          Voice editor
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
        Operational copy — the small fixed lines around the conversation. Saving
        takes effect on the next turn, no deploy. The shipped code is always the
        floor: Reset returns a field to its default instantly. Jove&rsquo;s whole
        prompt and the composer&rsquo;s entry bar are tuned on{" "}
        <a
          href="/admin/prompt-architecture"
          style={{ color: "var(--session-persona)", textDecoration: "underline" }}
        >
          the Tuning page
        </a>
        . Safety surfaces stay locked (below).
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
        const busy = pending === f.key;
        const live = f.enabled && f.override !== null;
        const draft = drafts[f.key] ?? "";
        const dirty = draft !== (live ? f.override : f.default);
        return (
          <div
            key={f.key}
            style={{
              padding: "14px 0",
              borderTop:
                i === 0 ? "none" : "1px solid var(--session-walnut-border-soft)",
            }}
          >
            <OverrideFieldEditor
              label={f.label}
              value={draft}
              isEdited={live}
              dirty={dirty}
              busy={busy}
              rows={f.key === "composer_entry_bar" ? 12 : 4}
              onChange={(v) => setDrafts((d) => ({ ...d, [f.key]: v }))}
              onSave={() => save(f.key)}
              onReset={() => reset(f.key)}
            />
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

      {/* Locked surfaces — visible so the boundary is legible, not editable. */}
      <div
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: "1px solid var(--session-walnut-border)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--session-walnut-meta-soft)",
            marginBottom: 8,
          }}
        >
          Locked — code only
        </div>
        {LOCKED_FIELDS.map((l) => (
          <div key={l.label} style={{ marginBottom: 8 }}>
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--session-walnut-meta-strong)",
              }}
            >
              {l.label}
            </div>
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                lineHeight: 1.45,
                color: "var(--session-walnut-meta)",
              }}
            >
              {l.why}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
