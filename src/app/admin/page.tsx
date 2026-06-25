"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import { useAdminData } from "@/lib/hooks/useAdminData";
import UsersTab from "@/components/admin/UsersTab";
import WaitlistTab from "@/components/admin/WaitlistTab";
import UserProfilePane from "@/components/admin/UserProfilePane";
import SchemaHealthTab from "@/components/admin/SchemaHealthTab";
import ConfirmHealthPanel from "@/components/admin/ConfirmHealthPanel";
import ApiErrorsPanel from "@/components/admin/ApiErrorsPanel";
import ActiveUsersPanel from "@/components/admin/ActiveUsersPanel";
import FeedbackSection from "@/components/admin/FeedbackSection";
import FeatureGatesPanel from "@/components/admin/FeatureGatesPanel";
import IntakeDoorsPanel from "@/components/admin/IntakeDoorsPanel";
import VoiceEditorPanel from "@/components/admin/VoiceEditorPanel";
import CheckpointTuningPanel from "@/components/admin/CheckpointTuningPanel";
import AdminNavRail from "@/components/admin/AdminNavRail";

type Section = "users" | "beta" | "feedback" | "tuning" | "health";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "users", label: "Users" },
  { id: "beta", label: "Beta" },
  { id: "feedback", label: "Feedback" },
  { id: "tuning", label: "Tuning" },
  { id: "health", label: "Health" },
];

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner() {
  const params = useSearchParams();
  const isAdmin = useIsAdmin();
  const data = useAdminData();

  const sectionParam = (params.get("section") || "users") as Section;
  const section: Section = SECTIONS.some((s) => s.id === sectionParam)
    ? sectionParam
    : "users";

  const [waitingCount, setWaitingCount] = useState(0);

  // Pending-waitlist count for the Beta nav badge — loaded regardless of the
  // active section so the count is always visible while in admin.
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    fetch("/api/admin/waitlist/count")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (active && j) setWaitingCount(j.waiting || 0);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    // Always refresh the Health nav badge — it's the one piece of admin
    // state we want visible regardless of which section is active.
    data.loadApiErrorsSummary();
    if (section === "users") data.loadUsers();
    if (section === "beta") {
      data.loadWaitlist();
    }
    if (section === "feedback") {
      data.loadBetaFeedback();
      data.loadUserFeedback();
    }
  }, [section, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // New-signup badge = waiting AND unseen. Derive from the loaded list (so it
  // ticks down live as the admin invites/declines/marks seen), falling back to
  // the count endpoint when the list isn't loaded (other sections).
  const newSignups = data.waitlistLoaded
    ? data.waitlist.filter((r) => r.status === "waiting" && !r.seen).length
    : waitingCount;

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
        READ ONLY — ADMIN
      </div>

      <div
        className="admin-shell"
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        <AdminNavRail
          activeId={section}
          badges={{
            ...(newSignups > 0 ? { beta: newSignups } : {}),
            ...(data.betaFeedbackUnreadCount > 0
              ? { feedback: data.betaFeedbackUnreadCount }
              : {}),
            ...(data.apiErrorsCount > 0
              ? { health: data.apiErrorsCount }
              : {}),
          }}
        />

        <main
          style={{
            flex: 1,
            display: "flex",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {section === "users" && <UsersSection data={data} />}

          {section === "beta" && (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 24px 40px",
              }}
            >
              <WaitlistTab
                items={data.waitlist}
                onChangeStatus={data.changeWaitlistStatus}
                onMarkSeen={data.markWaitlistSeen}
                onAddInvited={data.addInvitedEmail}
              />
            </div>
          )}

          {section === "tuning" && (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "18px 24px 40px",
              }}
            >
              <IntakeDoorsPanel />
              <FeatureGatesPanel />
              <VoiceEditorPanel />
              <CheckpointTuningPanel />
            </div>
          )}

          {section === "health" && (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "18px 24px 40px",
              }}
            >
              <ConfirmHealthPanel />
              <ApiErrorsPanel />
              <ActiveUsersPanel />
              <SchemaHealthTab />
            </div>
          )}

          {section === "feedback" && (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "18px 24px 40px",
              }}
            >
              <FeedbackSection
                betaFeedback={data.betaFeedback}
                userFeedback={data.userFeedback}
                onMarkRead={data.markBetaFeedbackRead}
                onDeleteBeta={data.deleteBetaFeedback}
                onDeleteUser={data.deleteUserFeedback}
              />
            </div>
          )}
        </main>
      </div>

      <style jsx>{`
        @media (max-width: 720px) {
          .admin-shell {
            flex-direction: column;
          }
          .admin-rail {
            width: 100% !important;
            flex-direction: row !important;
            overflow-x: auto;
            padding: 8px 12px !important;
            border-right: none !important;
            border-bottom: 1px solid var(--session-ink-hairline);
          }
        }
      `}</style>
    </div>
  );
}

function UsersSection({ data }: { data: ReturnType<typeof useAdminData> }) {
  return (
    <>
      <div
        style={{
          width: 320,
          borderRight: "1px solid var(--session-ink-hairline)",
          overflowY: "auto",
          flexShrink: 0,
          padding: "12px 16px 40px",
        }}
        className="admin-users-list"
      >
        <UsersTab
          users={data.users.map((u) => ({
            id: u.id,
            display_name: u.display_name,
            email: u.email,
            is_anonymous: u.is_anonymous,
            conversation_count: u.conversation_count,
            component_count: u.component_count,
            created_at: u.created_at,
            last_active: u.last_active,
            last_conversation_at: u.last_conversation_at,
          }))}
          onSelectUser={(u) =>
            data.openUserProfile({
              id: u.id,
              display_name: u.display_name,
              email: u.email ?? "",
              is_anonymous: u.is_anonymous,
              conversation_count: u.conversation_count,
              component_count: u.component_count,
              created_at: u.created_at,
              last_active: u.last_active,
              last_conversation_at: u.last_conversation_at,
            })
          }
          selectedId={data.selectedUser?.id ?? null}
        />
      </div>
      <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
        <UserProfilePane data={data} />
      </div>
    </>
  );
}
