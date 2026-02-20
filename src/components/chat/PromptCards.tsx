"use client";

const prompts = [
  "I want to understand why I keep doing this thing...",
  "There's a relationship that keeps going sideways...",
  "I'm not sure what I'm optimizing for right now...",
];

interface PromptCardsProps {
  onSelect: (text: string) => void;
}

export default function PromptCards({ onSelect }: PromptCardsProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "8px 0",
      }}
    >
      {prompts.map((prompt) => (
        <button
          key={prompt}
          onClick={() => onSelect(prompt)}
          style={{
            padding: "12px 16px",
            backgroundColor: "var(--color-bg-input)",
            border: "1px solid var(--color-border)",
            borderRadius: "10px",
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            lineHeight: 1.5,
            color: "var(--color-text-secondary)",
            transition: "border-color 0.15s ease",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = "var(--color-text-muted)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = "var(--color-border)")
          }
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
