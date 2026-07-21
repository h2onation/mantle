"use client";

import { useEffect, useState } from "react";
import type { Module } from "@/lib/modules";

// Admin CRUD for modules — each row is simultaneously an entry door on Home
// and a section of the Manual. Data: /api/admin/modules (GET/POST/PATCH/
// DELETE). The API is the validator (slug format, brief marker check,
// delete-only-while-unreferenced); this panel just reports its plain-language
// errors. The voice is never per-module (ADR-054): a module's BRIEF composes
// with the shared conductor, so Tuning edits reach every module.

interface ApiState {
  modules: Module[];
}

type Draft = {
  name: string;
  description: string;
  cue: string;
  icon: string;
  introTitle: string;
  introBody: string;
  openerText: string;
  brief: string;
};

function toDraft(m: Module): Draft {
  return {
    name: m.name,
    description: m.description,
    cue: m.cue,
    icon: m.icon,
    introTitle: m.introTitle ?? "",
    introBody: m.introBody ?? "",
    openerText: m.openerText ?? "",
    brief: m.brief ?? "",
  };
}

const label: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--session-ink)",
  display: "block",
  margin: "12px 0 4px",
};

const hint: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "12px",
  lineHeight: 1.5,
  color: "var(--session-walnut-meta)",
  margin: "2px 0 0",
};

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "var(--font-sans)",
  fontSize: "13.5px",
  color: "var(--session-ink)",
  background: "var(--session-walnut-surface)",
  border: "1px solid var(--session-walnut-border)",
  borderRadius: 8,
  padding: "8px 10px",
};

const btn: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "12.5px",
  fontWeight: 600,
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px solid var(--session-walnut-border)",
  background: "var(--session-walnut-surface)",
  color: "var(--session-ink)",
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  ...btn,
  background: "var(--session-persona)",
  borderColor: "var(--session-persona)",
  color: "var(--session-linen)",
};

