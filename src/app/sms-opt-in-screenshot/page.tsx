import Image from "next/image";
import Link from "next/link";

export default function SmsOptInScreenshot() {
  return (
    <main
      className="scrollable-page"
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "48px 24px",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        color: "#3a3632",
        background: "#f5f0eb",
        minHeight: "100vh",
      }}
    >
      <h1
        style={{
          fontSize: "24px",
          fontWeight: 400,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        SMS Opt-In Flow
      </h1>

      <p
        style={{
          fontSize: "15px",
          color: "#8a8480",
          lineHeight: 1.6,
          marginBottom: 32,
        }}
      >
        Below is a screenshot of how users opt in to receive SMS messages from
        Sage within the Mantle app.
      </p>

      <div
        style={{
          border: "1px solid rgba(26, 22, 20, 0.1)",
          borderRadius: 12,
          overflow: "hidden",
          marginBottom: 32,
          maxWidth: 320,
          margin: "0 auto 32px auto",
        }}
      >
        <Image
          src="/sms-opt-in.png"
          alt="Screenshot of SMS opt-in flow in the Mantle app Settings page, showing phone number input, consent disclosure text, and Send verification code button"
          width={320}
          height={552}
          style={{ width: "100%", height: "auto", display: "block" }}
          priority
        />
      </div>

      <p
        style={{
          fontSize: "15px",
          color: "#8a8480",
          lineHeight: 1.6,
          marginBottom: 40,
        }}
      >
        Users navigate to Settings, enter their phone number, and complete SMS
        verification to confirm consent.
      </p>

      <nav
        style={{
          display: "flex",
          gap: 24,
          fontSize: "13px",
          borderTop: "1px solid rgba(26, 22, 20, 0.1)",
          paddingTop: 24,
        }}
      >
        <Link href="/sms" style={{ color: "#8a8480", textDecoration: "underline" }}>
          SMS
        </Link>
        <Link href="/privacy" style={{ color: "#8a8480", textDecoration: "underline" }}>
          Privacy Policy
        </Link>
        <Link href="/terms" style={{ color: "#8a8480", textDecoration: "underline" }}>
          Terms
        </Link>
      </nav>
    </main>
  );
}
