"use client";

import { useEffect, useState } from "react";
import type { ConversationSummaryItem } from "@/lib/hooks/useChat";
import type { MobileView } from "@/components/layout/MobileLayout";
import { formatShortDate } from "@/lib/utils/format";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import { APP_VERSION } from "@/lib/version";
import { PERSONA_NAME } from "@/lib/persona/config";
import DevToolsPanel from "@/components/admin/DevToolsPanel";

const COLLAPSE_KEY = "mw_sidebar_collapsed";
const VISIBLE_SESSION_COUNT = 6;
export const SIDEBAR_WIDTH = 276;
export const RAIL_WIDTH = 64;

interface DesktopSidebarProps {
  conversations: ConversationSummaryItem[];
  activeConversationId: string | null;
  activeView: MobileView;
  manualEntryCount: number;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onNavigateToHome: () => void;
  onNavigateToManual: () => void;
  onNavigateToSettings: () => void;
  onLogout: () => void;
}

// 18px line icons, stroke-only, matching the editorial register.
function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 18 18"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        stroke: "currentColor",
        strokeWidth: 1.5,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        fill: "none",
        flexShrink: 0,
      }}
    >
      <path d={d} />
    </svg>
  );
}

const IC_PLUS = "M9 3v12M3 9h12";
const IC_HOME = "M3 8.5L9 3l6 5.5M4.5 7.5V15h9V7.5";
const IC_BOOK =
  "M2 4.5c2.2-1.2 4.4-1.2 6.5 0v9.5c-2.1-1.2-4.3-1.2-6.5 0zM16 4.5c-2.2-1.2-4.4-1.2-6.5 0v9.5c2.1-1.2 4.3-1.2 6.5 0z";
const IC_CLOCK = "M9 2.5a6.5 6.5 0 110 13 6.5 6.5 0 010-13zM9 5.5V9l2.3 1.8";
const IC_GEAR =
  "M9 6.6a2.4 2.4 0 110 4.8 2.4 2.4 0 010-4.8zM9 2v2.2M9 13.8V16M2 9h2.2M13.8 9H16M4.1 4.1l1.5 1.5M12.4 12.4l1.5 1.5M13.9 4.1l-1.5 1.5M5.6 12.4l-1.5 1.5";
const IC_LOGOUT = "M7 4H3.5v10H7M11.5 12l3-3-3-3M14.5 9H7";
const IC_COLLAPSE = "M11 4l-5 5 5 5";
const IC_EXPAND = "M7 4l5 5-5 5";

const EYEBROW_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "9.5px",
  letterSpacing: "2.2px",
  textTransform: "uppercase",
  color: "var(--session-ink-faded)",
  whiteSpace: "nowrap",
};

