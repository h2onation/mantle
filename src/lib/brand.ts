/**
 * The brand sheet — single source of truth for every user-facing brand value.
 *
 * The product rebrand (brand-factory plan, 2026-07-21) flips THIS file plus
 * the static assets listed below; no other code changes. Values here must
 * stay in lockstep with what shipped, so the sweep that introduced this file
 * kept every rendered string byte-identical.
 *
 * NOT covered by this file (the at-cutover checklist, mirrored on
 * /admin/brand):
 * - Static assets: public/icons/*, public/apple-touch-icon.png,
 *   public/persona-contact.vcf (contact-card name), public/offline.html
 * - External dashboards: Vercel domains, Supabase auth site URL + email
 *   templates, Google OAuth consent screen
 * - Internal identifiers deliberately left alone (invisible to users):
 *   localStorage keys (`mywalnut.theme`), CSS tokens (`--session-walnut-*`),
 *   log-salt fallback, PostHog keys
 */
export const BRAND = {
  /** Product name as brand-styled: wordmarks, titles, labels (lowercase). */
  name: "mywalnut",
  /** Product name at sentence position in prose. */
  nameCap: "Mywalnut",
  /** Bare domain, no protocol — link labels, "Built with" lines. */
  domain: "mywalnut.app",
  /** Canonical origin for metadata, sitemap, absolute links. */
  url: "https://mywalnut.app",
  supportEmail: "hello@mywalnut.app",
  /**
   * Legal operator. Stays "mywalnut, Inc." even after the product rebrand —
   * the company operates the branded product (house-of-brands structure).
   */
  legalEntity: "mywalnut, Inc.",
  /** Default meta description. */
  tagline: "Understand how you operate.",
} as const;
