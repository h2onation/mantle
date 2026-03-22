import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Mantle",
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
          Last updated: March 14, 2026
        </p>

        <p>
          Mantle (&ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;)
          operates the Sage conversational platform at trustthemantle.com. This
          policy describes how we collect, use, and protect your information.
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
          to text Sage via MMS. Your number is verified via SMS and stored
          securely.
        </p>
        <p>
          <strong>Conversation data:</strong> the messages you exchange with
          Sage, both on the web app and via text message. This includes text
          content and any behavioral patterns identified during your
          conversations.
        </p>
        <p>
          <strong>Manual content:</strong> the components and patterns that make
          up your User Manual, which you review and confirm during conversations
          with Sage.
        </p>
        <p>
          <strong>Usage data:</strong> basic analytics such as session frequency
          and feature usage. We do not track your activity outside of Mantle.
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
            To provide the Sage conversational experience and build your User
            Manual.
          </li>
          <li>
            To send you text messages when you initiate a conversation via MMS.
          </li>
          <li>
            To improve the quality of Sage&apos;s responses and the overall
            product experience.
          </li>
        </ul>
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
          Anthropic&apos;s Claude language model to generate Sage&apos;s
          responses. Anthropic&apos;s usage policies apply to this processing.
        </p>
        <p>
          <strong>Supabase:</strong> your account data and conversation history
          are stored in Supabase, a cloud database provider.
        </p>
        <p>
          <strong>Twilio:</strong> if you use the MMS feature, your phone number
          and message content are transmitted through Twilio&apos;s messaging
          infrastructure.
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
          Data Retention
        </h2>
        <p>
          Your conversation data and manual content are retained as long as your
          account is active. You can delete your account at any time through the
          app&apos;s Settings, which removes all associated data including
          conversations, manual entries, and linked phone numbers.
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
          from Sage at the number you provided. Messages are sent only in
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
          Your Rights
        </h2>
        <p>
          You may request access to, correction of, or deletion of your personal
          data by contacting us at jeff@trustthemantle.com. We will respond
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
          Changes
        </h2>
        <p>
          We may update this policy from time to time. Continued use of Mantle
          after changes constitutes acceptance.
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
        <p>jeff@trustthemantle.com</p>

        <div
          style={{
            marginTop: 48,
            paddingTop: 20,
            borderTop: "1px solid var(--session-ink-hairline)",
          }}
        >
          <a
            href="https://trustthemantle.com"
            style={{
              color: "var(--session-sage)",
              textDecoration: "none",
              fontSize: 13,
            }}
          >
            trustthemantle.com
          </a>
        </div>
      </div>
    </div>
  );
}
