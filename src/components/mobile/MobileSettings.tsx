"use client";

import { useState, useEffect } from "react";
import ConfirmationModal from "@/components/shared/ConfirmationModal";
import SettingsRow from "@/components/shared/SettingsRow";
import { useIsAdmin } from "@/lib/hooks/useIsAdmin";
import { PERSONA_NAME, PERSONA_NAME_FORMAL } from "@/lib/persona/config";

interface MobileSettingsProps {
  userEmail: string;
  onSimulationEvent?: (type: "start" | "turn" | "checkpoint", conversationId: string) => void;
  onPopulateComplete?: () => void;
}

function SectionHeader({
  label,
  isOpen,
  onToggle,
  sectionId,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  sectionId?: string;
}) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls={sectionId}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--size-meta)",
        color: "var(--session-ink-faded)",
        letterSpacing: "3px",
        textTransform: "uppercase",
        margin: "32px 0 12px 0",
        padding: "8px 0",
        background: "none",
        border: "none",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {label}
      <span aria-hidden="true" style={{ fontSize: "10px" }}>{isOpen ? "\u25BE" : "\u25B8"}</span>
    </button>
  );
}

export default function MobileSettings({
  userEmail,
  onSimulationEvent,
  onPopulateComplete,
}: MobileSettingsProps) {
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simStatus, setSimStatus] = useState<string>("");
  const [simCheckpoints, setSimCheckpoints] = useState(1);
  const [simulatedUser, setSimulatedUser] = useState("");
  const [populateLayers, setPopulateLayers] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [populating, setPopulating] = useState(false);
  const isAdmin = useIsAdmin();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["account"]));

  // ── Text Sage phone linking ──────────────────────────────────────
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

  useEffect(() => {
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
  }, []);

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

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
      localStorage.clear();
      window.location.reload();
    } catch (err) {
      console.error("[settings] Delete data error:", err);
    }
  }

  async function handleDeleteAccount() {
    await fetch("/api/account/delete", { method: "POST" });
    localStorage.clear();
    window.location.href = "/login";
  }

  async function handleSimulate() {
    setSimulating(true);
    setSimStatus("Starting simulation...");

    let simConversationId: string | null = null;

    try {
      const res = await fetch("/api/dev-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulatedUserDescription: simulatedUser.trim(), checkpointTarget: simCheckpoints }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setSimStatus(`Failed: ${errBody.error || `HTTP ${res.status}`}`);
        setSimulating(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "started") {
              simConversationId = event.conversationId;
              if (onSimulationEvent) {
                onSimulationEvent("start", event.conversationId);
              }
            } else if (event.type === "turn") {
              setSimStatus(`Turn ${event.turn}...`);
            } else if (event.type === "turn_complete") {
              if (event.conversationId) simConversationId = event.conversationId;
              setSimStatus(`Turn ${event.turn} complete`);
              if (simConversationId && onSimulationEvent) {
                onSimulationEvent("turn", simConversationId);
              }
            } else if (event.type === "checkpoint") {
              if (event.conversationId) simConversationId = event.conversationId;
              setSimStatus(`Checkpoint ${event.checkpointNumber} ${event.action || "confirmed"} (layer ${event.layer}) at turn ${event.turn}`);
              if (simConversationId && onSimulationEvent) {
                onSimulationEvent("checkpoint", simConversationId);
              }
            } else if (event.type === "complete") {
              const cpInfo = event.totalCheckpoints != null ? `, ${event.totalCheckpoints} checkpoint${event.totalCheckpoints !== 1 ? "s" : ""}` : "";
              setSimStatus(
                `Done — ${event.totalTurns} turns${cpInfo}`
              );
            } else if (event.type === "error") {
              setSimStatus("Simulation failed");
            }
          } catch {
            // skip malformed SSE
          }
        }
      }
    } catch {
      setSimStatus("Simulation failed");
    } finally {
      setSimulating(false);
    }
  }

  function togglePopulateLayer(layer: number) {
    setPopulateLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }

  async function handlePopulate() {
    if (populateLayers.size === 0) return;
    setPopulating(true);
    try {
      const res = await fetch("/api/dev-populate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layers: Array.from(populateLayers).sort() }),
      });
      if (!res.ok) {
        console.error("[populate] Failed:", await res.text());
      }
      if (onPopulateComplete) onPopulateComplete();
    } catch (err) {
      console.error("[populate] Error:", err);
    } finally {
      setPopulating(false);
    }
  }

  return (
    <main
      style={{
        height: "100%",
        overflowY: "auto",
        padding: "40px 24px calc(52px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Header */}
      <h1
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--size-meta)",
          color: "var(--session-ink-ghost)",
          letterSpacing: "3px",
          textTransform: "uppercase",
          margin: "0 0 32px 0",
          fontWeight: 400,
        }}
      >
        SETTINGS
      </h1>

      {/* ─── Account ─────────────────────────────────────────────── */}
      <SectionHeader label="ACCOUNT" isOpen={openSections.has("account")} onToggle={() => toggleSection("account")} sectionId="settings-account" />

      {openSections.has("account") && (
        <div id="settings-account">
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
        </div>
      )}

      {/* ─── Crisis Support ──────────────────────────────────────── */}
      <SectionHeader label="CRISIS SUPPORT" isOpen={openSections.has("crisis")} onToggle={() => toggleSection("crisis")} sectionId="settings-crisis" />

      {openSections.has("crisis") && (
      <div id="settings-crisis">
      <SettingsRow title="Crisis Support" noBorder>
        <div>
          <div>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--size-meta)",
                color: "var(--session-ink-ghost)",
                letterSpacing: "0.5px",
                margin: "0 0 4px 0",
              }}
            >
              988 Suicide &amp; Crisis Lifeline
            </p>
            <a
              href="tel:988"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--session-persona)",
                textDecoration: "none",
              }}
            >
              Call or text 988
            </a>
          </div>
          <div style={{ marginTop: "10px" }}>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--size-meta)",
                color: "var(--session-ink-ghost)",
                letterSpacing: "0.5px",
                margin: "0 0 4px 0",
              }}
            >
              Crisis Text Line
            </p>
            <a
              href="sms:741741?body=HOME"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--session-persona)",
                textDecoration: "none",
              }}
            >
              Text HOME to 741741
            </a>
          </div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--size-meta)",
              color: "var(--session-ink-ghost)",
              letterSpacing: "0.5px",
              margin: "10px 0 0 0",
            }}
          >
            Free, confidential, available 24/7
          </p>
        </div>
      </SettingsRow>
      </div>
      )}

      {/* ─── Text Sage ─────────────────────────────────────────── */}
      <SectionHeader label={`TEXT ${PERSONA_NAME.toUpperCase()}`} isOpen={openSections.has("textsage")} onToggle={() => toggleSection("textsage")} sectionId="settings-textsage" />

      {openSections.has("textsage") && (
        <div id="settings-textsage">
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
                  borderRadius: 8,
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
                    background: "rgba(26, 22, 20, 0.03)",
                    border: "1px solid var(--session-ink-hairline)",
                    borderRadius: 8,
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
                    color: "#8a8480",
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
                    style={{ color: "#6e6a66", textDecoration: "underline" }}
                  >
                    Privacy Policy
                  </a>{" "}
                  and{" "}
                  <a
                    href="/terms"
                    style={{ color: "#6e6a66", textDecoration: "underline" }}
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
                    borderRadius: 8,
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
                    color: "#8a8480",
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
                    background: "rgba(26, 22, 20, 0.03)",
                    border: "1px solid var(--session-ink-hairline)",
                    borderRadius: 8,
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
                    borderRadius: 8,
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
                    color: "#6e6a66",
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
                  Text {formatPhoneDisplay(process.env.NEXT_PUBLIC_LINQ_PHONE_NUMBER || "")} anytime.
                </p>
                <a
                  href="/persona-contact.vcf"
                  download={`${PERSONA_NAME_FORMAL} (mywalnut).vcf`}
                  style={{
                    display: "block",
                    width: "100%",
                    background: "none",
                    border: "1px solid var(--session-persona-muted)",
                    borderRadius: 8,
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
        </div>
      )}

      {/* ─── Dev Tools (admin only) ────────────────────────────── */}
      {isAdmin && (
      <>
      <SectionHeader label="DEV TOOLS" isOpen={openSections.has("devtools")} onToggle={() => toggleSection("devtools")} sectionId="settings-devtools" />

      {openSections.has("devtools") && (
        <div id="settings-devtools">
      {/* Simulate user */}
      <SettingsRow title="Simulate user">
        <div style={{ width: "100%" }}>
          {/* Simulated user textarea */}
          <textarea
            value={simulatedUser}
            onChange={(e) => setSimulatedUser(e.target.value)}
            placeholder="Describe the simulated user — personality, backstory, emotional style (e.g. 'A 34-year-old teacher who avoids conflict and struggles to set boundaries')"
            aria-label="Simulated user description"
            rows={4}
            style={{
              width: "100%",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--session-ink-soft)",
              background: "rgba(26, 22, 20, 0.03)",
              border: "1px solid var(--session-ink-hairline)",
              borderRadius: 8,
              padding: "10px 12px",
              resize: "vertical",
              marginBottom: 10,
              outline: "none",
              lineHeight: 1.4,
              boxSizing: "border-box",
            }}
          />

          {/* Checkpoint target pills */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--size-meta)",
                color: "var(--session-ink-ghost)",
                letterSpacing: "2px",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              CHECKPOINTS
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setSimCheckpoints(n)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: `1px solid ${simCheckpoints === n ? "var(--session-persona)" : "var(--session-ink-ghost)"}`,
                    background: simCheckpoints === n ? "var(--session-persona-muted)" : "none",
                    color: simCheckpoints === n ? "var(--session-persona)" : "var(--session-ink-ghost)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--size-meta)",
                    fontWeight: 500,
                    cursor: "pointer",
                    padding: 0,
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={handleSimulate}
            disabled={simulating || !simulatedUser.trim()}
            style={{
              width: "100%",
              background: "none",
              border: `1px solid ${simulating || !simulatedUser.trim() ? "var(--session-ink-hairline)" : "var(--session-persona-muted)"}`,
              borderRadius: 8,
              cursor: simulating || !simulatedUser.trim() ? "default" : "pointer",
              textAlign: "center",
              padding: "10px 0",
              opacity: simulating || !simulatedUser.trim() ? 0.5 : 1,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--size-meta)",
                color: simulating || !simulatedUser.trim() ? "var(--session-ink-ghost)" : "var(--session-persona)",
                letterSpacing: "0.5px",
                margin: 0,
              }}
            >
              {simulating
                ? simStatus
                : !simulatedUser.trim()
                  ? "Enter a description to simulate"
                  : `Run ${simCheckpoints} checkpoint${simCheckpoints > 1 ? "s" : ""}`}
            </p>
          </button>

          {/* Persistent status — visible after simulation ends */}
          {!simulating && simStatus && (
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--size-meta)",
                color: simStatus.includes("ailed") ? "var(--session-error)" : "var(--session-persona)",
                letterSpacing: "0.5px",
                margin: "8px 0 0",
                textAlign: "center",
              }}
            >
              {simStatus}
            </p>
          )}
        </div>
      </SettingsRow>

      {/* Populate manual */}
      <SettingsRow title="Populate manual" noBorder>
        <div style={{ width: "100%" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: "var(--session-persona)",
                letterSpacing: "0.2px",
                margin: 0,
              }}
            >
              Populate manual
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => togglePopulateLayer(n)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: `1px solid ${populateLayers.has(n) ? "var(--session-persona)" : "var(--session-ink-ghost)"}`,
                    background: populateLayers.has(n) ? "var(--session-persona-muted)" : "none",
                    color: populateLayers.has(n) ? "var(--session-persona)" : "var(--session-ink-ghost)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--size-meta)",
                    fontWeight: 500,
                    cursor: "pointer",
                    padding: 0,
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handlePopulate}
            disabled={populating || populateLayers.size === 0}
            style={{
              width: "100%",
              background: "none",
              border: `1px solid ${populating || populateLayers.size === 0 ? "var(--session-ink-hairline)" : "var(--session-persona-muted)"}`,
              borderRadius: 8,
              cursor: populating || populateLayers.size === 0 ? "default" : "pointer",
              textAlign: "center",
              padding: "10px 0",
              opacity: populating ? 0.5 : 1,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--size-meta)",
                color: populating || populateLayers.size === 0 ? "var(--session-ink-ghost)" : "var(--session-persona)",
                letterSpacing: "0.5px",
                margin: 0,
              }}
            >
              {populating
                ? "Populating..."
                : populateLayers.size === 0
                  ? "Select layers above"
                  : `Insert layers ${Array.from(populateLayers).sort().join(", ")}`}
            </p>
          </button>
        </div>
      </SettingsRow>
          <a
            href="/admin"
            style={{
              display: "block",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: "var(--session-error)",
              padding: "18px 0",
              textDecoration: "none",
            }}
          >
            Open admin dashboard →
          </a>
        </div>
      )}
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
    </main>
  );
}
