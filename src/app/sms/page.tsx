import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Messages from Sage — Mantle",
  description:
    "Personalized behavioral insights and conversation prompts from Sage, your AI guide on Mantle.",
};

export default function SmsPage() {
  return (
    <div
      className="scrollable-page"
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
          SMS Messages from Sage
        </h1>
        <p
          style={{
            color: "var(--session-ink-mid)",
            margin: "0 0 32px 0",
          }}
        >
          Program name: Sage by Mantle
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "0 0 12px 0",
          }}
        >
          What You&apos;ll Receive
        </h2>
        <p>
          Personalized behavioral insights and conversation prompts from Sage,
          your AI guide on Mantle.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          How to Opt In
        </h2>
        <p>
          Create an account at{" "}
          <a
            href="https://trustthemantle.com"
            style={{ color: "var(--session-sage)", textDecoration: "none" }}
          >
            trustthemantle.com
          </a>
          , go to Settings, enter your phone number, and complete SMS
          verification.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Frequency
        </h2>
        <p>Message frequency varies.</p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Rates
        </h2>
        <p>Msg &amp; data rates may apply.</p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Opt Out
        </h2>
        <p>Reply STOP at any time to unsubscribe.</p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Help
        </h2>
        <p>Reply HELP for support.</p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Data Sharing
        </h2>
        <p>
          No mobile information will be shared with third parties for marketing
          or promotional purposes.
        </p>

        <div
          style={{
            marginTop: 48,
            paddingTop: 20,
            borderTop: "1px solid var(--session-ink-hairline)",
            display: "flex",
            gap: 20,
          }}
        >
          <a
            href="/privacy"
            style={{
              color: "var(--session-sage)",
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            Privacy Policy
          </a>
          <a
            href="/terms"
            style={{
              color: "var(--session-sage)",
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            Terms and Conditions
          </a>
        </div>
      </div>
    </div>
  );
}
