"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import ConfirmationModal from "@/components/shared/ConfirmationModal";
import SettingsRow from "@/components/shared/SettingsRow";
import PersonaModePicker from "@/components/mobile/settings/PersonaModePicker";
import TopBar from "@/components/shared/TopBar";
import AppearanceToggle from "@/components/shared/AppearanceToggle";
import { PERSONA_NAME, PERSONA_NAME_FORMAL } from "@/lib/persona/config";

interface MobileSettingsProps {
  userEmail: string;
  /** True when the Settings tab is the active view. Used to defer the
   *  phone-status fetch until the user actually opens Settings — avoids
   *  a network call on app load for users who never visit this tab. */
  isActive?: boolean;
  onNavigateToCrisis?: () => void;
  // false when the desktop shell provides its own header. Default true.
  showTopBar?: boolean;
}

function SectionHeader({
  label,
  tone,
  sectionId,
}: {
  label: string;
  tone?: "danger";
  sectionId?: string;
}) {
  return (
    <h2
      id={sectionId}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 500,
        color:
          tone === "danger"
            ? "var(--session-error-text)"
            : "var(--session-walnut-meta-strong)",
        letterSpacing: "2px",
        textTransform: "uppercase",
        margin: "32px 0 8px 0",
        paddingBottom: 8,
        borderBottom: `1px solid ${tone === "danger" ? "var(--session-error-border-soft)" : "var(--session-walnut-border-soft)"}`,
      }}
    >
      {label}
    </h2>
  );
}

