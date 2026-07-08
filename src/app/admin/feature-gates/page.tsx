"use client";

import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";
import FeatureGatesPanel from "@/components/admin/FeatureGatesPanel";
import ComposerModePanel from "@/components/admin/ComposerModePanel";

// Feature gates — the global debug kill-switches, in the Controls group
// alongside Tuning (moved here from the Health section 2026-07-08: they're
// controls you flip, not monitoring you read). Each switch strips a subsystem
// out of the live loop for every user. Data: GET/PATCH /api/admin/feature-gates.

export default function FeatureGatesPage() {
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
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <AdminNavRail activeId="feature-gates" />

        <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
          <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 28px 80px" }}>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "26px",
                color: "var(--session-ink)",
                margin: "0 0 10px",
              }}
            >
              Feature gates
            </h1>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                lineHeight: 1.6,
                color: "var(--session-walnut-meta)",
                margin: "0 0 24px",
                maxWidth: 700,
              }}
            >
              Global debug kill-switches. Each one is ON by default; turning a
              switch OFF strips a whole subsystem out of the live loop for{" "}
              <strong>every</strong> user, so you can isolate the core voice +
              extraction loop when something looks off. These change behavior,
              not copy — the voice and copy live on the Tuning page next door.
            </p>

            <FeatureGatesPanel />
            <ComposerModePanel />
          </div>
        </div>
      </div>
    </div>
  );
}
