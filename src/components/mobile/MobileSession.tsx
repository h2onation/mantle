"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import MobileSoundSelector, { SoundIndicator } from "./MobileSoundSelector";
import SessionParticles from "./SessionParticles";
import SessionDrawer from "./SessionDrawer";
import ChatInput from "./ChatInput";
import type { ConversationSummaryItem } from "@/lib/hooks/useChat";
import type { ChatMessage, ManualComponent, ActiveCheckpoint } from "@/lib/types";
import { renderMarkdown } from "@/lib/utils/format";

interface MobileSessionProps {
  messages: ChatMessage[];
  conversationId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  isNewUser?: boolean;
  sessionSummary?: string | null;
  lastSessionDate?: string | null;
  confirmedComponents: ManualComponent[];
  activeCheckpoint: ActiveCheckpoint | null;
  checkpointError: string | null;
  errorMessage: string | null;
  conversations: ConversationSummaryItem[];
  sendMessage: (text: string) => void;
  retryLastMessage: () => void;
  confirmCheckpoint: (action: "confirmed" | "rejected" | "refined") => void;
  switchConversation: (id: string) => Promise<void>;
  startNewSession: () => Promise<void>;
  refreshConversations: () => Promise<void>;
}

export default function MobileSession({
  messages,
  conversationId,
  isLoading,
  isStreaming,
  activeCheckpoint,
  checkpointError,
  errorMessage,
  conversations,
  sendMessage,
  retryLastMessage,
  confirmCheckpoint,
  switchConversation,
  startNewSession,
  refreshConversations,
}: MobileSessionProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const [isConverging, setIsConverging] = useState(false);
  const [checkpointActionState, setCheckpointActionState] = useState<"confirmed" | "refined" | "rejected" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCheckpointRef = useRef<ActiveCheckpoint | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isLoading]);

  // Trigger particle convergence when a checkpoint arrives
  useEffect(() => {
    if (activeCheckpoint && !prevCheckpointRef.current) {
      setIsConverging(true);
      setCheckpointActionState(null);
      const timer = setTimeout(() => setIsConverging(false), 1500);
      return () => clearTimeout(timer);
    }
    prevCheckpointRef.current = activeCheckpoint;
  }, [activeCheckpoint]);

  const handleCloseSoundMenu = useCallback(() => {
    setShowSoundMenu(false);
  }, []);

  async function handleOpenDrawer() {
    setDrawerOpen(true);
    await refreshConversations();
  }

  const hasMessages = messages.length > 0;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          flexShrink: 0,
        }}
      >
        {/* Menu button — left */}
        <button
          onClick={handleOpenDrawer}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "3px",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "6px 4px",
            minWidth: "44px",
            minHeight: "44px",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: "16px",
                height: "1px",
                backgroundColor: "var(--color-text-ghost)",
              }}
            />
          ))}
        </button>

        {/* Logo — center */}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "var(--color-text-ghost)",
            letterSpacing: "4px",
            textTransform: "uppercase",
          }}
        >
          MANTLE
        </span>

        {/* Sound indicator — right */}
        <div
          style={{
            minWidth: "44px",
            minHeight: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <SoundIndicator compact onTap={() => setShowSoundMenu(!showSoundMenu)} />
          <MobileSoundSelector open={showSoundMenu} onClose={handleCloseSoundMenu} />
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          maskImage: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 3%, rgba(0,0,0,0.4) 6%, rgba(0,0,0,0.7) 10%, rgba(0,0,0,0.9) 14%, black 18%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.15) 3%, rgba(0,0,0,0.4) 6%, rgba(0,0,0,0.7) 10%, rgba(0,0,0,0.9) 14%, black 18%)",
        }}
      >
        <SessionParticles messageCount={messages.length} converge={isConverging} />
        {/* Spacer pushes messages to bottom of viewport */}
        <div style={{ flexGrow: 1, minHeight: "24px" }} />

        {/* Empty state placeholder */}
        {!hasMessages && !isLoading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 24px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "22px",
                color: "var(--color-text-ghost)",
                lineHeight: 1.5,
                letterSpacing: "-0.3px",
                textAlign: "center",
              }}
            >
              Ready when you are.
            </p>
          </div>
        )}

            {messages.map((msg, i) => {
              if (msg.role === "system") return null;

              const isUser = msg.role === "user";
              const isCheckpoint = msg.isCheckpoint === true;
              const isPendingCheckpoint =
                isCheckpoint &&
                activeCheckpoint &&
                activeCheckpoint.messageId === msg.id;

              // Checkpoint rendering — Meadow: light sage clearing with feathered gradient edges
              if (isCheckpoint) {
                return (
                  <div
                    key={msg.id || `msg-${i}`}
                    style={{
                      animation: "checkpointFadeIn 2s ease-out both",
                      background: "#0C0B0A",
                    }}
                  >
                    {/* Top feather — dark to light sage */}
                    <div
                      style={{
                        height: "90px",
                        background: "linear-gradient(180deg, #0C0B0A 0%, #1A1C17 12%, #2E3028 24%, #4A5242 42%, #7E8E72 60%, #A8B89C 76%, #CDDAC2 88%, #E0EADA 100%)",
                      }}
                    />
                    {/* Core surface */}
                    <div
                      style={{
                        position: "relative",
                        overflow: "hidden",
                        background: "linear-gradient(175deg, #E0EADA 0%, #E4EDE0 30%, #E8F0E4 50%, #E4EDE0 70%, #E0EADA 100%)",
                      }}
                    >
                      {/* Radial glow */}
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "radial-gradient(ellipse at center, rgba(245, 252, 240, 0.5) 0%, rgba(230, 242, 225, 0.2) 35%, transparent 60%)",
                          filter: "blur(35px)",
                          pointerEvents: "none",
                        }}
                      />
                      {/* Content */}
                      <div style={{ position: "relative", zIndex: 1, padding: "20px 24px" }}>
                        {/* Sage label */}
                        <div style={{ paddingBottom: "8px" }}>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "8px",
                              fontWeight: 500,
                              letterSpacing: "2.5px",
                              textTransform: "uppercase",
                              color: "#5E7054",
                            }}
                          >
                            Sage
                          </span>
                        </div>
                        {/* Body text */}
                        <div
                          style={{
                            fontFamily: "var(--font-serif)",
                            fontSize: "15px",
                            fontWeight: 400,
                            lineHeight: 1.75,
                            letterSpacing: "-0.2px",
                            color: "#2A3326",
                          }}
                        >
                          {renderMarkdown(msg.content)}
                        </div>

                        {/* "Does this feel right?" prompt */}
                        {isPendingCheckpoint && !checkpointActionState && (
                          <p
                            style={{
                              fontFamily: "var(--font-serif)",
                              fontSize: "13px",
                              fontStyle: "italic",
                              color: "#455040",
                              margin: "20px 0 0 0",
                            }}
                          >
                            Does this feel right?
                          </p>
                        )}

                        {/* Action buttons */}
                        {isPendingCheckpoint && !checkpointActionState ? (
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              marginTop: "16px",
                              paddingBottom: "4px",
                            }}
                          >
                            <button
                              onClick={() => {
                                setCheckpointActionState("confirmed");
                                confirmCheckpoint("confirmed");
                              }}
                              style={{
                                fontFamily: "var(--font-sans)",
                                fontSize: "12px",
                                fontWeight: 500,
                                color: "#5E7054",
                                background: "transparent",
                                border: "1px solid rgba(94, 112, 84, 0.35)",
                                borderRadius: "20px",
                                padding: "6px 16px",
                                cursor: "pointer",
                                transition: "all 0.25s ease",
                              }}
                            >
                              Yes, save this
                            </button>
                            <button
                              onClick={() => {
                                setCheckpointActionState("refined");
                                confirmCheckpoint("refined");
                              }}
                              style={{
                                fontFamily: "var(--font-sans)",
                                fontSize: "12px",
                                fontWeight: 500,
                                color: "#455040",
                                background: "transparent",
                                border: "1px solid rgba(69, 80, 64, 0.2)",
                                borderRadius: "20px",
                                padding: "6px 16px",
                                cursor: "pointer",
                                transition: "all 0.25s ease",
                              }}
                            >
                              Refine it
                            </button>
                            <button
                              onClick={() => {
                                setCheckpointActionState("rejected");
                                confirmCheckpoint("rejected");
                              }}
                              style={{
                                fontFamily: "var(--font-sans)",
                                fontSize: "12px",
                                fontWeight: 500,
                                color: "#455040",
                                background: "transparent",
                                border: "1px solid rgba(69, 80, 64, 0.2)",
                                borderRadius: "20px",
                                padding: "6px 16px",
                                cursor: "pointer",
                                transition: "all 0.25s ease",
                              }}
                            >
                              Skip
                            </button>
                          </div>
                        ) : isPendingCheckpoint && checkpointActionState ? (
                          <div
                            style={{
                              marginTop: "20px",
                              paddingBottom: "4px",
                              animation: "checkpointFadeIn 0.4s ease-out both",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 500,
                                letterSpacing: "0.08em",
                                color: checkpointActionState === "confirmed"
                                  ? "#5E7054"
                                  : "#455040",
                              }}
                            >
                              {checkpointActionState === "confirmed" && "Written to manual"}
                              {checkpointActionState === "refined" && "Sage will revisit this"}
                              {checkpointActionState === "rejected" && "Discarded"}
                            </span>
                          </div>
                        ) : null}

                        {/* Already-resolved checkpoints (loaded from DB) */}
                        {isCheckpoint && !isPendingCheckpoint && msg.checkpointMeta?.status && msg.checkpointMeta.status !== "pending" && (
                          <div
                            style={{
                              marginTop: "20px",
                              paddingBottom: "4px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 500,
                                letterSpacing: "0.08em",
                                color: msg.checkpointMeta.status === "confirmed"
                                  ? "#5E7054"
                                  : "#455040",
                              }}
                            >
                              {msg.checkpointMeta.status === "confirmed" && "Written to manual"}
                              {msg.checkpointMeta.status === "refined" && "Sage will revisit this"}
                              {msg.checkpointMeta.status === "rejected" && "Discarded"}
                            </span>
                          </div>
                        )}

                        {checkpointError && isPendingCheckpoint && (
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "10px",
                              color: "#455040",
                              marginTop: "12px",
                              display: "block",
                            }}
                          >
                            {checkpointError}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Bottom feather — light sage back to dark */}
                    <div
                      style={{
                        height: "90px",
                        background: "linear-gradient(180deg, #E0EADA 0%, #CDDAC2 12%, #A8B89C 24%, #7E8E72 40%, #4A5242 58%, #2E3028 76%, #1A1C17 88%, #0C0B0A 100%)",
                      }}
                    />
                  </div>
                );
              }

              // Sequence detection: checkpoints break Sage sequences
              const isFirstInSageSequence = (() => {
                if (msg.role !== "assistant") return false;
                if (i === 0) return true;
                const prev = messages[i - 1];
                if (!prev || prev.role === "system") return true;
                return prev.role !== "assistant" || prev.isCheckpoint === true;
              })();

              const isLastInSageSequence = (() => {
                if (msg.role !== "assistant") return false;
                if (i === messages.length - 1) {
                  if (isLoading) return false;
                  return true;
                }
                const next = messages[i + 1];
                if (!next || next.role === "system") return true;
                return next.role !== "assistant" || next.isCheckpoint === true;
              })();

              // Normal message rendering with Sage panel
              if (!isUser) {
                return (
                  <div
                    key={msg.id || `msg-${i}`}
                    className={isFirstInSageSequence ? "relative bg-[#151311]" : "bg-[#151311]"}
                  >
                    {/* Top dissolve overlay */}
                    {isFirstInSageSequence && (
                      <div className="absolute top-0 left-0 right-0 h-[12px] z-[1] pointer-events-none" style={{ background: 'linear-gradient(to bottom, var(--color-void), transparent)' }} />
                    )}
                    {/* Sage label */}
                    {isFirstInSageSequence && (
                      <div
                        className="px-[28px] pb-[8px]"
                        style={{
                          paddingTop: i === 0 ? "12px" : "20px",
                        }}
                      >
                        <span
                          className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#7A8B72]"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          Sage
                        </span>
                      </div>
                    )}
                    {/* Message — text fades in within the persistent panel */}
                    <div
                      className="px-[28px]"
                      style={{
                        paddingTop: isFirstInSageSequence ? "0" : "14px",
                        paddingBottom: isLastInSageSequence ? "12px" : "0",
                        animation: "checkpointFadeIn 0.8s ease-out both",
                      }}
                    >
                      <div
                        className="text-[15px] leading-[1.7] font-[430] text-[#D4CBC0] tracking-[0.01em]"
                        style={{ fontFamily: "var(--font-sans)" }}
                      >
                        {renderMarkdown(msg.content)}
                      </div>
                    </div>
                    {/* Bottom dissolve overlay */}
                    {isLastInSageSequence && (
                      <div className="relative">
                        <div className="absolute bottom-0 left-0 right-0 h-[12px] z-[1] pointer-events-none" style={{ background: 'linear-gradient(to top, var(--color-void), transparent)' }} />
                        <div className="h-[12px]" />
                      </div>
                    )}
                  </div>
                );
              }

              // User message
              return (
                <div
                  key={msg.id || `msg-${i}`}
                  className="pr-[28px] pl-[48px] py-[10px]"
                  style={{
                    animation: "checkpointFadeIn 0.45s ease-out both",
                  }}
                >
                  <p
                    className="text-[15px] leading-[1.7] font-normal text-[#C0B8AD] tracking-[0.01em] m-0"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {msg.content}
                  </p>
                </div>
              );
            })}

            {/* Processing dots */}
            {(isLoading || isStreaming) &&
              (messages.length === 0 || messages[messages.length - 1].role === "user") && (
                <div
                  className="relative bg-[#151311] px-[28px] pt-[20px] pb-[20px]"
                  style={{
                    animation: "checkpointFadeIn 0.3s ease-out both",
                  }}
                >
                  {/* Top dissolve overlay */}
                  <div className="absolute top-0 left-0 right-0 h-[12px] z-[1] pointer-events-none" style={{ background: 'linear-gradient(to bottom, var(--color-void), transparent)' }} />
                  {/* Show Sage label when prev message was user or checkpoint */}
                  {messages.length === 0 ||
                  messages[messages.length - 1]?.role !== "assistant" ||
                  messages[messages.length - 1]?.isCheckpoint === true ? (
                    <div className="pb-[8px]">
                      <span
                        className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#7A8B72]"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Sage
                      </span>
                    </div>
                  ) : null}
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", padding: "8px 0" }}>
                    {[0, 1, 2].map((dotIdx) => (
                      <div
                        key={dotIdx}
                        style={{
                          width: "5px",
                          height: "5px",
                          borderRadius: "50%",
                          backgroundColor: "#7A8B72",
                          opacity: 0.5,
                          animation: "sagePulse 2.4s ease-in-out infinite",
                          animationDelay: `${dotIdx * 0.35}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

            {/* Bottom spacer for checkpoint glow breathing room */}
            {messages.length > 0 &&
             messages[messages.length - 1]?.isCheckpoint === true &&
             !isLoading && (
              <div style={{ height: "40px", flexShrink: 0 }} />
            )}

            {/* Error */}
            {errorMessage && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "12px 0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "var(--color-text-ghost)",
                    }}
                  >
                    {errorMessage}
                  </span>
                  <button
                    onClick={retryLastMessage}
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--color-accent)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 8px",
                    }}
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
      </div>

      <ChatInput
        onSend={sendMessage}
        disabled={isLoading || isStreaming}
        hasMessages={messages.length > 0}
      />

      <SessionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversations={conversations}
        activeConversationId={conversationId}
        onSelectSession={switchConversation}
        onNewSession={startNewSession}
      />
    </div>
  );
}
