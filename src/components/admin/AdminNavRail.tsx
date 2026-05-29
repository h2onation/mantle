"use client";

import Link from "next/link";
import { PERSONA_NAME } from "@/lib/persona/config";

interface NavItem {
  id: string;
  label: string;
  href: string;
  indent?: boolean;
}

// Grouped by visual hierarchy. Hairlines render between groups; indented
// items render as children of the parent above them ("How Jove works").
const NAV_GROUPS: NavItem[][] = [
  // Operational
  [
    { id: "users", label: "Users", href: "/admin?section=users" },
    { id: "beta", label: "Beta", href: "/admin?section=beta" },
    { id: "feedback", label: "Feedback", href: "/admin?section=feedback" },
    { id: "health", label: "Health", href: "/admin?section=health" },
  ],
  // System tour + reference
  [
    { id: "how-it-works", label: "How Jove works", href: "/admin/how-it-works" },
    {
      id: "prompt-architecture",
      label: `${PERSONA_NAME}'s prompt architecture`,
      href: "/admin/prompt-architecture",
      indent: true,
    },
    {
      id: "extraction-map",
      label: "Jove's extraction of user messages",
      href: "/admin/extraction-map",
      indent: true,
    },
    {
      id: "schema-map",
      label: "Database schema",
      href: "/admin/schema-map",
      indent: true,
    },
    { id: "docs", label: "Source docs", href: "/admin/docs" },
  ],
  // Utility lookups
  [
    { id: "skills", label: "Agents & Skills", href: "/admin/skills" },
    { id: "vendors", label: "Vendors", href: "/admin/vendors" },
  ],
];

export default function AdminNavRail({
  activeId,
  badges,
}: {
  activeId: string;
  badges?: Record<string, number>;
}) {
  return (
    <nav
      className="admin-rail"
      style={{
        width: 180,
        borderRight: "1px solid var(--session-ink-hairline)",
        padding: "20px 12px",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          letterSpacing: "2px",
          color: "var(--session-ink-ghost)",
          padding: "4px 12px 10px",
        }}
      >
        ADMIN
      </div>
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {gi > 0 && (
            <div
              style={{
                height: 1,
                background: "var(--session-ink-hairline)",
                margin: "8px 8px",
              }}
              aria-hidden="true"
            />
          )}
          {group.map((item) => {
            const active = item.id === activeId;
            const badge = badges?.[item.id];
            return (
              <Link
                key={item.id}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color: active
                    ? "var(--session-ink)"
                    : "var(--session-ink-ghost)",
                  background: active ? "rgba(255,255,255,0.6)" : "none",
                  borderRadius: 6,
                  padding: item.indent ? "6px 12px 6px 24px" : "8px 12px",
                  textDecoration: "none",
                  fontWeight: active ? 500 : 400,
                }}
              >
                <span>{item.label}</span>
                {badge != null && badge > 0 && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--size-meta)",
                      color: "var(--session-cream)",
                      background: "var(--session-error)",
                      borderRadius: 10,
                      padding: "1px 6px",
                    }}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <a
        href="/app"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          color: "var(--session-ink-ghost)",
          letterSpacing: "1px",
          padding: "8px 12px",
          textDecoration: "none",
        }}
      >
        ← EXIT ADMIN
      </a>
    </nav>
  );
}
