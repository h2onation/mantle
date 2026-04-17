"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import { useAdminData } from "@/lib/hooks/useAdminData";
import UsersTab from "@/components/admin/UsersTab";
import WaitlistTab from "@/components/admin/WaitlistTab";
import BetaAllowlistTab from "@/components/admin/BetaAllowlistTab";
import BetaFeedbackTab from "@/components/admin/BetaFeedbackTab";
import UserProfilePane from "@/components/admin/UserProfilePane";
import SchemaHealthTab from "@/components/admin/SchemaHealthTab";
import ConfirmHealthPanel from "@/components/admin/ConfirmHealthPanel";
import ApiErrorsPanel from "@/components/admin/ApiErrorsPanel";
import ActiveUsersPanel from "@/components/admin/ActiveUsersPanel";
import FeedbackPanel from "@/components/admin/FeedbackPanel";
import {
  formatAdminDate,
  adminEmptyStyle,
} from "@/components/admin/admin-shared";

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
  const router = useRouter();
  const params = useSearchParams();
  const isAdmin = useIsAdmin();
  const data = useAdminData();

  const sectionParam = (params.get("section") || "users") as Section;
  const section: Section = SECTIONS.some((s) => s.id === sectionParam)
    ? sectionParam
    : "users";

  const [betaSubTab, setBetaSubTab] = useState<BetaSubTab>("waitlist");

  function setSection(next: Section) {
    const q = new URLSearchParams(params.toString());
    q.set("section", next);
    router.replace(`/admin?${q.toString()}`);
  }

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
    // Health tab surfaces unread feedback alongside errors and active
    // users, so load the same data the Feedback tab loads.
    if (section === "health") {
      data.loadBetaFeedback();
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
          {SECTIONS.map((s) => {
            const active = s.id === section;
            const badge =
              s.id === "feedback" && data.betaFeedbackUnreadCount > 0
                ? data.betaFeedbackUnreadCount
                : s.id === "health" && data.apiErrorsCount > 0
                  ? data.apiErrorsCount
                  : null;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
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
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 12px",
                  cursor: "pointer",
                  textAlign: "left",
                  fontWeight: active ? 500 : 400,
                }}
              >
                <span>{s.label}</span>
                {badge !== null && (
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
              </button>
            );
          })}
          <Link
            href="/admin/docs"
            style={{
              display: "block",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--session-ink-ghost)",
              background: "none",
              borderRadius: 6,
              padding: "8px 12px",
              textDecoration: "none",
            }}
          >
            Docs
          </Link>
          <div style={{ flex: 1 }} />
          <a
            href="/"
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
              <SchemaHealthTab />
              <ConfirmHealthPanel />
              <ApiErrorsPanel />
              <ActiveUsersPanel />
              <FeedbackPanel
                items={data.betaFeedback}
                unreadCount={data.betaFeedbackUnreadCount}
                loaded={data.betaFeedbackLoaded}
                onMarkRead={data.markBetaFeedbackRead}
              />
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
              {data.betaFeedback.length === 0 &&
              data.userFeedback.length === 0 ? (
                <div style={adminEmptyStyle}>No feedback yet</div>
              ) : (
                <>
                  <BetaFeedbackTab
                    items={data.betaFeedback}
                    onMarkRead={data.markBetaFeedbackRead}
                  />
                  {data.userFeedback.length > 0 && (
                    <>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--size-meta)",
                          letterSpacing: "2px",
                          textTransform: "uppercase",
                          color: "var(--session-ink-ghost)",
                          marginTop: 32,
                          marginBottom: 8,
                        }}
                      >
                        In-app feedback
                      </div>
                      {data.userFeedback.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            padding: "14px 0",
                            borderBottom:
                              "1px solid var(--session-ink-hairline)",
                          }}
                        >
                          <div
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "var(--size-meta)",
                              color: "var(--session-ink-ghost)",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {item.user_email || "Guest"} ·{" "}
                            {formatAdminDate(item.created_at)}
                          </div>
                          <div
                            style={{
                              fontFamily: "var(--font-sans)",
                              fontSize: "13px",
                              color: "var(--session-ink)",
                              lineHeight: 1.55,
                              marginTop: 6,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {item.message}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
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
