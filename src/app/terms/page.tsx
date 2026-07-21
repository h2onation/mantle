import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { PERSONA_NAME_FORMAL } from "@/lib/persona/config";

export const metadata: Metadata = {
  title: `Terms of Service — ${BRAND.name}`,
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
          Last updated: May 18, 2026
        </p>

        <p>
          These terms govern your use of {BRAND.name} and the {PERSONA_NAME_FORMAL}{" "}
          conversational platform at {BRAND.domain}, operated by{" "}
          {BRAND.legalEntity} (&ldquo;{BRAND.name},&rdquo; &ldquo;we,&rdquo;
          &ldquo;us,&rdquo; &ldquo;our&rdquo;).
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Beta Service
        </h2>
        <p>
          {BRAND.name} is currently in beta. Features may change, break, or be
          removed without notice. We may reset, archive, or migrate data
          between beta phases — we will give you reasonable notice before doing
          so. The service is provided to beta participants on an &ldquo;as is&rdquo;
          basis.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          What {BRAND.name} Is
        </h2>
        <p>
          {BRAND.name} is a self-understanding platform. It is not a mental health
          service, clinical tool, or diagnostic instrument. {PERSONA_NAME_FORMAL} does not
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
          What {BRAND.name} Is Not
        </h2>
        <p>
          {BRAND.name} is not therapy, counseling, or a mental health service. {PERSONA_NAME_FORMAL} is
          not a therapist, counselor, or medical professional. {PERSONA_NAME_FORMAL} does not
          diagnose conditions, prescribe treatments, or provide clinical
          interventions. If you are experiencing a mental health crisis, contact
          the 988 Suicide and Crisis Lifeline (call or text 988) or the Crisis
          Text Line (text HOME to 741741).
        </p>
        <p>
          {PERSONA_NAME_FORMAL} does not assess or pathologize any condition. The manual is a
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
          You must be at least 18 years old to use {BRAND.name}. You are responsible
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
          Children Under 18
        </h2>
        <p>
          {BRAND.name} is not directed to children under 18 and we do not knowingly
          collect personal information from anyone under 18. If we learn that
          we have collected information from a person under 18, we will delete
          it. If you are a parent or guardian and believe your child has
          provided us with personal information, contact us at{" "}
          {BRAND.supportEmail}.
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
          By linking your phone number and texting {PERSONA_NAME_FORMAL}, you consent to receive
          MMS messages from {BRAND.name}. Messages are conversational responses
          initiated by you.
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 16px 0" }}>
          <li>Message frequency: varies based on your usage.</li>
          <li>Message and data rates may apply.</li>
          <li>
            To opt out: text STOP (or UNSUBSCRIBE, CANCEL, QUIT, END, OPT OUT)
            at any time.
          </li>
          <li>
            For help: text HELP (or INFO, SUPPORT) or email{" "}
            {BRAND.supportEmail}.
          </li>
        </ul>

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
          The conversations you have with {PERSONA_NAME_FORMAL} and the User Manual entries you
          confirm belong to you. We do not claim ownership of your content. We
          use your content only to provide and improve the {PERSONA_NAME_FORMAL} experience.
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
          You may export your Manual as a PDF and share it with others. The PDF
          reflects the entries you have confirmed at the time of export. You
          control what you include and who you send it to. Once a PDF leaves
          your device, the recipient holds an independent copy — we cannot
          revoke or modify it remotely.
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
          {PERSONA_NAME_FORMAL}&apos;s reflections are based on patterns identified in your
          conversations. They may not always be accurate. You have full control
          over what gets written to your manual — nothing is saved without your
          confirmation. We make no guarantees about the accuracy, completeness,
          or usefulness of {PERSONA_NAME_FORMAL}&apos;s observations.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Disclaimer of Warranties
        </h2>
        <p>
          {BRAND.name} is provided &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo;
          without warranties of any kind, whether express or implied, including
          but not limited to implied warranties of merchantability, fitness for
          a particular purpose, or non-infringement. We do not warrant that the
          service will be uninterrupted, error-free, or secure, or that any
          defects will be corrected. We do not warrant the accuracy,
          completeness, or reliability of any content generated by
          {" "}{PERSONA_NAME_FORMAL} or any output you receive from the service.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Limitation of Liability
        </h2>
        <p>
          To the maximum extent permitted by applicable law, in no event shall{" "}
          {BRAND.legalEntity}, its officers, directors, employees, agents, or
          affiliates be liable for any indirect, incidental, special,
          consequential, or punitive damages, including loss of profits, data,
          use, or goodwill, arising out of or related to your use of the
          service. Our total liability for any claim arising out of or related
          to these terms or the service shall not exceed one hundred U.S.
          dollars ($100) or the amount you have paid us in the twelve months
          preceding the claim, whichever is greater. Some jurisdictions do not
          allow these limitations, in which case they apply to the maximum
          extent permitted by law.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Indemnification
        </h2>
        <p>
          You agree to indemnify and hold harmless {BRAND.legalEntity}, its
          officers, directors, employees, agents, and affiliates from any
          claims, damages, losses, or expenses (including reasonable
          attorneys&apos; fees) arising out of or related to: (a) your use of
          the service in violation of these terms; (b) content you submit,
          share, or distribute through or from the service; or (c) your
          violation of any third party&apos;s rights.
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
          You agree not to: (a) use {BRAND.name} to harm, harass, defame, or
          impersonate others; (b) attempt to manipulate {PERSONA_NAME_FORMAL} into producing
          harmful, illegal, or deceptive content; (c) invite others to group
          conversations without their knowledge or against their wishes;
          (d) scrape, crawl, or use automated means to access the service or
          extract data from it; (e) reverse engineer, decompile, or attempt to
          derive the source code or models underlying the service; (f) use the
          service to develop a competing product, train a competing AI model,
          or build a similar dataset; or (g) interfere with the operation of
          the service or attempt to circumvent rate limits, security measures,
          or access controls.
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
          Your use of {BRAND.name} is also governed by our{" "}
          <a
            href="/privacy"
            style={{ color: "var(--session-persona)", textDecoration: "none" }}
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
          Governing Law and Disputes
        </h2>
        <p>
          These terms are governed by the laws of the State of California,
          without regard to its conflict-of-laws principles. The exclusive
          venue for any dispute arising out of or related to these terms or the
          service shall be the state or federal courts located in San
          Francisco County, California, and you consent to the personal
          jurisdiction of those courts. Nothing in these terms prevents either
          party from seeking equitable relief in any court of competent
          jurisdiction.
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
        <p>{BRAND.supportEmail}</p>

        <div
          style={{
            marginTop: 48,
            paddingTop: 20,
            borderTop: "1px solid var(--session-ink-hairline)",
          }}
        >
          <a
            href={BRAND.url}
            style={{
              color: "var(--session-persona)",
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            {BRAND.domain}
          </a>
        </div>
      </div>
    </div>
  );
}
