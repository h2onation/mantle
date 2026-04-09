"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WaitlistForm from "@/components/shared/WaitlistForm";

// Wrapped in Suspense because useSearchParams forces the page into a
// client-only render boundary in Next 14 — without it, the build will warn
// about deopting to client-side rendering at the page level.
export default function WaitlistPage() {
  return (
    <Suspense fallback={<WaitlistContent notAllowlisted={false} />}>
      <WaitlistContentFromParams />
    </Suspense>
  );
}

function WaitlistContentFromParams() {
  const params = useSearchParams();
  const notAllowlisted = params.get("reason") === "not_allowlisted";
  return <WaitlistContent notAllowlisted={notAllowlisted} />;
}

function WaitlistContent({ notAllowlisted }: { notAllowlisted: boolean }) {

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      {/* Wordmark */}
      <div
        style={{
          padding: "16px 0",
          textAlign: "center",
          fontFamily: "var(--font-serif)",
          fontSize: 13,
          fontWeight: 400,
          letterSpacing: "15px",
          color: "var(--session-ink-faded)",
          paddingLeft: 15,
        }}
      >
        MYWALNUT
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 28px",
          maxWidth: 480,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {notAllowlisted && (
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 8,
              fontWeight: 500,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--session-ink-faded)",
              margin: "0 0 12px 0",
            }}
          >
            EARLY ACCESS
          </p>
        )}

        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 28,
            fontWeight: 400,
            color: "var(--session-ink)",
            margin: "0 0 16px 0",
          }}
        >
          {notAllowlisted ? "You're not on the beta yet" : "Join the waitlist"}
        </h1>

        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 16,
            color: "var(--session-ink-mid)",
            lineHeight: 1.5,
            margin: "0 0 32px 0",
          }}
        >
          {notAllowlisted
            ? "mywalnut is invite-only right now. Drop your email and we'll reach out when there's a spot."
            : "mywalnut is in early access. Drop your email and we'll reach out when there's a spot."}
        </p>

        <WaitlistForm />
      </div>
    </div>
  );
}
