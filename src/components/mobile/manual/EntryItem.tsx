"use client";

import React, { useCallback, useRef, useState } from "react";
import type { Entry } from "./layer-definitions";
import type { ExplorationContext, ManualEntry } from "@/lib/types";
import { PERSONA_NAME } from "@/lib/persona/config";

type UpdateEntryResult =
  | { ok: true; entry: ManualEntry }
  | { ok: false; error: string };

interface EntryItemProps {
  entry: Entry;
  layerId: number;
  layerName: string;
  onExploreWithPersona?: (context: ExplorationContext) => void;
  onUpdateEntry?: (
    entryId: string,
    edits: { name?: string | null; content?: string }
  ) => Promise<UpdateEntryResult>;
  readOnly?: boolean;
}

/**
 * One Manual entry inside a PopulatedLayer Plate.
 *
 * Title: italic Spectral 18px regular — the thread headline. Sized
 * between the Layer header (22px on the tab pip) and the body (16px),
 * so the hierarchy reads Layer > Pattern > Body. Regular weight (not
 * medium) — italic alone carries the title differentiation; adding
 * weight on top reads as a UI label rather than a literary section
 * title. Line-height 1.4 (loose for italic) so titles like "I Spit
 * the Signal Back Before Anyone Hears It" can wrap to two lines
 * without cramping. No size jitter between collapsed and expanded —
 * the chevron rotation carries state.
 *
 * Body: Spectral 16px / 1.65 / ink-soft — comfortable long-form
 * reading register (Apple Books / Substack scale). Ink-soft softens
 * the contrast so the cream doesn't read as bold against the walnut
 * Plate background.
 *
 * Between siblings (not before the first entry, not after the last),
 * a dotted walnut hairline indented 22px from the left anchors as an
 * editorial section break, not a row separator.
 *
 * Edit mode mirrors the CheckpointOverlay pattern: title + body
 * become `contentEditable`, framed with a walnut border, and an
 * action row swaps from [Edit · Explore further] to [Cancel · Save
 * changes]. Save calls onUpdateEntry (PATCH /api/manual/[id]);
 * on success the optimistic patch in useChat refreshes entry props
 * so the read mode shows the new text. Cancel discards typed
 * changes by simply rendering the read-mode JSX, which re-reads
 * entry.name and entry.body from props.
 */
export default function EntryItem({
  entry,
  layerId,
  layerName,
  onExploreWithPersona,
  onUpdateEntry,
  readOnly,
}: EntryItemProps) {
  const [expanded, setExpanded] = useState(readOnly ? true : false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const toggle = readOnly || editing ? undefined : () => setExpanded((v) => !v);

  const canEdit = !readOnly && !!onUpdateEntry;

  const handleEnterEdit = useCallback(() => {
    setEditing(true);
    setEditError(null);
    // Defer focus so the contentEditable element is in the DOM before
    // we try to focus it.
    setTimeout(() => titleRef.current?.focus(), 50);
  }, []);

  const handleCancelEdit = useCallback(() => {
    // React won't reconcile a contentEditable element's children
    // unless the source prop (entry.name / entry.body) changes — and
    // on Cancel those props are unchanged. Without an imperative
    // reset, the user's typed-but-canceled text would persist in the
    // DOM after the contentEditable attribute is removed. Restore the
    // original text from props before flipping edit off.
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
      // Nothing actually changed — just exit edit mode.
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
        background:
          expanded || readOnly
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
        role={readOnly || editing ? undefined : "button"}
        aria-expanded={readOnly || editing ? undefined : expanded}
        aria-label={
          readOnly || editing
            ? undefined
            : expanded
              ? `Collapse ${entry.name}`
              : `Expand ${entry.name}`
        }
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 14px",
          gap: 12,
          alignItems: "baseline",
          padding: "16px 18px",
          cursor: readOnly || editing ? "default" : "pointer",
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
        {!readOnly && !editing && (
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

      {(expanded || readOnly) && (
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: "var(--sp-sm)",
              }}
            >
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
              {!readOnly && onExploreWithPersona && (
                <>
                  {canEdit && (
                    <span
                      aria-hidden="true"
                      style={{
                        color: "var(--session-walnut-meta-soft)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        lineHeight: 1,
                      }}
                    >
                      ·
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onExploreWithPersona({
                        layerId,
                        layerName,
                        type: "entry",
                        name: entry.name,
                        content: entry.body,
                      });
                    }}
                    style={textBtnStyle("var(--session-walnut)", false)}
                    aria-label={`Explore further with ${PERSONA_NAME}`}
                  >
                    Explore further
                    <span aria-hidden="true" style={{ marginLeft: 4 }}>
                      ›
                    </span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

    </article>
  );
}

/**
 * Mono-caps text-button used for Edit · Explore further (read mode)
 * and Cancel · Save changes (edit mode). Walnut underline matches the
 * earlier "Explore further" pattern; disabled state dims to 0.5
 * opacity for the duration of a network call.
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
