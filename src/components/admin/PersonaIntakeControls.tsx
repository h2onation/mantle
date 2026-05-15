"use client";

import type { PersonaMode } from "@/lib/persona/system-prompt";
import {
  PERSONA_MODES,
  togglePersonaMode,
} from "@/lib/persona/persona-mode-toggle";
import {
  CONVERSATION_MODES,
  type ConversationMode,
} from "@/lib/persona/config";

const PERSONA_LABELS: Record<PersonaMode, string> = {
  autistic: "Autistic",
  audhd: "AuDHD",
  dyslexic: "Dyslexic",
  general: "General",
};

const INTAKE_LABELS: Record<ConversationMode, string> = {
  situation: "Situation",
  "guided-intake": "Guided intake",
  upload: "Upload",
};

interface Props {
  personaModes: PersonaMode[];
  intakeMode: ConversationMode;
  onPersonaModesChange: (next: PersonaMode[]) => void;
  onIntakeModeChange: (next: ConversationMode) => void;
  disabled?: boolean;
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--size-meta)",
  color: "var(--session-ink-soft)",
  letterSpacing: "1.5px",
  textTransform: "uppercase",
  fontWeight: 500,
};

function chip(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 5,
    border: `1px solid ${active ? "var(--session-persona)" : "var(--session-walnut-border)"}`,
    background: active
      ? "var(--session-persona-muted)"
      : "var(--session-walnut-surface-soft)",
    color: active ? "var(--session-persona)" : "var(--session-ink-soft)",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 500,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
    WebkitTapHighlightColor: "transparent",
  };
}

export default function PersonaIntakeControls({
  personaModes,
  intakeMode,
  onPersonaModesChange,
  onIntakeModeChange,
  disabled = false,
}: Props) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={labelStyle}>Persona</span>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {PERSONA_MODES.map((mode) => {
            const active = personaModes.includes(mode);
            return (
              <button
                key={mode}
                type="button"
                onClick={() =>
                  !disabled &&
                  onPersonaModesChange(togglePersonaMode(personaModes, mode))
                }
                disabled={disabled}
                style={chip(active, disabled)}
                aria-pressed={active}
              >
                {PERSONA_LABELS[mode]}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={labelStyle}>Intake</span>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {CONVERSATION_MODES.map((mode) => {
            const active = intakeMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => !disabled && onIntakeModeChange(mode)}
                disabled={disabled}
                style={chip(active, disabled)}
                aria-pressed={active}
              >
                {INTAKE_LABELS[mode]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
