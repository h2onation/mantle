import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — mywalnut",
};

export default function TermsOfService() {
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
          Terms of Service
        </h1>
        <p style={{ color: "var(--session-ink-mid)", margin: "0 0 32px 0" }}>
          Last updated: March 14, 2026
        </p>

        <p>
          These terms govern your use of mywalnut and the Sage conversational
          platform at mywalnut.app.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          What mywalnut Is
        </h2>
        <p>
          mywalnut is a self-understanding platform. It is not a mental health
          service, clinical tool, or diagnostic instrument. Sage does not
          diagnose, assess, or treat any condition. The manual is a
          self-authored document. It is not clinical documentation and should
          not be used as a legal accommodation document.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          What mywalnut Is Not
        </h2>
        <p>
          mywalnut is not therapy, counseling, or a mental health service. Sage is
          not a therapist, counselor, or medical professional. Sage does not
          diagnose conditions, prescribe treatments, or provide clinical
          interventions. If you are experiencing a mental health crisis, contact
          the 988 Suicide and Crisis Lifeline (call or text 988) or the Crisis
          Text Line (text HOME to 741741).
        </p>
        <p>
          Sage does not assess or pathologize any condition. The manual is a
          self-authored document reflecting your own understanding of how you
          work. It is not clinical documentation and should not be used as a
          legal accommodation document or submitted as medical evidence.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Accounts
        </h2>
        <p>
          You must be at least 18 years old to use mywalnut. You are responsible
          for maintaining the security of your account credentials. One account
          per person.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          MMS Messaging
        </h2>
        <p>
          By linking your phone number and texting Sage, you consent to receive
          MMS messages from mywalnut. Messages are conversational responses
          initiated by you.
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 16px 0" }}>
          <li>Message frequency: varies based on your usage.</li>
          <li>Message and data rates may apply.</li>
          <li>To opt out: text STOP at any time.</li>
          <li>
            For help: text HELP or email jeff@mywalnut.app.
          </li>
        </ul>
        <p>
          You may also be invited to group text conversations by other mywalnut
          users. You will receive one introductory message. You can decline to
          participate by not responding or by texting STOP.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Your Content
        </h2>
        <p>
          The conversations you have with Sage and the User Manual entries you
          confirm belong to you. We do not claim ownership of your content. We
          use your content only to provide and improve the Sage experience.
        </p>
        <p>
          If you share your manual, you control what is visible and who can see
          it.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Sharing
        </h2>
        <p>
          You may choose to share parts of your manual with others. Shared
          content is view-only. Recipients may ask Sage questions about your
          shared manual. Sage will only reference content you have explicitly
          shared. You can revoke sharing at any time. Recipients cannot modify
          your manual.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Limitations
        </h2>
        <p>
          Sage&apos;s reflections are based on patterns identified in your
          conversations. They may not always be accurate. You have full control
          over what gets written to your manual — nothing is saved without your
          confirmation. We make no guarantees about the accuracy, completeness,
          or usefulness of Sage&apos;s observations.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Acceptable Use
        </h2>
        <p>
          Do not use mywalnut to harm, harass, or impersonate others. Do not
          attempt to manipulate Sage into producing harmful content. Do not
          invite others to group conversations without their knowledge or against
          their wishes.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Privacy
        </h2>
        <p>
          Your use of mywalnut is also governed by our{" "}
          <a
            href="/privacy"
            style={{ color: "var(--session-sage)", textDecoration: "none" }}
          >
            Privacy Policy
          </a>
          .
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Termination
        </h2>
        <p>
          You can delete your account at any time through Settings. We may
          suspend or terminate accounts that violate these terms.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Changes
        </h2>
        <p>
          We may update these terms. Continued use after changes constitutes
          acceptance.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Contact
        </h2>
        <p>jeff@mywalnut.app</p>

        <div
          style={{
            marginTop: 48,
            paddingTop: 20,
            borderTop: "1px solid var(--session-ink-hairline)",
          }}
        >
          <a
            href="https://mywalnut.app"
            style={{
              color: "var(--session-sage)",
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            mywalnut.app
          </a>
        </div>
      </div>
    </div>
  );
}
