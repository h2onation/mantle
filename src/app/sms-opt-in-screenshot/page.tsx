import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Opt-In Flow — Mantle",
};

export default function SmsOptInScreenshot() {
  return (
    <div
      style={{
        backgroundColor: "var(--session-linen)",
        minHeight: "100vh",
        color: "var(--session-ink)",
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "40px 20px",
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 28,
            fontWeight: 400,
            margin: "0 0 8px 0",
          }}
        >
          SMS Opt-In Flow
        </h1>
        <p style={{ color: "var(--session-ink-mid)", margin: "0 0 32px 0" }}>
          Below is a screenshot of how users opt in to receive SMS messages from
          Sage within the Mantle app.
        </p>

        <img
          src="/sms-opt-in.png"
          alt="Screenshot of the SMS opt-in flow in Mantle. Users enter their phone number in Settings and complete SMS verification to confirm consent."
          style={{
            width: "100%",
            maxWidth: 480,
            borderRadius: 8,
            border: "1px solid var(--session-ink-faint, #e0d9d0)",
            display: "block",
            margin: "0 auto 24px auto",
          }}
        />

        <p style={{ margin: "0 0 32px 0" }}>
          Users navigate to Settings, enter their phone number, and complete SMS
          verification to confirm consent.
        </p>

        <nav
          style={{
            borderTop: "1px solid var(--session-ink-faint, #e0d9d0)",
            paddingTop: 20,
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <a
            href="/sms"
            style={{ color: "var(--session-ink-mid)", textDecoration: "underline" }}
          >
            SMS Info
          </a>
          <a
            href="/privacy"
            style={{ color: "var(--session-ink-mid)", textDecoration: "underline" }}
          >
            Privacy Policy
          </a>
          <a
            href="/terms"
            style={{ color: "var(--session-ink-mid)", textDecoration: "underline" }}
          >
            Terms of Service
          </a>
        </nav>
      </div>
    </div>
  );
}
