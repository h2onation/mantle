"use client";

import { useEffect, useState } from "react";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";

/**
 * Admin-only "new signups" badge shown over the app. For the founder while
 * they're using mywalnut: a quiet pill that surfaces the count of pending
 * (status = 'waiting') waitlist entries and links straight to the admin
 * waitlist. Renders nothing for non-admins or when there's nothing pending.
 */
export default function AdminSignupsBadge() {
  const isAdmin = useIsAdmin();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    fetch("/api/admin/waitlist/count")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (active && j) setCount(j.waiting || 0);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isAdmin]);

  if (!isAdmin || count <= 0) return null;

  return (
    <a
      href="/admin?section=beta"
      aria-label={`${count} new signup${count === 1 ? "" : "s"} — open admin`}
      style={{
        position: "fixed",
        top: 10,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-mono)",
        fontSize: "var(--size-meta)",
        letterSpacing: "0.06em",
        color: "var(--session-cream)",
        background: "var(--session-walnut)",
        border: "1px solid var(--session-walnut-border)",
        borderRadius: "var(--radius-pill)",
        padding: "4px 12px",
        textDecoration: "none",
        boxShadow: "var(--lift)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--session-cream)",
        }}
      />
      {count} new signup{count === 1 ? "" : "s"}
    </a>
  );
}