export default function ModulesPanel() {
  const [state, setState] = useState<ApiState | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Staged destructive delete: set when a plain delete came back 409 with the
  // module's blast radius. The founder must type the slug back to arm the
  // "delete module + entries" button. Cleared on cancel/success.
  const [confirmDelete, setConfirmDelete] = useState<{
    slug: string;
    conversations: number;
    entries: number;
  } | null>(null);
  const [confirmText, setConfirmText] = useState("");

  function absorb(data: ApiState) {
    setState(data);
    const seed: Record<string, Draft> = {};
    for (const m of data.modules) seed[m.slug] = toDraft(m);
    setDrafts(seed);
  }

  useEffect(() => {
    fetch("/api/admin/modules")
      .then((r) => r.json())
      .then((d) => (d?.modules ? absorb(d) : setError(d?.error || "Could not load modules.")))
      .catch(() => setError("Could not load modules."));
  }, []);

  async function call(method: string, payload: object, successMsg: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/modules", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Request failed");
      absorb({ modules: d.modules });
      setNotice(successMsg);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const create = async () => {
    const ok = await call(
      "POST",
      { slug: newSlug.trim(), name: newName.trim() },
      "Module created. Open it below to shape the door.",
    );
    if (ok) {
      setNewSlug("");
      setNewName("");
    }
  };

  const save = (slug: string) => {
    const d = drafts[slug];
    return call(
      "PATCH",
      {
        slug,
        name: d.name,
        description: d.description,
        cue: d.cue,
        icon: d.icon,
        intro_title: d.introTitle,
        intro_body: d.introBody,
        opener_text: d.openerText,
        brief: d.brief,
      },
      "Saved. Live on the next session.",
    );
  };

  const toggle = (m: Module) =>
    call(
      "PATCH",
      { slug: m.slug, enabled: !m.enabled },
      m.enabled
        ? "Disabled — the door hides; its Manual section and entries stay."
        : "Enabled — the door is live on Home.",
    );

  const remove = async (slug: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    setConfirmDelete(null);
    setConfirmText("");
    try {
      const res = await fetch("/api/admin/modules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const d = await res.json();
      if (res.ok) {
        absorb({ modules: d.modules });
        setNotice("Deleted.");
      } else if (res.status === 409 && d?.requiresForce) {
        // Referenced module — stage the strong confirm with the real counts.
        setConfirmDelete({
          slug,
          conversations: d.conversations ?? 0,
          entries: d.entries ?? 0,
        });
      } else {
        setError(d?.error || "Request failed");
      }
    } catch {
      setError("Request failed");
    } finally {
      setBusy(false);
    }
  };

  const forceRemove = async () => {
    if (!confirmDelete || confirmText !== confirmDelete.slug) return;
    const { slug, entries } = confirmDelete;
    setConfirmDelete(null);
    setConfirmText("");
    const ok = await call(
      "DELETE",
      { slug, deleteEntries: true },
      entries > 0
        ? `Deleted "${slug}" and its ${entries === 1 ? "1 entry" : `${entries} entries`} — permanently.`
        : `Deleted "${slug}".`,
    );
    if (!ok) setError((prev) => prev ?? "Delete failed — nothing was removed.");
  };

  const move = async (index: number, dir: -1 | 1) => {
    if (!state) return;
    const a = state.modules[index];
    const b = state.modules[index + dir];
    if (!a || !b) return;
    setBusy(true);
    setError(null);
    try {
      // Swap sort orders; if equal (fresh rows), assign by position instead.
      const aOrder = a.sortOrder === b.sortOrder ? index + dir : b.sortOrder;
      const bOrder = a.sortOrder === b.sortOrder ? index : a.sortOrder;
      for (const [slug, sort_order] of [
        [a.slug, aOrder],
        [b.slug, bOrder],
      ] as const) {
        const res = await fetch("/api/admin/modules", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, sort_order }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d?.error || "Reorder failed");
        absorb({ modules: d.modules });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reorder failed");
    } finally {
      setBusy(false);
    }
  };

  const setField = (slug: string, key: keyof Draft, value: string) =>
    setDrafts((d) => ({ ...d, [slug]: { ...d[slug], [key]: value } }));

  if (state === null) {
    return (
      <p style={{ ...hint, fontSize: "13px" }}>{error ?? "Loading…"}</p>
    );
  }

  return (
    <div>
      {/* Create */}
      <div
        style={{
          border: "1px solid var(--session-walnut-border)",
          background: "var(--session-walnut-surface)",
          borderRadius: 12,
          padding: "18px 20px",
          marginBottom: 24,
        }}
      >
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
          New module
        </span>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <input
            style={{ ...input, maxWidth: 220 }}
            placeholder="slug (permanent id)"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
          />
          <input
            style={{ ...input, maxWidth: 300 }}
            placeholder="Name shown on the card"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            style={primaryBtn}
            disabled={busy || !newSlug.trim() || !newName.trim()}
            onClick={create}
          >
            Create
          </button>
        </div>
        <p style={hint}>
          The slug (lowercase, hyphens ok) is the module&rsquo;s permanent id —
          it gets stamped on conversations and Manual entries and can&rsquo;t be
          changed later. Everything else can.
        </p>
      </div>

      {/* List */}
      {state.modules.length === 0 && (
        <p style={{ ...hint, fontSize: "13px", marginBottom: 16 }}>
          No modules yet. The Home screen shows nothing to begin from until the
          first enabled module exists.
        </p>
      )}

      {state.modules.map((m, i) => {
        const d = drafts[m.slug];
        const isOpen = open === m.slug;
        const hasBrief = Boolean(m.brief && m.brief.trim());
        return (
          <div
            key={m.slug}
            style={{
              border: "1px solid var(--session-walnut-border)",
              background: "var(--session-walnut-surface)",
              borderRadius: 12,
              padding: "14px 18px",
              marginBottom: 12,
              opacity: m.enabled ? 1 : 0.65,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                style={{ ...btn, padding: "4px 9px" }}
                onClick={() => setOpen(isOpen ? null : m.slug)}
                aria-label={isOpen ? "Collapse" : "Expand"}
              >
                {isOpen ? "▾" : "▸"}
              </button>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "var(--session-ink)",
                }}
              >
                {m.name}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11.5px",
                  color: "var(--session-walnut-meta)",
                }}
              >
                {m.slug}
              </span>
              {hasBrief && (
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: "1px solid var(--session-walnut-border)",
                    color: "var(--session-walnut-meta-strong)",
                    background: "var(--session-walnut-surface-soft)",
                  }}
                >
                  Brief
                </span>
              )}
              {!m.enabled && (
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--session-walnut-meta)",
                  }}
                >
                  disabled
                </span>
              )}
              <span style={{ flex: 1 }} />
              <button style={btn} disabled={busy || i === 0} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button
                style={btn}
                disabled={busy || i === state.modules.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button style={btn} disabled={busy} onClick={() => toggle(m)}>
                {m.enabled ? "Disable" : "Enable"}
              </button>
              <button style={btn} disabled={busy} onClick={() => remove(m.slug)}>
                Delete
              </button>
            </div>

            {isOpen && d && (
              <div style={{ marginTop: 8 }}>
                <label style={label}>Name</label>
                <input
                  style={input}
                  value={d.name}
                  onChange={(e) => setField(m.slug, "name", e.target.value)}
                />

                <label style={label}>Card description</label>
                <textarea
                  style={{ ...input, resize: "vertical" }}
                  rows={2}
                  value={d.description}
                  onChange={(e) => setField(m.slug, "description", e.target.value)}
                />

                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={label}>Button label</label>
                    <input
                      style={input}
                      value={d.cue}
                      onChange={(e) => setField(m.slug, "cue", e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={label}>Icon key</label>
                    <input
                      style={input}
                      value={d.icon}
                      onChange={(e) => setField(m.slug, "icon", e.target.value)}
                    />
                    <p style={hint}>chat · list · upload (unknown keys fall back to chat)</p>
                  </div>
                </div>

                <label style={label}>Intro modal — title (blank = no modal)</label>
                <input
                  style={input}
                  value={d.introTitle}
                  onChange={(e) => setField(m.slug, "introTitle", e.target.value)}
                />
                <label style={label}>Intro modal — body</label>
                <textarea
                  style={{ ...input, resize: "vertical" }}
                  rows={4}
                  value={d.introBody}
                  onChange={(e) => setField(m.slug, "introBody", e.target.value)}
                />

                <label style={label}>Opening message (blank = Jove opens)</label>
                <textarea
                  style={{ ...input, resize: "vertical" }}
                  rows={3}
                  value={d.openerText}
                  onChange={(e) => setField(m.slug, "openerText", e.target.value)}
                />
                <p style={hint}>
                  Filled in: the server speaks this exact message first, no model
                  call. Blank: Jove opens from the prompt.
                </p>

                <label style={label}>Module brief (blank = no extra steering)</label>
                <textarea
                  style={{ ...input, resize: "vertical" }}
                  rows={4}
                  placeholder="A few sentences: what this module is about, what to listen for, how to open."
                  value={d.brief}
                  onChange={(e) => setField(m.slug, "brief", e.target.value)}
                />
                <p style={hint}>
                  Composes with the shared voice — Jove reads this alongside the
                  conductor, so your Tuning edits still reach every module.
                  Written as if the user could read it: no operational
                  meta-commentary, no clinical framework names.
                </p>

                <div style={{ marginTop: 14 }}>
                  <button style={primaryBtn} disabled={busy} onClick={() => save(m.slug)}>
                    Save module
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {confirmDelete && (
        <div
          style={{
            border: "1px solid var(--session-warning-text)",
            background: "var(--session-warning-surface)",
            borderRadius: 12,
            padding: "16px 18px",
            marginTop: 16,
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13.5px",
              fontWeight: 700,
              color: "var(--session-warning-text)",
              margin: 0,
            }}
          >
            Delete “{confirmDelete.slug}” and everything filed under it?
          </p>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              lineHeight: 1.55,
              color: "var(--session-ink)",
              margin: "8px 0 0",
            }}
          >
            This module has{" "}
            <strong>
              {confirmDelete.conversations}{" "}
              {confirmDelete.conversations === 1 ? "conversation" : "conversations"}
            </strong>{" "}
            and{" "}
            <strong>
              {confirmDelete.entries}{" "}
              {confirmDelete.entries === 1 ? "Manual entry" : "Manual entries"}
            </strong>{" "}
            attached. Deleting it <strong>permanently deletes those entries for
            every user</strong> — this cannot be undone. Conversations keep
            their history but lose their door. If you want the gentle version,
            Cancel and use Disable instead.
          </p>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "12.5px",
              color: "var(--session-walnut-meta)",
              margin: "12px 0 4px",
            }}
          >
            Type the slug to confirm:
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              style={{ ...input, maxWidth: 220 }}
              placeholder={confirmDelete.slug}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <button
              style={{
                ...btn,
                borderColor: "var(--session-error-text)",
                color:
                  confirmText === confirmDelete.slug
                    ? "var(--session-linen)"
                    : "var(--session-error-text)",
                background:
                  confirmText === confirmDelete.slug
                    ? "var(--session-error-text)"
                    : "transparent",
              }}
              disabled={busy || confirmText !== confirmDelete.slug}
              onClick={forceRemove}
            >
              Delete module
              {confirmDelete.entries > 0
                ? ` + ${confirmDelete.entries} ${confirmDelete.entries === 1 ? "entry" : "entries"}`
                : ""}
            </button>
            <button
              style={btn}
              disabled={busy}
              onClick={() => {
                setConfirmDelete(null);
                setConfirmText("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
