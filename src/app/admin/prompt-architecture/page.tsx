"use client";

import { useEffect, useMemo, useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";
import OverrideFieldEditor from "@/components/admin/OverrideFieldEditor";
import { CONDUCTOR_REQUIRED_FRAGMENTS } from "@/lib/persona/conductor-prompt";

// ---------------------------------------------------------------------------
// Tuning — the ONE place both prompts are tuned (founder decision 2026-07-07).
//
// Two workers, two documents:
//   1. THE CONVERSATION — the conductor prompt, Jove's whole 1:1 personality,
//      editable as one document (the `conductor_prompt` override key).
//   2. THE ENTRY — the composer, a separate model call that writes the entry
//      when the user pulls a reflection. Its prompt is shown read-only
//      (rendered from the same function the live call uses, so the display
//      can never drift); its one editable piece is the entry bar
//      (`composer_entry_bar`), edited here and nowhere else.
//
// Data: GET/PATCH /api/admin/persona-voice. Conductor saves that drop a
// non-negotiable line (crisis resources, the hidden UI markers) are rejected
// by the API — see CONDUCTOR_REQUIRED_FRAGMENTS in conductor-prompt.ts.
// ---------------------------------------------------------------------------

interface VoiceField {
  key: string;
  label: string;
  default: string;
  override: string | null;
  enabled: boolean;
}

/** The three system-prompt blocks, in the order the model receives them.
 *  Rendered as a static explainer so the page teaches how the call assembles. */
const ASSEMBLY_BLOCKS: { title: string; body: string }[] = [
  {
    title: "1 · This prompt",
    body:
      "The document below, verbatim. Jove's entire personality and method. Identical every turn, so the API caches it — an edit here re-primes the cache on the following turn.",
  },
  {
    title: "2 · The Manual so far",
    body:
      "Older confirmed entries, compressed to one line each (headline + summary + key words) so Jove knows the shape of the Manual without re-reading the prose. Entries from the current conversation ride in full text so Jove can thread them back in.",
  },
  {
    title: "3 · Session context",
    body:
      "Returning-user flag, session count, and a running summary of earlier context. Changes every turn; never cached. After these three blocks comes the conversation itself.",
  },
];

/** Pull the `## ` section headers out of the prompt text — the document's own
 *  table of contents, derived live from whatever is in the editor. */
function extractSections(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => line.slice(3).trim());
}

