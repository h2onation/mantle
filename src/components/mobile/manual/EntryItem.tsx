"use client";

import React, { useCallback, useRef, useState } from "react";
import type { Entry } from "./layer-definitions";
import type { ManualEntry } from "@/lib/types";

type UpdateEntryResult =
  | { ok: true; entry: ManualEntry }
  | { ok: false; error: string };

interface EntryItemProps {
  entry: Entry;
  onUpdateEntry?: (
    entryId: string,
    edits: { name?: string | null; content?: string }
  ) => Promise<UpdateEntryResult>;
  readOnly?: boolean;
  /** Render the body open with no per-entry chevron — used when the parent
   *  layer accordion owns the collapse. Edit still works. */
  alwaysOpen?: boolean;
}

/**
 * One Manual entry inside a PopulatedLayer. The layer accordion owns
 * collapse (alwaysOpen), so each entry reads as an open card: italic
 * serif title, body in the reading register, a provenance line, and an
 * explicit Edit control. "Go deeper with Jove" lives on Home now — the
 * read view stays a clean read + edit.
 *
 * Edit mode mirrors the CheckpointOverlay pattern: title + body become
 * `contentEditable`, framed with a walnut border, and the action row swaps
 * to [Cancel · Save changes]. Save calls onUpdateEntry (PATCH /api/manual/[id]);
 * on success the optimistic patch in useChat refreshes entry props so read
 * mode shows the new text. Cancel restores the original text imperatively
 * (React won't reconcile a contentEditable whose source prop is unchanged).
 */
