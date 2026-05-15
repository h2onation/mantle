"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import { useAdminData } from "@/lib/hooks/useAdminData";
import UsersTab from "@/components/admin/UsersTab";
import WaitlistTab from "@/components/admin/WaitlistTab";
import BetaAllowlistTab from "@/components/admin/BetaAllowlistTab";
import UserProfilePane from "@/components/admin/UserProfilePane";
import SchemaHealthTab from "@/components/admin/SchemaHealthTab";
import ConfirmHealthPanel from "@/components/admin/ConfirmHealthPanel";
import ApiErrorsPanel from "@/components/admin/ApiErrorsPanel";
import ActiveUsersPanel from "@/components/admin/ActiveUsersPanel";
import FeedbackSection from "@/components/admin/FeedbackSection";
import AdminNavRail from "@/components/admin/AdminNavRail";

type Section = "users" | "beta" | "feedback" | "health";
type BetaSubTab = "waitlist" | "allowlist";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "users", label: "Users" },
  { id: "beta", label: "Beta" },
  { id: "feedback", label: "Feedback" },
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

  const [betaSubTab, setBetaSubTab] = useState<BetaSubTab>("waitlist");

  useEffect(() => {
    if (!isAdmin) return;
    // Always refresh the Health nav badge — it's the one piece of admin
    // state we want visible regardless of which section is active.
    data.loadApiErrorsSummary();
    if (section === "users") data.loadUsers();
    if (section === "beta") {
      data.loadWaitlist();
      data.loadAllowlist();
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
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 24,
                  padding: "14px 24px 0",
                  borderBottom: "1px solid var(--session-ink-hairline)",
                }}
              >
                {(["waitlist", "allowlist"] as const).map((t) => {
                  const active = t === betaSubTab;
                  return (
                    <button
                      key={t}
                      onClick={() => setBetaSubTab(t)}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--size-meta)",
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        color: active
                          ? "var(--session-error)"
                          : "var(--session-ink-ghost)",
                        background: "none",
                        border: "none",
                        borderBottom: active
                          ? "2px solid var(--session-error)"
                          : "2px solid transparent",
                        padding: "10px 2px",
                        cursor: "pointer",
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "12px 24px 40px",
                }}
              >
                {betaSubTab === "waitlist" && (
                  <WaitlistTab
                    items={data.waitlist}
                    onChangeStatus={data.changeWaitlistStatus}
                    onAddToBeta={data.addToBeta}
                  />
                )}
                {betaSubTab === "allowlist" && (
                  <BetaAllowlistTab
                    items={data.allowlist}
                    onAdd={(email) => data.addToBeta(email)}
                    onRemove={data.removeFromAllowlist}
                  />
                )}
              </div>
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
