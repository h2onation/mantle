"use client";

interface QuickReplyChipsProps {
  chips: string[];
  onSelect: (chip: string) => void;
  disabled: boolean;
}

export default function QuickReplyChips({
  chips,
  onSelect,
  disabled,
}: QuickReplyChipsProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        marginTop: "12px",
        animation: "mwFadeIn 0.3s ease-out both",
      }}
    >
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onSelect(chip)}
          disabled={disabled}
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "16px",
            fontStyle: "italic",
            fontWeight: 400,
            lineHeight: 1.5,
            color: "var(--session-ink-soft)",
            backgroundColor: "transparent",
            border: "none",
            borderBottom: "1px solid var(--session-hair)",
            borderRadius: 0,
            padding: "var(--sp-sm) 0 var(--sp-sm)",
            cursor: disabled ? "default" : "pointer",
            textAlign: "left",
            width: "100%",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