export default function EntryItem({
  entry,
  onUpdateEntry,
  readOnly,
  alwaysOpen,
}: EntryItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const togglable = !readOnly && !editing && !alwaysOpen;
  const showBody = expanded || readOnly || alwaysOpen;
  const toggle = togglable ? () => setExpanded((v) => !v) : undefined;
  const canEdit = !readOnly && !!onUpdateEntry;
  const provenance = provenanceLine(entry.createdAt);

  const handleEnterEdit = useCallback(() => {
    setEditing(true);
    setEditError(null);
    setTimeout(() => titleRef.current?.focus(), 50);
  }, []);

  const handleCancelEdit = useCallback(() => {
    if (titleRef.current) titleRef.current.innerText = entry.name;
    if (bodyRef.current) bodyRef.current.innerText = entry.body;
    setEditing(false);
    setEditError(null);
  }, [entry.name, entry.body]);

  const handleSaveEdit = useCallback(async () => {
    if (!onUpdateEntry || saving) return;
    const nextName = titleRef.current?.innerText.trim() ?? "";
    const nextBody = bodyRef.current?.innerText.trim() ?? "";

    if (nextBody.length === 0) {
      setEditError("Pattern text can't be empty.");
      return;
    }

    const edits: { name?: string | null; content?: string } = {};
    if (nextName !== (entry.name ?? "").trim()) {
      edits.name = nextName.length > 0 ? nextName : null;
    }
    if (nextBody !== entry.body.trim()) {
      edits.content = nextBody;
    }
    if (Object.keys(edits).length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setEditError(null);
    const result = await onUpdateEntry(entry.id, edits);
    setSaving(false);
    if (result.ok) {
      setEditing(false);
    } else {
      setEditError(result.error);
    }
  }, [entry.id, entry.name, entry.body, onUpdateEntry, saving]);

  return (
    <article
      style={{
        position: "relative",
        background: showBody
          ? "var(--session-cream-bright)"
          : "var(--session-cream)",
        border: "1px solid var(--session-hair)",
        borderRadius: 10,
        boxShadow: "var(--session-card-shadow)",
        overflow: "hidden",
        transition:
          "background 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
      }}
    >
      <div
        onClick={toggle}
        role={togglable ? "button" : undefined}
        aria-expanded={togglable ? expanded : undefined}
        aria-label={
          togglable
            ? expanded
              ? `Collapse ${entry.name}`
              : `Expand ${entry.name}`
            : undefined
        }
        style={{
          display: "grid",
          gridTemplateColumns: togglable ? "1fr 14px" : "1fr",
          gap: 12,
          alignItems: "baseline",
          padding: "16px 18px",
          cursor: togglable ? "pointer" : "default",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <h3
          ref={titleRef}
          contentEditable={editing}
          suppressContentEditableWarning
          style={{
            margin: 0,
            fontFamily: "var(--font-serif), serif",
            fontStyle: "normal",
            fontWeight: 400,
            fontSize: 19,
            lineHeight: 1.22,
            letterSpacing: "-0.005em",
            color: "var(--session-ink)",
            fontFeatureSettings: '"liga","dlig","kern"',
            textWrap: "balance" as React.CSSProperties["textWrap"],
            outline: "none",
            borderBottom: editing
              ? "1px solid var(--session-walnut-border)"
              : "1px solid transparent",
            paddingBottom: editing ? 4 : 0,
            transition: "border-color 0.2s ease, padding-bottom 0.2s ease",
          }}
        >
          {entry.name}
        </h3>
        {togglable && (
          <span
            aria-hidden="true"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: 1,
              textAlign: "right",
              color: "var(--session-walnut)",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transformOrigin: "center",
              transition: "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
              display: "inline-block",
            }}
          >
            ›
          </span>
        )}
      </div>

      {showBody && (
        <div
          style={{
            padding: "14px 18px 16px",
            borderTop: "1px solid var(--session-hair-soft)",
          }}
        >
          <div
            ref={bodyRef}
            contentEditable={editing}
            suppressContentEditableWarning
            style={{
              fontFamily: "var(--font-spectral), var(--font-serif), serif",
              fontStyle: "normal",
              fontWeight: 400,
              fontSize: 14.5,
              lineHeight: 1.65,
              color: "var(--session-ink-soft)",
              whiteSpace: "pre-line" as const,
              textWrap: "pretty" as React.CSSProperties["textWrap"],
              outline: "none",
              minHeight: editing ? 80 : undefined,
              border: editing
                ? "1px solid var(--session-walnut-border)"
                : "1px solid transparent",
              borderRadius: editing ? 8 : 0,
              padding: editing ? "12px 14px" : 0,
              marginTop: editing ? 12 : 0,
              background: editing
                ? "var(--session-walnut-surface-soft)"
                : "transparent",
              transition:
                "border-color 0.2s ease, background 0.2s ease, padding 0.2s ease",
            }}
          >
            {entry.body}
          </div>

          {editing ? (
            <>
              {editError && (
                <p
                  role="alert"
                  style={{
                    margin: "12px 0 0",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "1.6px",
                    textTransform: "uppercase",
                    color: "var(--session-error-text)",
                  }}
                >
                  {editError}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: "var(--sp-sm)",
                }}
              >
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  style={textBtnStyle("var(--session-ink-mid)", saving)}
                  aria-label="Cancel edit"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  style={textBtnStyle("var(--session-walnut)", saving)}
                  aria-label="Save changes"
                >
                  {saving ? "Saving…" : "Save changes"}
                  {!saving && (
                    <span aria-hidden="true" style={{ marginLeft: 4 }}>
                      ›
                    </span>
                  )}
                </button>
              </div>
            </>
          ) : (
            (provenance || canEdit) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 14,
                  marginTop: "var(--sp-sm)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--session-ink-ghost)",
                  }}
                >
                  {provenance ?? ""}
                </span>
                {canEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEnterEdit();
                    }}
                    style={textBtnStyle("var(--session-walnut)", false)}
                    aria-label={`Edit ${entry.name}`}
                  >
                    Edit
                  </button>
                )}
              </div>
            )
          )}
        </div>
      )}
    </article>
  );
}

function provenanceLine(createdAt?: string): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const month = d.toLocaleDateString(
    "en-US",
    sameYear ? { month: "long" } : { month: "long", year: "numeric" }
  );
  return `Added from a conversation · ${month}`;
}

/**
 * Mono-caps text-button used for Edit (read mode) and Cancel · Save changes
 * (edit mode). Walnut underline; disabled state dims to 0.5 opacity for the
 * duration of a network call.
 */
function textBtnStyle(color: string, disabled: boolean): React.CSSProperties {
  return {
    all: "unset",
    display: "inline-flex",
    alignItems: "center",
    cursor: disabled ? "default" : "pointer",
    paddingBottom: 2,
    borderBottom: `1px solid ${color}`,
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "2px",
    textTransform: "uppercase",
    color,
    opacity: disabled ? 0.5 : 1,
    WebkitTapHighlightColor: "transparent",
    transition: "opacity 0.2s ease",
  };
}
