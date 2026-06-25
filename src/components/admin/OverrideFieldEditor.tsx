"use client";

// One editable copy-override field: a labelled textarea with a DEFAULT/EDITED
// badge and Save / Reset buttons. Pure presentation — the parent panel owns
// the draft state, dirty calc, and the network call (different endpoints per
// panel). Shared by VoiceEditorPanel and IntakeDoorsPanel so the field markup
// lives in one place.
interface OverrideFieldEditorProps {
  label: string;
  /** Current draft text in the textarea. */
  value: string;
  /** True when a saved override is live (drives the EDITED badge + Reset). */
  isEdited: boolean;
  /** True when the draft differs from the live/default value. */
  dirty: boolean;
  /** True while a save/reset for this field is in flight. */
  busy: boolean;
  rows?: number;
  onChange: (value: string) => void;
  onSave: () => void;
  onReset: () => void;
}

export default function OverrideFieldEditor({
  label,
  value,
  isEdited,
  dirty,
  busy,
  rows = 4,
  onChange,
  onSave,
  onReset,
}: OverrideFieldEditorProps) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
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
          {label}
        </span>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: isEdited
              ? "var(--session-persona)"
              : "var(--session-walnut-meta-soft)",
          }}
        >
          {isEdited ? "EDITED" : "DEFAULT"}
        </span>
      </div>
      <textarea
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        style={{
          width: "100%",
          boxSizing: "border-box",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "12.5px",
          lineHeight: 1.5,
          color: "var(--session-ink)",
          background: "var(--session-walnut-surface-soft)",
          border: "1px solid var(--session-walnut-border)",
          borderRadius: 8,
          padding: "10px 12px",
          resize: "vertical",
        }}
      />
      <div
        style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center" }}
      >
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={onSave}
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
          disabled={busy || !isEdited}
          onClick={onReset}
          style={{
            all: "unset",
            cursor: busy || !isEdited ? "default" : "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: "12.5px",
            fontWeight: 600,
            color: "var(--session-walnut-meta-strong)",
            border: "1px solid var(--session-walnut-border)",
            borderRadius: 7,
            padding: "5px 13px",
            opacity: busy || !isEdited ? 0.5 : 1,
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
            unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}
