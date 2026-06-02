// ---------------------------------------------------------------------------
// Vendor registry — canonical inventory of every third-party service the app
// integrates with (or is considering).
//
// This is the single source of truth. The admin page at /admin/vendors renders
// from this file, and docs link here rather than maintaining a parallel list.
// When adding, removing, or changing a vendor, edit this file.
// ---------------------------------------------------------------------------

export type VendorStatus = "live" | "deprecated" | "potential";

export type VendorCategory =
  | "LLM"
  | "Database"
  | "Messaging"
  | "Speech"
  | "Analytics"
  | "RateLimit"
  | "Infra";

export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  status: VendorStatus;
  purpose: string;              // one sentence
  envVars: string[];            // exact env var names
  integrationPaths: string[];   // key file paths or directories
  webhookPath?: string;         // inbound webhook route, if any
  featureFlag?: string;         // env var that toggles routing, if any
  adrRefs: number[];            // ADR numbers in docs/decisions.md
  url?: string;                 // vendor homepage / docs
  notes?: string;               // anything not captured above
}

export const VENDORS: Vendor[] = [
  // ── LIVE ────────────────────────────────────────────────────────────────
  {
    id: "anthropic",
    name: "Anthropic",
    category: "LLM",
    status: "live",
    purpose:
      "LLM backbone for Jove conversation, extraction, summaries, and entry composition.",
    envVars: ["ANTHROPIC_API_KEY"],
    integrationPaths: [
      "src/lib/anthropic-sse.ts",
      "src/lib/persona/call-persona.ts",
      "src/lib/persona/extraction.ts",
      "src/lib/persona/generate-summary.ts",
      "src/lib/persona/confirm-checkpoint.ts",
    ],
    adrRefs: [8, 11],
    url: "https://docs.anthropic.com",
    notes:
      "Raw fetch only (ADR-008), no SDK. Streaming via SSE for Jove; blocking for extraction and composition. Two-tier model use: Sonnet for reasoning, Haiku where speed matters (ADR-011).",
  },
  {
    id: "supabase",
    name: "Supabase",
    category: "Database",
    status: "live",
    purpose:
      "Postgres database, auth, RLS enforcement, and admin-role provisioning via JWT claims.",
    envVars: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
    integrationPaths: [
      "src/lib/supabase/server.ts",
      "src/lib/supabase/admin.ts",
      "src/lib/supabase/client.ts",
      "supabase/migrations/",
    ],
    adrRefs: [19, 36],
    url: "https://supabase.com",
    notes:
      "Three-client pattern: server (auth verify only), admin (service role, bypasses RLS), browser (RLS). Schema changes only via migrations committed to repo (ADR-036) — never dashboard SQL.",
  },
  {
    id: "sendblue",
    name: "Sendblue",
    category: "Messaging",
    status: "live",
    purpose:
      "1:1 SMS / iMessage delivery. Primary provider for the direct user channel.",
    envVars: [
      "SENDBLUE_API_KEY_ID",
      "SENDBLUE_API_SECRET_KEY",
      "SENDBLUE_WEBHOOK_SECRET",
      "SENDBLUE_FROM_NUMBER",
    ],
    integrationPaths: [
      "src/lib/messaging/sendblue.ts",
      "src/lib/messaging/send.ts",
    ],
    webhookPath: "/api/webhooks/sendblue",
    featureFlag: "MESSAGING_PROVIDER (default: sendblue for 1:1)",
    adrRefs: [35, 37, 39, 41],
    url: "https://sendblue.co",
    notes:
      "Webhook auth is constant-time compare of the shared sb-signing-secret header — no HMAC (ADR-039). Inbound content is redacted before logging (ADR-037).",
  },
  {
    id: "deepgram",
    name: "Deepgram",
    category: "Speech",
    status: "live",
    purpose: "Voice-to-text for mobile voice input.",
    envVars: ["DEEPGRAM_API_KEY"],
    integrationPaths: [
      "src/app/api/voice/token/route.ts",
      "src/lib/hooks/useVoiceInput.ts",
    ],
    adrRefs: [],
    url: "https://deepgram.com",
    notes:
      "No ADR for this choice yet — vendor selected pragmatically. Key is passed client-side because the current plan tier does not support temporary token issuance; revisit if upgrading.",
  },
  {
    id: "posthog",
    name: "PostHog",
    category: "Analytics",
    status: "live",
    purpose:
      "Event-based product analytics. Autocapture and session recording are permanently disabled.",
    envVars: ["NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_POSTHOG_HOST"],
    integrationPaths: [
      "src/lib/analytics/posthog-client.ts",
      "src/components/PostHogProvider.tsx",
      "src/lib/analytics/events.ts",
    ],
    adrRefs: [],
    url: "https://posthog.com",
    notes:
      "No ADR. Event tracking only — autocapture off, session replay off. Conversation content is sensitive; do not enable replay or autocapture without a privacy review.",
  },
  {
    id: "vercel",
    name: "Vercel",
    category: "Infra",
    status: "live",
    purpose:
      "Hosting, serverless + edge runtime, env-var management, GitHub-triggered CI/CD.",
    envVars: ["VERCEL_ENV"],
    integrationPaths: [
      "Implicit via Next.js runtime",
      "src/lib/rate-limit.ts (VERCEL_ENV branch)",
    ],
    adrRefs: [],
    url: "https://vercel.com",
    notes:
      "Pro tier required — free tier kills functions at 10s and Jove takes 5–8s. SMS webhook routes must use Node runtime, not Edge.",
  },

  // ── DEPRECATED ──────────────────────────────────────────────────────────
  {
    id: "linq",
    name: "Linq",
    category: "Messaging",
    status: "deprecated",
    purpose:
      "Group iMessage facilitator (chat creation, participant lifecycle) and fallback 1:1 provider.",
    envVars: ["LINQ_API_TOKEN", "LINQ_WEBHOOK_SECRET", "LINQ_PHONE_NUMBER"],
    integrationPaths: [
      "src/lib/linq/",
      "src/lib/messaging/linq.ts",
      "src/lib/messaging/send.ts",
    ],
    webhookPath: "/api/linq/webhook",
    featureFlag:
      "MESSAGING_PROVIDER (groups always Linq; 1:1 only if MESSAGING_PROVIDER=linq)",
    adrRefs: [35],
    url: "https://linq.app",
    notes:
      "Deprecated — no further investment. Sendblue is now primary for 1:1 (ADR-035, ADR-041). Code still ships and routes groups today; replacement decision pending.",
  },

  // ── POTENTIAL ───────────────────────────────────────────────────────────
  // Add future-consideration vendors here. Minimum: id, name, category,
  // status: "potential", purpose. envVars / integrationPaths can be empty.
  {
    id: "upstash",
    name: "Upstash Redis",
    category: "RateLimit",
    status: "live",
    purpose:
      "Sliding-window rate limiting for /api/chat, OTP send/verify, and waitlist.",
    envVars: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    integrationPaths: [
      "src/lib/rate-limit.ts",
      "src/app/api/chat/route.ts",
      "src/app/api/user/phone/route.ts",
      "src/app/api/user/phone/verify/route.ts",
      "src/app/api/waitlist/route.ts",
    ],
    adrRefs: [38],
    url: "https://upstash.com",
    notes:
      "Provisioned 2026-06-02 (helpful-gelding-101035.upstash.io). Env vars set in .env.local and Vercel. Rate limiters now active in production. Hard-fail at module load (VERCEL_ENV=production) ensures a lapsed credential surfaces immediately rather than silently failing open.",
  },
];
