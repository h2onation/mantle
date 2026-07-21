import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { PERSONA_NAME_FORMAL } from "@/lib/persona/config";

export const metadata: Metadata = {
  title: `Privacy Policy — ${BRAND.name}`,
};

export default function PrivacyPolicy() {
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
          Privacy Policy
        </h1>
        <p style={{ color: "var(--session-ink-mid)", margin: "0 0 32px 0" }}>
          Last updated: May 18, 2026
        </p>

        <p>
          {BRAND.legalEntity} (&ldquo;{BRAND.name},&rdquo; &ldquo;we,&rdquo;
          &ldquo;us,&rdquo; &ldquo;our&rdquo;) operates the {PERSONA_NAME_FORMAL}{" "}
          conversational platform at {BRAND.domain}. This policy describes how we
          collect, use, and protect your information.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          What We Collect
        </h2>

        <p>
          <strong>Account information:</strong> email address, display name, and
          authentication credentials when you create an account.
        </p>
        <p>
          <strong>Phone number:</strong> if you choose to link your phone number
          to text {PERSONA_NAME_FORMAL} via MMS. Your number is verified via SMS and stored
          securely.
        </p>
        <p>
          <strong>Conversation data:</strong> the messages you exchange with
          {PERSONA_NAME_FORMAL}, both on the web app and via text message. This includes text
          content and any behavioral patterns identified during your
          conversations.
        </p>
        <p>
          <strong>Manual content:</strong> the entries you confirm during
          conversations with {PERSONA_NAME_FORMAL} that make up your Manual.
        </p>
        <p>
          <strong>Usage data:</strong> basic analytics such as session frequency
          and feature usage. We do not track your activity outside of {BRAND.name}.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          How We Use Your Information
        </h2>

        <ul style={{ paddingLeft: 20, margin: "0 0 16px 0" }}>
          <li>
            To provide the {PERSONA_NAME_FORMAL} conversational experience and build your User
            Manual.
          </li>
          <li>
            To send you text messages when you initiate a conversation via MMS.
          </li>
          <li>
            To improve the quality of {PERSONA_NAME_FORMAL}&apos;s responses and the overall
            product experience.
          </li>
        </ul>
        <p>Your conversations are not used to train AI models.</p>
        <p>
          We do not sell your personal information. We do not share your data
          with third parties for marketing purposes.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Third-Party Services
        </h2>

        <p>
          <strong>Anthropic:</strong> your conversation content is processed by
          Anthropic&apos;s Claude language model to generate {PERSONA_NAME_FORMAL}&apos;s
          responses. Anthropic&apos;s usage policies apply to this processing.
        </p>
        <p>
          <strong>Supabase:</strong> your account data and conversation history
          are stored in Supabase, a cloud database provider.
        </p>
        <p>
          <strong>SMS/MMS provider:</strong> if you use the text messaging
          feature, your phone number and message content are transmitted through
          our SMS infrastructure provider.
        </p>
        <p>
          <strong>Vercel:</strong> the application is hosted on Vercel&apos;s
          platform.
        </p>
        <p>
          We select providers that maintain industry-standard security practices.
          We do not control their privacy policies and encourage you to review
          them independently.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Analytics
        </h2>
        <p>
          We use PostHog to understand which features are working and which are
          confusing. We track events like &ldquo;you started a conversation&rdquo;
          or &ldquo;you viewed your Manual&rdquo; &mdash; but we do not record
          your screen, we do not send your conversation content, your Manual
          content, or your messages to any third party. Your user ID is hashed
          before it reaches PostHog. You can opt out by enabling &ldquo;Do Not
          Track&rdquo; in your browser.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Data Retention
        </h2>
        <p>
          Your conversation data and manual content are retained as long as your
          account is active. You can delete your account at any time through the
          app&apos;s Settings, which removes your conversations, manual entries,
          linked phone numbers, and group chats you owned.
        </p>
        <p>
          We retain limited administrative access logs (records of which admin
          accessed which user account, when, and for what purpose) for security,
          abuse investigation, and audit purposes. These logs reference your
          user ID but contain no message content, manual content, or other
          personal information. We retain them for as long as needed for these
          purposes and then delete them.
        </p>
        <p>You can export your Manual as a PDF at any time through the app.</p>

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
          You can share your Manual by exporting it as a PDF from the app. The
          PDF reflects the entries you have confirmed at the time you export it.
          You control what you include and who you send it to. Once a PDF leaves
          your device, the recipient holds an independent copy that we cannot
          recall.
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
          If you link your phone number, you consent to receiving text messages
          from {PERSONA_NAME_FORMAL} at the number you provided. Messages are sent only in
          response to conversations you initiate. You can stop receiving messages
          at any time by texting STOP. Message and data rates may apply. Message
          frequency varies based on your usage. No mobile information
          collected as part of the SMS opt-in process will be shared with or
          sold to third parties or affiliates for marketing or promotional
          purposes.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Security
        </h2>
        <p>
          We use encryption in transit (HTTPS/TLS) and follow standard security
          practices for data storage. However, MMS text messages are not
          end-to-end encrypted. Do not share information via text that you would
          not include in a standard text message.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Data Breach Notification
        </h2>
        <p>
          If we become aware of a security breach that has compromised the
          confidentiality, integrity, or availability of your personal
          information, we will notify you and any applicable regulators in
          accordance with the timeframes and procedures required by law. We
          will tell you what happened, what information was involved, and what
          you can do to protect yourself.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Your Rights
        </h2>
        <p>
          You may request access to, correction of, or deletion of your personal
          data by contacting us at {BRAND.supportEmail}. We will respond
          within 30 days.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          Your California Privacy Rights
        </h2>
        <p>
          If you are a California resident, the California Consumer Privacy Act
          (CCPA), as amended by the California Privacy Rights Act (CPRA), gives
          you specific rights regarding your personal information.
        </p>
        <p>
          <strong>Categories of personal information we collect:</strong>{" "}
          identifiers (email, user ID, phone number); internet or electronic
          network activity (session activity, feature usage); content you
          provide (conversation messages, manual entries); and inferences drawn
          from the above (behavioral patterns you have confirmed during
          conversations with {PERSONA_NAME_FORMAL}).
        </p>
        <p>
          <strong>Sources of personal information:</strong> directly from you;
          from your device when you use the service; from our service providers
          (Supabase, Anthropic, Vercel, our SMS provider, PostHog) acting on
          our behalf.
        </p>
        <p>
          <strong>Business purposes for which we use it:</strong> to provide
          and operate the service, build your Manual, send messages you
          initiate, secure the service, prevent abuse, and improve product
          quality.
        </p>
        <p>
          <strong>We do not sell or share your personal information</strong>{" "}
          (including for cross-context behavioral advertising) as those terms
          are defined under the CCPA.
        </p>
        <p>
          <strong>Your rights:</strong> the right to know what personal
          information we collect, use, and disclose about you; the right to
          delete personal information; the right to correct inaccurate personal
          information; the right to opt out of sale or sharing (we do not sell
          or share); and the right not to be discriminated against for
          exercising these rights. To exercise any of these rights, contact us
          at {BRAND.supportEmail}. We will verify your request by matching
          identifiers you provide (such as your account email) against the
          information we have on file.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 400,
            margin: "32px 0 12px 0",
          }}
        >
          International Users
        </h2>
        <p>
          {BRAND.name} is operated from the United States. If you access the
          service from outside the United States, your information will be
          transferred to and processed in the United States, where data
          protection laws may differ from those in your jurisdiction. By using{" "}
          {BRAND.name}, you consent to this transfer. If you are located in the
          European Economic Area, the United Kingdom, or another jurisdiction
          with comprehensive data protection laws, you may have additional
          rights under local law; contact us at {BRAND.supportEmail} to
          exercise them.
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
          We may update this policy from time to time. Continued use of{" "}
          {BRAND.name} after changes constitutes acceptance.
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