export default function TuningPage() {
  const isAdmin = useIsAdmin();

  const [field, setField] = useState<VoiceField | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The composer: read-only prompt text + the one editable field (the bar).
  const [composerPrompt, setComposerPrompt] = useState<string>("");
  const [barField, setBarField] = useState<VoiceField | null>(null);
  const [barDraft, setBarDraft] = useState<string>("");
  const [barBusy, setBarBusy] = useState(false);

  function load() {
    fetch("/api/admin/persona-voice")
      .then((r) => r.json())
      .then((d) => {
        const f = (d?.fields as VoiceField[] | undefined)?.find(
          (x) => x.key === "conductor_prompt",
        );
        if (!f) {
          setError("Could not load the prompt.");
          return;
        }
        setField(f);
        setDraft(f.enabled && f.override !== null ? f.override : f.default);

        const b = (d?.fields as VoiceField[] | undefined)?.find(
          (x) => x.key === "composer_entry_bar",
        );
        if (b) {
          setBarField(b);
          setBarDraft(b.enabled && b.override !== null ? b.override : b.default);
        }
        if (typeof d?.composerPrompt === "string") {
          setComposerPrompt(d.composerPrompt);
        }
      })
      .catch(() => setError("Could not load the prompt."));
  }

  useEffect(() => {
    load();
  }, []);

  async function patchBar(body: Record<string, unknown>) {
    setBarBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/persona-voice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "composer_entry_bar", ...body }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Save failed");
      setNotice(
        body.reset
          ? "Entry bar reset to the shipped default. Live on the next pull."
          : "Entry bar saved. Live on the next pull.",
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBarBusy(false);
    }
  }

  const live =
    field !== null && field.enabled && field.override !== null;
  const liveText = live ? field.override! : (field?.default ?? "");
  const dirty = field !== null && draft !== liveText;
  const sections = useMemo(() => extractSections(draft), [draft]);
  const wordCount = useMemo(
    () => (draft.trim() ? draft.trim().split(/\s+/).length : 0),
    [draft],
  );

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/persona-voice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "conductor_prompt", text: draft }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Save failed");
      setNotice("Saved. Jove runs this version starting next turn.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/persona-voice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "conductor_prompt", reset: true }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Reset failed");
      setNotice("Reset. Jove runs the shipped code version starting next turn.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) {
    return (
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          color: "var(--session-ink-ghost)",
          letterSpacing: "1px",
          padding: "80px 24px",
          textAlign: "center",
        }}
      >
        Not authorized.
      </div>
    );
  }

  const metaLabel: React.CSSProperties = {
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--session-walnut-meta-soft)",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--session-linen)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <AdminNavRail activeId="prompt-architecture" />

        <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
          <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 28px 80px" }}>
            {/* ── Header ─────────────────────────────────────────────── */}
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "26px",
                color: "var(--session-ink)",
                margin: "0 0 10px",
              }}
            >
              Tuning
            </h1>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                lineHeight: 1.6,
                color: "var(--session-walnut-meta)",
                margin: "0 0 24px",
                maxWidth: 700,
              }}
            >
              Two workers, tuned in this one place. <strong>The
              conversation</strong>: Jove&rsquo;s prompt, the whole 1:1
              personality, editable below as one document. <strong>The
              entry</strong>: the composer, a separate model call that writes
              the entry when someone saves a reflection — its prompt is shown
              further down, with its one editable piece (the entry bar). When
              something feels off, ask which it was: the conversation felt
              wrong → tune Jove&rsquo;s prompt; the written entry read wrong →
              tune the entry bar. Edits are live on the next turn, no deploy,
              and the shipped code is always the floor: Reset returns to it
              instantly.
            </p>

            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "19px",
                color: "var(--session-ink)",
                margin: "0 0 12px",
              }}
            >
              The conversation — Jove&rsquo;s prompt
            </h2>

            {/* ── How the full call assembles ────────────────────────── */}
            <div style={{ ...metaLabel, marginBottom: 10 }}>
              What the model actually receives, in order
            </div>
            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 28,
                flexWrap: "wrap",
              }}
            >
              {ASSEMBLY_BLOCKS.map((b) => (
                <div
                  key={b.title}
                  style={{
                    flex: "1 1 240px",
                    border: "1px solid var(--session-walnut-border)",
                    background: "var(--session-walnut-surface)",
                    borderRadius: 10,
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--session-walnut-meta-strong)",
                      marginBottom: 4,
                    }}
                  >
                    {b.title}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12.5px",
                      lineHeight: 1.5,
                      color: "var(--session-walnut-meta)",
                    }}
                  >
                    {b.body}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Status + actions ───────────────────────────────────── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: 6,
                  color: live
                    ? "var(--session-warning)"
                    : "var(--session-walnut-meta-soft)",
                  border: live
                    ? "1px solid var(--session-warning-soft)"
                    : "1px solid var(--session-walnut-border)",
                  background: live
                    ? "var(--session-warning-soft)"
                    : "var(--session-walnut-surface-soft)",
                }}
              >
                {live ? "Edited — override live" : "Shipped code version"}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  color: "var(--session-walnut-meta-soft)",
                }}
              >
                {wordCount.toLocaleString()} words · {sections.length} sections
              </span>
              <span style={{ flex: 1 }} />
              <button
                onClick={save}
                disabled={busy || !dirty}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 600,
                  padding: "6px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--session-persona-border)",
                  background: dirty
                    ? "var(--session-persona-tint)"
                    : "var(--session-walnut-surface-soft)",
                  color: dirty
                    ? "var(--session-persona)"
                    : "var(--session-walnut-meta-soft)",
                  cursor: dirty && !busy ? "pointer" : "default",
                }}
              >
                {busy ? "Working…" : "Save — live next turn"}
              </button>
              {live && (
                <button
                  onClick={reset}
                  disabled={busy}
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--session-walnut-border)",
                    background: "var(--session-walnut-surface)",
                    color: "var(--session-walnut-meta)",
                    cursor: busy ? "default" : "pointer",
                  }}
                >
                  Reset to shipped code
                </button>
              )}
            </div>

            {(error || notice) && (
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  lineHeight: 1.5,
                  color: error
                    ? "var(--session-error-text)"
                    : "var(--session-persona)",
                  margin: "0 0 10px",
                }}
              >
                {error || notice}
              </p>
            )}

            {/* ── Section outline (derived live from the draft) ──────── */}
            {sections.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ ...metaLabel, marginBottom: 6 }}>
                  Sections in this document
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {sections.map((s) => (
                    <span
                      key={s}
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "12px",
                        padding: "3px 10px",
                        borderRadius: 999,
                        border: "1px solid var(--session-walnut-border-soft)",
                        background: "var(--session-walnut-surface)",
                        color: "var(--session-walnut-meta-strong)",
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── The document ───────────────────────────────────────── */}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              style={{
                width: "100%",
                minHeight: "62vh",
                boxSizing: "border-box",
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                lineHeight: 1.6,
                color: "var(--session-ink)",
                background: "var(--session-walnut-surface)",
                border: "1px solid var(--session-walnut-border)",
                borderRadius: 12,
                padding: "16px 18px",
                resize: "vertical",
              }}
            />

            {/* ── Protected lines ────────────────────────────────────── */}
            <div
              style={{
                marginTop: 20,
                border: "1px solid var(--session-walnut-border)",
                background: "var(--session-walnut-surface-soft)",
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <div style={{ ...metaLabel, marginBottom: 8 }}>
                Protected lines — a save that removes one is rejected
              </div>
              {CONDUCTOR_REQUIRED_FRAGMENTS.map((f) => (
                <div key={f.fragment} style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--session-walnut-meta-strong)",
                    }}
                  >
                    {f.label}{" "}
                    <code
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11.5px",
                        fontWeight: 400,
                        color: "var(--session-walnut-meta)",
                      }}
                    >
                      {f.fragment}
                    </code>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12.5px",
                      lineHeight: 1.5,
                      color: "var(--session-walnut-meta)",
                    }}
                  >
                    {f.why}
                  </div>
                </div>
              ))}
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "12.5px",
                  lineHeight: 1.5,
                  color: "var(--session-walnut-meta-soft)",
                  marginTop: 10,
                }}
              >
                Everything else is yours to change. The small operational lines
                around the conversation (openers, the post-save line) are
                edited in the{" "}
                <a
                  href="/admin"
                  style={{
                    color: "var(--session-persona)",
                    textDecoration: "underline",
                  }}
                >
                  Voice editor
                </a>{" "}
                on the main admin page.
              </div>
            </div>

            {/* ── The entry — the composer ───────────────────────────── */}
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "19px",
                color: "var(--session-ink)",
                margin: "40px 0 12px",
              }}
            >
              The entry — the composer
            </h2>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                lineHeight: 1.6,
                color: "var(--session-walnut-meta)",
                margin: "0 0 18px",
                maxWidth: 700,
              }}
            >
              When someone taps the reflection bar and saves, this second
              worker writes the entry they see in the overlay and the Manual.
              It never speaks in the conversation, and Jove&rsquo;s prompt
              never touches it. Its full instructions are below, read-only:
              the structure and safety rules are code (a wrong edit there
              would silently break saving). The one piece meant for tuning is
              the <strong>entry bar</strong> — the quality standard for how an
              entry should read — editable here.
            </p>

            {barField && (
              <div
                style={{
                  border: "1px solid var(--session-walnut-border)",
                  background: "var(--session-walnut-surface)",
                  borderRadius: 12,
                  padding: "16px 18px",
                  marginBottom: 18,
                }}
              >
                <OverrideFieldEditor
                  label={barField.label}
                  value={barDraft}
                  isEdited={barField.enabled && barField.override !== null}
                  dirty={
                    barDraft !==
                    (barField.enabled && barField.override !== null
                      ? barField.override
                      : barField.default)
                  }
                  busy={barBusy}
                  rows={12}
                  onChange={setBarDraft}
                  onSave={() => patchBar({ text: barDraft })}
                  onReset={() => patchBar({ reset: true })}
                />
              </div>
            )}

            <div style={{ ...metaLabel, marginBottom: 6 }}>
              The composer&rsquo;s full instructions, read-only — rendered from
              the exact text the live call uses
            </div>
            <pre
              style={{
                width: "100%",
                boxSizing: "border-box",
                maxHeight: "48vh",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                fontFamily: "var(--font-mono)",
                fontSize: "12.5px",
                lineHeight: 1.6,
                color: "var(--session-walnut-meta-strong)",
                background: "var(--session-walnut-surface-soft)",
                border: "1px solid var(--session-walnut-border)",
                borderRadius: 12,
                padding: "16px 18px",
                margin: 0,
              }}
            >
              {composerPrompt || "Loading…"}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