const ITEM_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  margin: "2px 12px",
  padding: "9px 12px",
  borderRadius: 10,
  cursor: "pointer",
  color: "var(--session-ink-mid)",
  fontFamily: "var(--font-persona), var(--font-serif), serif",
  fontSize: "14.5px",
  whiteSpace: "nowrap",
  border: "none",
  background: "none",
  width: "calc(100% - 24px)",
  textAlign: "left",
};

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function DesktopSidebar({
  conversations,
  activeConversationId,
  activeView,
  manualEntryCount,
  onSelectSession,
  onNewSession,
  onNavigateToHome,
  onNavigateToManual,
  onNavigateToSettings,
  onLogout,
}: DesktopSidebarProps) {
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const isAdmin = useIsAdmin();

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      // Private mode / disabled storage — collapse just won't persist.
    }
  }, [collapsed]);

  const visibleConversations = showAllSessions
    ? conversations
    : conversations.slice(0, VISIBLE_SESSION_COUNT);
  const hiddenCount = conversations.length - VISIBLE_SESSION_COUNT;

  return (
    <aside
      style={{
        flex: "0 0 auto",
        width: collapsed ? RAIL_WIDTH : SIDEBAR_WIDTH,
        minHeight: 0,
        position: "relative",
        overflow: "hidden",
        borderRight: "1px solid var(--session-ink-hairline)",
        background: "var(--session-walnut-tint)",
        transition: "width 0.35s cubic-bezier(0.25, 0.8, 0.3, 1)",
      }}
    >
      {/* ── Expanded sidebar ── */}
      <div
        style={{
          width: SIDEBAR_WIDTH,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? "none" : "auto",
          transition: "opacity 0.2s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "16px 16px 8px",
          }}
        >
          <button
            className="mw-dsk-railbtn"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            style={{ width: 32, height: 32 }}
          >
            <Icon d={IC_COLLAPSE} size={16} />
          </button>
        </div>

        {/* Primary destinations. Home owns the resume + 5-layer index; the
            sidebar is the persistent nav + session history, so the Manual is
            a quiet nav row with its count, not a competing card. There is no
            generic "Conversation" row — the highlighted active session below
            is the way back into the live thread. */}
        <button
          className="mw-dsk-item"
          data-active={activeView === "home"}
          style={ITEM_STYLE}
          onClick={onNavigateToHome}
        >
          <span style={{ color: "var(--session-walnut-meta)", display: "inline-flex" }}>
            <Icon d={IC_HOME} />
          </span>
          Home
        </button>
        <button
          className="mw-dsk-item"
          data-active={activeView === "manual"}
          style={ITEM_STYLE}
          onClick={onNavigateToManual}
        >
          <span style={{ color: "var(--session-walnut-meta-strong)", display: "inline-flex" }}>
            <Icon d={IC_BOOK} />
          </span>
          Your Manual
          <span
            aria-hidden="true"
            style={{
              marginLeft: "auto",
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "1.4px",
              color: "var(--session-walnut-meta-strong)",
            }}
          >
            {manualEntryCount}
          </span>
        </button>

        {/* An action, not a destination — bordered so it reads as a button
            distinct from the Home/Manual nav rows above it. */}
        <button
          className="mw-dsk-item"
          style={{
            ...ITEM_STYLE,
            margin: "12px 12px 4px",
            color: "var(--session-walnut)",
            border: "1px solid var(--session-walnut-border)",
          }}
          onClick={onNewSession}
        >
          <span style={{ color: "var(--session-walnut)", display: "inline-flex" }}>
            <Icon d={IC_PLUS} />
          </span>
          New session
        </button>

        <p style={{ ...EYEBROW_STYLE, margin: "16px 24px 8px" }}>Sessions</p>
        <div
          className="mw-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            paddingBottom: 8,
          }}
        >
          {visibleConversations.map((conv) => {
            const isActive =
              conv.id === activeConversationId && activeView === "session";
            return (
              <button
                key={conv.id}
                className="mw-dsk-session"
                data-active={isActive}
                onClick={() => onSelectSession(conv.id)}
                style={{
                  display: "block",
                  margin: "1px 12px",
                  padding: "8px 12px",
                  borderRadius: 9,
                  cursor: "pointer",
                  border: "none",
                  background: "none",
                  width: "calc(100% - 24px)",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-persona), var(--font-serif), serif",
                    fontSize: "13.5px",
                    lineHeight: 1.4,
                    color: isActive
                      ? "var(--session-ink)"
                      : "var(--session-ink-mid)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {conv.title || conv.preview || "Untitled session"}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 2,
                    fontFamily: "var(--font-mono)",
                    fontSize: "8.5px",
                    letterSpacing: "1.4px",
                    textTransform: "uppercase",
                    color: "var(--session-ink-faded)",
                  }}
                >
                  {formatShortDate(conv.updated_at)}
                </span>
              </button>
            );
          })}
          {hiddenCount > 0 && (
            <button
              className="mw-dsk-item"
              onClick={() => setShowAllSessions((v) => !v)}
              style={{
                ...ITEM_STYLE,
                fontFamily: "var(--font-mono)",
                fontSize: "9.5px",
                letterSpacing: "1.6px",
                textTransform: "uppercase",
                color: "var(--session-walnut-meta)",
              }}
            >
              {showAllSessions
                ? "Show fewer ‹"
                : `Show all (${conversations.length}) ›`}
            </button>
          )}
        </div>

        <div
          className="mw-scroll"
          style={{
            borderTop: "1px solid var(--session-ink-hairline)",
            padding: "10px 12px 14px",
            maxHeight: "60vh",
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          <button
            className="mw-dsk-item"
            data-active={activeView === "settings"}
            style={{ ...ITEM_STYLE, margin: "2px 0", width: "100%" }}
            onClick={onNavigateToSettings}
          >
            <span style={{ color: "var(--session-walnut-meta)", display: "inline-flex" }}>
              <Icon d={IC_GEAR} />
            </span>
            Settings
          </button>
          <button
            className="mw-dsk-item"
            style={{ ...ITEM_STYLE, margin: "2px 0", width: "100%" }}
            onClick={onLogout}
          >
            <span style={{ color: "var(--session-walnut-meta)", display: "inline-flex" }}>
              <Icon d={IC_LOGOUT} />
            </span>
            Log out
          </button>

          {isAdmin && (
            <div style={{ margin: "12px 0 0" }}>
              <button
                type="button"
                onClick={() => setAdminOpen((v) => !v)}
                aria-expanded={adminOpen}
                style={{
                  ...EYEBROW_STYLE,
                  fontSize: "9px",
                  letterSpacing: "1.2px",
                  margin: "10px 12px 0",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    transform: adminOpen ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  ›
                </span>
                Admin tools
              </button>

              {adminOpen && (
                <>
                  <DevToolsPanel />
                  <p
                    style={{
                      ...EYEBROW_STYLE,
                      fontSize: "9px",
                      letterSpacing: "1.2px",
                      margin: "10px 12px 0",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "4px 8px",
                    }}
                  >
                    <a href="/admin" style={{ color: "inherit", textDecoration: "none" }}>
                      Admin
                    </a>
                    <span aria-hidden="true">·</span>
                    <a
                      href="/admin/prompt-architecture"
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {PERSONA_NAME}&apos;s prompt architecture
                    </a>
                    <span aria-hidden="true">·</span>
                    <a href="/admin/docs" style={{ color: "inherit", textDecoration: "none" }}>
                      Docs
                    </a>
                  </p>
                </>
              )}
            </div>
          )}

          <p
            style={{
              ...EYEBROW_STYLE,
              fontSize: "9px",
              letterSpacing: "1.2px",
              margin: "12px 12px 0",
              display: "flex",
              flexWrap: "wrap",
              gap: "4px 8px",
              color: "var(--session-ink-ghost)",
            }}
          >
            <span>In closed beta</span>
            <span>·</span>
            <span>v{APP_VERSION}</span>
            <span>·</span>
            <a href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>
              Privacy
            </a>
            <span>·</span>
            <a href="/terms" style={{ color: "inherit", textDecoration: "none" }}>
              Terms
            </a>
          </p>
        </div>
      </div>

      {/* ── Collapsed rail — every destination stays visible ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: RAIL_WIDTH,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "22px 0 16px",
          opacity: collapsed ? 1 : 0,
          pointerEvents: collapsed ? "auto" : "none",
          transition: collapsed ? "opacity 0.25s ease 0.15s" : "opacity 0.15s ease",
        }}
      >
        <button
          className="mw-dsk-railbtn"
          onClick={() => setCollapsed(false)}
          aria-label="Open sidebar"
        >
          <Icon d={IC_EXPAND} size={16} />
          <span className="mw-dsk-tip">Open sidebar</span>
        </button>
        <button
          className="mw-dsk-railbtn"
          data-active={activeView === "home"}
          onClick={onNavigateToHome}
          aria-label="Home"
        >
          <Icon d={IC_HOME} />
          <span className="mw-dsk-tip">Home</span>
        </button>
        <button className="mw-dsk-railbtn" onClick={onNewSession} aria-label="New session">
          <Icon d={IC_PLUS} />
          <span className="mw-dsk-tip">New session</span>
        </button>
        <button
          className="mw-dsk-railbtn mw-dsk-railbtn-manual"
          data-active={activeView === "manual"}
          onClick={onNavigateToManual}
          aria-label={`Your Manual, ${manualEntryCount} entries`}
        >
          <Icon d={IC_BOOK} />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 3,
              right: 4,
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              color: "var(--session-walnut-meta-strong)",
            }}
          >
            {manualEntryCount}
          </span>
          <span className="mw-dsk-tip">
            Your Manual · {manualEntryCount}{" "}
            {manualEntryCount === 1 ? "entry" : "entries"}
          </span>
        </button>
        <button
          className="mw-dsk-railbtn"
          onClick={() => setCollapsed(false)}
          aria-label={`Sessions, ${conversations.length}`}
        >
          <Icon d={IC_CLOCK} />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 3,
              right: 4,
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              color: "var(--session-walnut-meta-strong)",
            }}
          >
            {conversations.length}
          </span>
          <span className="mw-dsk-tip">Sessions · {conversations.length}</span>
        </button>
        <span style={{ flex: 1 }} />
        <button
          className="mw-dsk-railbtn"
          data-active={activeView === "settings"}
          onClick={onNavigateToSettings}
          aria-label="Settings"
        >
          <Icon d={IC_GEAR} />
          <span className="mw-dsk-tip">Settings</span>
        </button>
      </div>
    </aside>
  );
}
