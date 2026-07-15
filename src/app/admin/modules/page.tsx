"use client";

import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import AdminNavRail from "@/components/admin/AdminNavRail";
import ModulesPanel from "@/components/admin/ModulesPanel";

// Modules — the unified door + Manual-section rows, in the Controls group.
// Each module is simultaneously a way to begin on Home and a section of the
// Manual: conversations start inside one, and confirmed entries file under
// it. Data: /api/admin/modules.

export default function ModulesPage() {
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
        <AdminNavRail activeId="modules" />

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
              Modules
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
              A module is a door and a Manual section in one: it appears on Home
              as a way to begin, and entries confirmed inside it file under its
              name in the Manual. Each module can carry its own opening message
              and its own Jove prompt — leave the prompt blank and it runs the
              shared conductor from the Tuning page. Disabling a module hides
              the door but keeps its section and entries visible.
            </p>

            <ModulesPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
