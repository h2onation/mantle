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

// Where each group's copy appears and who sees it. Rendered in the collapsed
// group header so the founder knows what a section controls before expanding.
const GROUP_INFO: Record<string, { where: string; when: string }> = {
  "Entry doors": {
    where: "The three “ways to begin” cards on the Home screen.",
    when: "Every logged-in user, on Home. A door whose mode is switched off in Feature gates shows “Coming soon” instead of this copy.",
  },
  Home: {
    where: "The welcome card at the top of Home, just above the “ways to begin” cards.",
    when: "Only a brand-new user — nothing to resume and no Manual entries yet. Once they have a saved conversation it’s replaced by the “Pick up where you left off” card.",
  },
  "Manual menu": {
    where: "The “Your manual” block on Home — the heading and subheading above the five section rows.",
    when: "Every logged-in user, on Home. Mobile and desktop show slightly different subheadings (both editable below).",
  },
  "Seed screen": {
    where: "The full-screen “What this is, and isn’t” consent screen.",
    when: "Once, for a brand-new user right after their first login — before they reach the app.",
  },
};

export default function AppCopyPanel() {
  const [fields, setFields] = useState<FieldView[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Groups collapse by default — this panel holds ~20 fields. Expand one to edit.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (g: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

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
        The words a new user reads. Each section below says where its copy
        appears and who sees it — expand one to edit. Edits go live on the next
        app load; Reset returns a field to its shipped default.
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

      {groups.map((group) => {
        const info = GROUP_INFO[group];
        const groupFields = (fields ?? []).filter((f) => f.group === group);
        const editedCount = groupFields.filter(
          (f) => f.enabled && f.override !== null,
        ).length;
        const open = openGroups.has(group);
        return (
          <div
            key={group}
            style={{
              marginTop: 12,
              border: "1px solid var(--session-walnut-border-soft)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggleGroup(group)}
              style={{
                all: "unset",
                boxSizing: "border-box",
                cursor: "pointer",
                width: "100%",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13.5px",
                      fontWeight: 600,
                      color: "var(--session-ink)",
                    }}
                  >
                    {group}
                  </span>
                  {editedCount > 0 && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "10px",
                        letterSpacing: "0.04em",
                        color: "var(--session-persona)",
                        border: "1px solid var(--session-persona)",
                        borderRadius: 999,
                        padding: "1px 6px",
                      }}
                    >
                      {editedCount} edited
                    </span>
                  )}
                </span>
                {info && (
                  <span
                    style={{
                      display: "block",
                      marginTop: 5,
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      lineHeight: 1.45,
                      color: "var(--session-walnut-meta)",
                    }}
                  >
                    <span style={{ color: "var(--session-walnut-meta-soft)" }}>
                      Where:{" "}
                    </span>
                    {info.where}
                    <br />
                    <span style={{ color: "var(--session-walnut-meta-soft)" }}>
                      When:{" "}
                    </span>
                    {info.when}
                  </span>
                )}
              </span>
              <span
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  marginTop: 2,
                  fontSize: "12px",
                  color: "var(--session-walnut-meta)",
                  transform: open ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "transform 120ms ease",
                }}
              >
                ▾
              </span>
            </button>

            {open && (
              <div
                style={{
                  padding: "4px 14px 14px",
                  borderTop: "1px solid var(--session-walnut-border-soft)",
                }}
              >
                {groupFields.map((f) => {
                  const live = f.enabled && f.override !== null;
                  const draft = drafts[f.key] ?? "";
                  const dirty =
                    draft !== (live ? (f.override as string) : f.default);
                  return (
                    <div key={f.key} style={{ marginTop: 14 }}>
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
            )}
          </div>
        );
      })}

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
