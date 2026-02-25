"use client";

import React from "react";

interface OnboardingInfoScreenProps {
  iconType?: "clock" | "fingerprint" | "shield";
  label?: string;
  headline: string;
  body: string;
  contentVisible: boolean;
}

function ClockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function FingerprintIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
      <path d="M2 12a10 10 0 0 1 18-6" />
      <path d="M2 16h.01" />
      <path d="M21.8 16c.2-2 .131-5.354 0-6" />
      <path d="M9 6.8a6 6 0 0 1 9 5.2c0 .47 0 1.17-.02 2" />
      <path d="M6.73 11.18a6 6 0 0 1 .63-2.18" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

const ICONS: Record<string, React.FC> = {
  clock: ClockIcon,
  fingerprint: FingerprintIcon,
  shield: ShieldIcon,
};

function staggerStyle(visible: boolean, delayMs: number): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(10px)",
    transition: "opacity 300ms ease, transform 300ms ease",
    transitionDelay: visible ? `${delayMs}ms` : "0ms",
  };
}

export default function OnboardingInfoScreen({
  iconType,
  label,
  headline,
  body,
  contentVisible,
}: OnboardingInfoScreenProps) {
  const IconComponent = iconType ? ICONS[iconType] : null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "160px",
        left: "28px",
        right: "28px",
      }}
    >
      {/* Icon */}
      {IconComponent && (
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            backgroundColor: "var(--color-accent-ghost)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "20px",
            ...staggerStyle(contentVisible, 0),
          }}
        >
          <IconComponent />
        </div>
      )}

      {/* Label */}
      {label && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "var(--color-text-ghost)",
            marginBottom: "14px",
            ...staggerStyle(contentVisible, 100),
          }}
        >
          {label}
        </div>
      )}

      {/* Headline */}
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: headline === "Mantle" ? "42px" : "28px",
          lineHeight: 1.25,
          color: "var(--color-text)",
          fontWeight: 400,
          margin: "0 0 18px 0",
          letterSpacing: "-0.3px",
          ...staggerStyle(contentVisible, iconType ? 200 : 0),
        }}
      >
        {headline}
      </h1>

      {/* Subtitle (only for brand screen) */}
      {!iconType && !label && (
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: "16px",
            lineHeight: 1.5,
            color: "var(--color-text-dim)",
            marginBottom: "20px",
            ...staggerStyle(contentVisible, 150),
          }}
        >
          Know Thyself.{"\n"}Share What Matters.
        </div>
      )}

      {/* Body */}
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          lineHeight: 1.7,
          color: "var(--color-text-dim)",
          margin: 0,
          ...staggerStyle(contentVisible, iconType ? 350 : 250),
        }}
      >
        {body}
      </p>
    </div>
  );
}