// Tap-to-expand settings section. Header keeps the SectionHeader look
// (mono caps + hairline rule); a chevron rotates to point down when open.
// Collapsed by default so Settings reads as a short, scannable list.
// Children stay mounted and hide via display:none so form state (phone
// linking, dev tools) survives a collapse/expand.
function CollapsibleSection({
  label,
  sectionId,
  children,
}: {
  label: string;
  sectionId: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = `${sectionId}-body`;
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ margin: 0 }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={bodyId}
          style={{
            all: "unset",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            cursor: "pointer",
            paddingBottom: 8,
            borderBottom: "1px solid var(--session-walnut-border-soft)",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 500,
              color: "var(--session-walnut-meta-strong)",
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            {label}
          </span>
          <span
            aria-hidden="true"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 16,
              color: "var(--session-walnut-meta)",
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          >
            ›
          </span>
        </button>
      </h2>
      <div id={bodyId} hidden={!open} style={{ display: open ? "block" : "none" }}>
        {children}
      </div>
    </section>
  );
}

export default function MobileSettings({
  userEmail,
  isActive = false,
  onNavigateToCrisis,
  showTopBar = true,
}: MobileSettingsProps) {
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);

  // ── Text Jove phone linking ──────────────────────────────────────
  const [phoneState, setPhoneState] = useState<"loading" | "unlinked" | "input" | "code" | "linked">("loading");
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);
  const [pendingPhone, setPendingPhone] = useState<string>("");
  const [codeInput, setCodeInput] = useState("");
  const [linkedService, setLinkedService] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  function formatPhoneDisplay(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) {
      const area = digits.slice(1, 4);
      const prefix = digits.slice(4, 7);
      const line = digits.slice(7);
      return `(${area}) ${prefix}-${line}`;
    }
    return phone;
  }

  // Defer the phone-status fetch until the user actually opens Settings.
  // MobileLayout mounts all panels (display:none-toggled) so an unconditional
  // useEffect would fire GET /api/user/phone on every login regardless of
  // whether the user ever visits this tab. The hasFetched flag keeps the
  // request to once per mount.
  const hasFetchedPhoneRef = useRef(false);
  useEffect(() => {
    if (!isActive || hasFetchedPhoneRef.current) return;
    hasFetchedPhoneRef.current = true;
    fetch("/api/user/phone")
      .then((r) => r.json())
      .then((data) => {
        if (data.phone && data.verified) {
          setLinkedPhone(data.phone);
          setLinkedService(data.serviceType || null);
          setPhoneState("linked");
        } else {
          setPhoneState("unlinked");
        }
      })
      .catch(() => setPhoneState("unlinked"));
  }, [isActive]);

  async function handleConnectPhone() {
    setPhoneBusy(true);
    setPhoneError(null);
    const phoneToSend = phoneInput || pendingPhone;
    try {
      const res = await fetch("/api/user/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phoneToSend }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhoneError(data.error || "Failed to connect");
        return;
      }
      // Server may report the phone is already verified for this user —
      // jump straight to linked state.
      if (data.verified === true) {
        setLinkedPhone(phoneToSend);
        setPhoneState("linked");
        return;
      }
      // Otherwise we sent an OTP; advance to the code-entry step.
      setPendingPhone(phoneToSend);
      setCodeInput("");
      setPhoneState("code");
    } catch {
      setPhoneError("Network error");
    } finally {
      setPhoneBusy(false);
    }
  }

  async function handleVerifyCode() {
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      const res = await fetch("/api/user/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: pendingPhone, code: codeInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhoneError(data.error || "Verification failed");
        return;
      }
      setLinkedPhone(pendingPhone);
      setCodeInput("");
      setPhoneState("linked");
    } catch {
      setPhoneError("Network error");
    } finally {
      setPhoneBusy(false);
    }
  }

  async function handleDisconnect() {
    setPhoneBusy(true);
    try {
      await fetch("/api/user/phone", { method: "DELETE" });
      setLinkedPhone(null);
      setLinkedService(null);
      setPhoneState("unlinked");
      setPhoneInput("");
      setPhoneError(null);
    } catch {
      setPhoneError("Failed to disconnect");
    } finally {
      setPhoneBusy(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function handleDeleteData() {
    try {
      const res = await fetch("/api/dev-reset", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[settings] Delete data failed:", body.error || res.status);
        return;
      }
      // Clear both stores — sessionStorage holds mw_active_conversation,
      // which would otherwise point at a just-deleted conversation.
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    } catch (err) {
      console.error("[settings] Delete data error:", err);
    }
  }

  async function handleDeleteAccount() {
    await fetch("/api/account/delete", { method: "POST" });
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/login";
  }

  return (
    <main
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {showTopBar && <TopBar />}

      <div
        className="mw-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "32px 24px calc(40px + env(safe-area-inset-bottom, 0px))",
        }}
      >
      <h1
        style={{
          fontFamily: "var(--font-spectral), var(--font-serif), serif",
          fontSize: 26,
          fontWeight: 500,
          color: "var(--session-ink)",
          margin: "0 0 24px 0",
          letterSpacing: "-0.5px",
          lineHeight: 1.2,
        }}
      >
        Settings<span style={{ color: "var(--session-walnut)", fontWeight: 400 }}>.</span>
      </h1>

      {/* ─── Account ─────────────────────────────────────────────── */}
      <CollapsibleSection label="ACCOUNT" sectionId="settings-account">
        <SettingsRow
          title="Log out"
          subtitle={userEmail || "—"}
          onClick={handleLogout}
        />

        <SettingsRow
          title="Delete user data"
          titleColor="var(--session-error)"
          subtitle="Removes manual and conversations"
          onClick={() => setShowDeleteDataConfirm(true)}
        />

        <SettingsRow
          title="Delete account"
          titleColor="var(--session-error)"
          subtitle="Cannot be undone"
          onClick={() => setShowDeleteAccountConfirm(true)}
          noBorder
        />
      </CollapsibleSection>

      {/* ─── Voice ──────────────────────────────────────────────── */}
      <CollapsibleSection label="HOW JOVE TALKS TO YOU" sectionId="settings-voice">
        <div style={{ padding: "12px 0 4px" }}>
          <PersonaModePicker />
        </div>
      </CollapsibleSection>

      {/* ─── Appearance ──────────────────────────────────────────── */}
      <CollapsibleSection label="APPEARANCE" sectionId="settings-appearance">
        <SettingsRow title="Theme" noBorder>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 18,
              width: "100%",
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  color: "var(--session-ink)",
                  letterSpacing: "0.2px",
                  margin: 0,
                }}
              >
                Theme
              </p>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--size-meta)",
                  color: "var(--session-ink-ghost)",
                  letterSpacing: "0.5px",
                  margin: "3px 0 0 0",
                }}
              >
                System follows OS preference
              </p>
            </div>
            <div style={{ minWidth: 240, flexShrink: 0 }}>
              <AppearanceToggle />
            </div>
          </div>
        </SettingsRow>
      </CollapsibleSection>

      {/* ─── Text Jove ─────────────────────────────────────────── */}
      <CollapsibleSection label={`TEXT ${PERSONA_NAME.toUpperCase()}`} sectionId="settings-textsage">
        <SettingsRow title={`Text ${PERSONA_NAME}`} noBorder>
          <div style={{ width: "100%" }}>
            {phoneState === "loading" && (
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--size-meta)",
                  color: "var(--session-ink-ghost)",
                  letterSpacing: "0.5px",
                  margin: 0,
                }}
              >
                Loading...
              </p>
            )}

            {phoneState === "unlinked" && (
              <button
                onClick={() => setPhoneState("input")}
                style={{
                  width: "100%",
                  background: "none",
                  border: "1px solid var(--session-persona-muted)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  textAlign: "center",
                  padding: "10px 0",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    color: "var(--session-persona)",
                    margin: 0,
                  }}
                >
                  Link your phone to text {PERSONA_NAME}
                </p>
              </button>
            )}

            {phoneState === "input" && (
              <div>
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  autoComplete="tel"
                  inputMode="tel"
                  aria-label="Phone number"
                  style={{
                    width: "100%",
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    color: "var(--session-ink-soft)",
                    background: "var(--session-cream)",
                    border: "1px solid var(--session-ink-hairline)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 12px",
                    outline: "none",
                    boxSizing: "border-box",
                    marginBottom: 8,
                  }}
                />
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--size-meta)",
                    color: "var(--session-ink-faded)",
                    lineHeight: 1.5,
                    margin: "4px 0 10px 0",
                    padding: "0 2px",
                  }}
                >
                  By entering your phone number, you agree to receive text messages
                  from {PERSONA_NAME_FORMAL} by mywalnut. Message frequency varies. Msg &amp; data rates
                  may apply. Reply STOP to opt out. See our{" "}
                  <a
                    href="/privacy"
                    style={{ color: "var(--session-ink-mid)", textDecoration: "underline" }}
                  >
                    Privacy Policy
                  </a>{" "}
                  and{" "}
                  <a
                    href="/terms"
                    style={{ color: "var(--session-ink-mid)", textDecoration: "underline" }}
                  >
                    Terms
                  </a>
                  .
                </p>
                <button
                  onClick={handleConnectPhone}
                  disabled={phoneBusy || !phoneInput.trim()}
                  style={{
                    width: "100%",
                    background: "none",
                    border: `1px solid ${phoneBusy || !phoneInput.trim() ? "var(--session-ink-hairline)" : "var(--session-persona-muted)"}`,
                    borderRadius: "var(--radius-sm)",
                    cursor: phoneBusy || !phoneInput.trim() ? "default" : "pointer",
                    textAlign: "center",
                    padding: "10px 0",
                    opacity: phoneBusy ? 0.5 : 1,
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--size-meta)",
                      color: phoneBusy || !phoneInput.trim() ? "var(--session-ink-ghost)" : "var(--session-persona)",
                      letterSpacing: "0.5px",
                      margin: 0,
                    }}
                  >
                    {phoneBusy ? "Sending code..." : "Send code"}
                  </p>
                </button>
              </div>
            )}

            {phoneState === "code" && (
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    color: "var(--session-ink-faded)",
                    margin: "0 0 8px 0",
                  }}
                >
                  We sent a 6-digit code to {pendingPhone}. Code expires in 10 minutes.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label="Verification code"
                  maxLength={6}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  style={{
                    width: "100%",
                    fontFamily: "var(--font-mono)",
                    fontSize: "16px",
                    letterSpacing: "4px",
                    textAlign: "center",
                    color: "var(--session-ink)",
                    background: "var(--session-cream)",
                    border: "1px solid var(--session-ink-hairline)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 12px",
                    outline: "none",
                    boxSizing: "border-box",
                    marginBottom: 10,
                  }}
                />
                <button
                  onClick={handleVerifyCode}
                  disabled={phoneBusy || codeInput.length !== 6}
                  style={{
                    width: "100%",
                    background: "none",
                    border: `1px solid ${phoneBusy || codeInput.length !== 6 ? "var(--session-ink-hairline)" : "var(--session-persona-muted)"}`,
                    borderRadius: "var(--radius-sm)",
                    cursor: phoneBusy || codeInput.length !== 6 ? "default" : "pointer",
                    textAlign: "center",
                    padding: "10px 0",
                    opacity: phoneBusy ? 0.5 : 1,
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--size-meta)",
                      color: phoneBusy || codeInput.length !== 6 ? "var(--session-ink-ghost)" : "var(--session-persona)",
                      letterSpacing: "0.5px",
                      margin: 0,
                    }}
                  >
                    {phoneBusy ? "Verifying..." : "Verify"}
                  </p>
                </button>
                <button
                  onClick={handleConnectPhone}
                  disabled={phoneBusy}
                  style={{
                    width: "100%",
                    background: "none",
                    border: "none",
                    cursor: phoneBusy ? "default" : "pointer",
                    padding: "10px 0 0 0",
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--size-meta)",
                    color: "var(--session-ink-mid)",
                    textDecoration: "underline",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  Resend code
                </button>
              </div>
            )}

            {phoneState === "linked" && linkedPhone && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "13px",
                        color: "var(--session-ink)",
                        margin: 0,
                      }}
                    >
                      {formatPhoneDisplay(linkedPhone)}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--size-meta)",
                        color: "var(--session-persona)",
                        letterSpacing: "0.5px",
                        margin: "3px 0 0 0",
                      }}
                    >
                      {linkedService ? `CONNECTED · ${linkedService.toUpperCase()}` : "CONNECTED"}
                    </p>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    disabled={phoneBusy}
                    style={{
                      background: "none",
                      border: "1px solid var(--session-ink-hairline)",
                      borderRadius: 6,
                      cursor: phoneBusy ? "default" : "pointer",
                      padding: "6px 12px",
                      opacity: phoneBusy ? 0.5 : 1,
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--size-meta)",
                        color: "var(--session-ink-ghost)",
                        letterSpacing: "0.5px",
                        margin: 0,
                      }}
                    >
                      Disconnect
                    </p>
                  </button>
                </div>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    color: "var(--session-ink-mid)",
                    lineHeight: 1.5,
                    margin: "0 0 10px 0",
                  }}
                >
                  Text {formatPhoneDisplay(process.env.NEXT_PUBLIC_MESSAGING_FROM_NUMBER || "")} anytime.
                </p>
                <a
                  href="/persona-contact.vcf"
                  download={`${PERSONA_NAME_FORMAL} (mywalnut).vcf`}
                  style={{
                    display: "block",
                    width: "100%",
                    background: "none",
                    border: "1px solid var(--session-persona-muted)",
                    borderRadius: "var(--radius-sm)",
                    textAlign: "center",
                    padding: "10px 0",
                    textDecoration: "none",
                    boxSizing: "border-box",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--size-meta)",
                      color: "var(--session-persona)",
                      letterSpacing: "0.5px",
                      margin: 0,
                    }}
                  >
                    Add {PERSONA_NAME} to contacts
                  </p>
                </a>
              </div>
            )}

            {phoneError && (
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--size-meta)",
                  color: "var(--session-error)",
                  letterSpacing: "0.5px",
                  margin: "8px 0 0 0",
                  textAlign: "center",
                }}
              >
                {phoneError}
              </p>
            )}
          </div>
        </SettingsRow>
      </CollapsibleSection>

      {/* ─── Support ─────────────────────────────────────────────── */}
      {/* Crisis lives at the bottom of Settings (a row that opens the
          dedicated MobileCrisis surface), not on Home and not in the
          header. The real-time safety net is Jove's in-conversation
          crisis protocol; this static link is the passive backstop. */}
      {onNavigateToCrisis && (
        <>
          <SectionHeader label="SUPPORT" sectionId="settings-support" />
          <div id="settings-support">
            <SettingsRow
              title="Crisis support"
              titleColor="var(--session-error-text)"
              subtitle="988 Lifeline · Crisis Text Line · staffed 24/7"
              onClick={onNavigateToCrisis}
              noBorder
            />
          </div>
        </>
      )}

      {/* Confirmation modals */}
      <ConfirmationModal
        open={showDeleteDataConfirm}
        onClose={() => setShowDeleteDataConfirm(false)}
        onConfirm={handleDeleteData}
        message="This will delete your manual and all conversations. Your account will remain."
        confirmLabel="Delete data"
        isDestructive
      />

      <ConfirmationModal
        open={showDeleteAccountConfirm}
        onClose={() => setShowDeleteAccountConfirm(false)}
        onConfirm={handleDeleteAccount}
        message="This will permanently delete your account and all data. This cannot be undone."
        confirmLabel="Delete account"
        isDestructive
      />
      </div>
    </main>
  );
}
