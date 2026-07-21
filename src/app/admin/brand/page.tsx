"use client";

import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";
import { BRAND } from "@/lib/brand";

// ---------------------------------------------------------------------------
// Brand sheet — read-only view of src/lib/brand.ts (canonical).
//
// This page renders the live constants, so it can never drift from what
// ships. Editing happens in code (one file, one deploy), not here. Graduates
// to an editable Brands page only when a second brand exists (brand-factory
// plan, 2026-07-21).
// ---------------------------------------------------------------------------

const ROWS: { value: string; label: string; appearsIn: string }[] = [
  {
    value: BRAND.name,
    label: "Product name (brand-styled)",
    appearsIn:
      "Wordmarks (top bar, room header, desktop masthead, login shell), browser/page titles, PWA app name, PDF export header, SMS + OTP copy, OG share card, contact-card filename",
  },
  {
    value: BRAND.nameCap,
    label: "Product name (sentence position)",
    appearsIn: "Landing-page prose, legal-page prose",
  },
  {
    value: BRAND.domain,
    label: "Domain (bare)",
    appearsIn:
      "Link labels (landing footer, SMS page), login back-link, PDF “Built with” footer, SMS copy",
  },
  {
    value: BRAND.url,
    label: "Canonical origin",
    appearsIn: "SEO metadata base, sitemap, robots, OG url, absolute links",
  },
  {
    value: BRAND.supportEmail,
    label: "Support email",
    appearsIn: "Landing footer, Privacy, Terms",
  },
  {
    value: BRAND.legalEntity,
    label: "Legal operator — STAYS after a product rebrand",
    appearsIn: "Privacy, Terms, landing footer (house-of-brands structure)",
  },
  {
    value: BRAND.tagline,
    label: "Tagline / meta description",
    appearsIn: "Default meta description, PWA description",
  },
];

const OUTSIDE_SHEET: { item: string; note: string }[] = [
  {
    item: "Logo + app icons",
    note: "public/icons/*, public/apple-touch-icon.png — static image files, swapped at cutover",
  },
  {
    item: "Contact card",
    note: "public/persona-contact.vcf — the “Jove (mywalnut)” name saved to a user's phone",
  },
  {
    item: "Vercel domains",
    note: "New domain added + made primary at cutover; old domain redirects",
  },
  {
    item: "Supabase auth",
    note: "Site URL + magic-link redirect URLs + auth email templates (dashboard)",
  },
  {
    item: "Google OAuth consent screen",
    note: "App name + authorized domain shown at Google sign-in (Google Cloud console)",
  },
  {
    item: "Theme colors",
    note: "globals.css design tokens — restyled with the new brand's palette, a design pass, not a string swap",
  },
  {
    item: "Landing + waitlist wordmark art",
    note: "The hero splits the name around the word rotator (my·walnut) and the waitlist styles it as “my walnut” — design elements, not strings; the new brand's landing replaces both pages wholesale",
  },
];

const LEFT_ALONE =
  "Deliberately untouched because users never see them: localStorage keys (mywalnut.theme), CSS token names (--session-walnut-*), log-salt fallback, analytics keys, code comments, the legacy /narrative preview pages.";

export default function BrandPage() {
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return (
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          color: "var(--session-ink-ghost)",
          letterSpacing: "1px",
          padding: "80px 24px",
          textAlign: "center",
        }}
      >
        Not authorized.
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--session-linen)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--session-error)",
          textAlign: "center",
          padding: "6px 0",
          borderBottom: "1px solid var(--session-error-ghost)",
          background: "var(--session-error-banner)",
          flexShrink: 0,
        }}
      >
        Read Only — Admin
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <AdminNavRail activeId="brand" />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              borderBottom: "1px solid var(--session-ink-hairline)",
              padding: "18px 32px",
              display: "flex",
              flexWrap: "wrap",
              gap: 18,
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-spectral, var(--font-serif))",
                fontSize: "22px",
                fontWeight: 400,
                fontStyle: "italic",
                color: "var(--session-ink)",
                letterSpacing: "-0.005em",
              }}
            >
              Brand sheet
            </div>
            <div
              style={{
                width: 1,
                height: 22,
                background: "var(--session-ink-hairline)",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "var(--session-ink-ghost)",
                letterSpacing: "0.5px",
              }}
            >
              live values from src/lib/brand.ts — the rebrand flips this one
              file + the items below
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px 80px" }}>
            <Section title="The sheet — every user-facing brand value">
              {ROWS.map((row) => (
                <div
                  key={row.label}
                  style={{
                    borderBottom: "1px solid var(--session-ink-hairline)",
                    padding: "12px 0",
                  }}
                >
                  <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "14px",
                        color: "var(--session-ink)",
                      }}
                    >
                      {row.value}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "12px",
                        color: "var(--session-ink-faded)",
                      }}
                    >
                      {row.label}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      color: "var(--session-ink-ghost)",
                      marginTop: 4,
                      lineHeight: 1.5,
                    }}
                  >
                    Appears in: {row.appearsIn}
                  </div>
                </div>
              ))}
            </Section>

            <Section title="Changes at cutover, but lives outside this sheet">
              {OUTSIDE_SHEET.map((row) => (
                <div
                  key={row.item}
                  style={{
                    borderBottom: "1px solid var(--session-ink-hairline)",
                    padding: "10px 0",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "var(--session-ink)",
                    }}
                  >
                    {row.item}
                  </span>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      color: "var(--session-ink-ghost)",
                      marginTop: 2,
                      lineHeight: 1.5,
                    }}
                  >
                    {row.note}
                  </div>
                </div>
              ))}
            </Section>

            <Section title="Left alone on purpose">
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  color: "var(--session-ink-ghost)",
                  lineHeight: 1.6,
                  margin: 0,
                  padding: "8px 0",
                }}
              >
                {LEFT_ALONE}
              </p>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 36, maxWidth: 760 }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: "var(--session-ink-faded)",
          paddingBottom: 6,
          borderBottom: "1px solid var(--session-ink-hairline)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
