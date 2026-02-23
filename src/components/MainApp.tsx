"use client";

import { useChat } from "@/lib/hooks/useChat";
import { useOnboarding } from "@/lib/hooks/useOnboarding";
import MobileLayout from "@/components/layout/MobileLayout";
import OnboardingOverlay from "@/components/onboarding/OnboardingOverlay";
import MobileSession from "@/components/mobile/MobileSession";
import MobileManual from "@/components/mobile/MobileManual";
import MobileGuidance from "@/components/mobile/MobileGuidance";
import MobileSettings from "@/components/mobile/MobileSettings";

export default function MainApp() {
  const {
    messages,
    conversationId,
    isLoading,
    isStreaming,
    activeCheckpoint,
    confirmedComponents,
    initialized,
    isNewUser,
    sessionSummary,
    lastSessionDate,
    userEmail,
    errorMessage,
    checkpointError,
    conversations,
    sendMessage,
    retryLastMessage,
    confirmCheckpoint,
    switchConversation,
    startNewSession,
    refreshConversations,
  } = useChat();

  const {
    showOnboarding,
    isBlurred,
    skipWelcome,
    handleComplete,
    handleDismiss,
    handleInputFocus,
  } = useOnboarding({ initialized, isNewUser, sendMessage });

  if (!initialized) {
    return (
      <div
        style={{
          height: "100vh",
          backgroundColor: "var(--color-void)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
        }}
      >
        <div style={{ position: "relative", width: "40px", height: "40px" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "1.5px solid transparent",
                borderTopColor:
                  i === 0
                    ? "var(--color-accent)"
                    : i === 1
                      ? "var(--color-text-ghost)"
                      : "var(--color-divider)",
                animation: `mantleSpinner ${1.2 + i * 0.3}s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite`,
                animationDirection: i === 1 ? "reverse" : "normal",
                transform: `scale(${1 - i * 0.2})`,
              }}
            />
          ))}
        </div>
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: "14px",
            color: "var(--color-text-ghost)",
            margin: 0,
            animation: "mantleFadeIn 0.8s ease-out",
          }}
        >
          Forming...
        </p>
        <style>{`
          @keyframes mantleSpinner {
            0% { transform: scale(${1}) rotate(0deg); }
            100% { transform: scale(${1}) rotate(360deg); }
          }
          @keyframes mantleFadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <MobileLayout
        isBlurred={isBlurred}
        sessionContent={
          <MobileSession
            messages={messages}
            conversationId={conversationId}
            isLoading={isLoading}
            isStreaming={isStreaming}
            isNewUser={isNewUser}
            sessionSummary={sessionSummary}
            lastSessionDate={lastSessionDate}
            confirmedComponents={confirmedComponents}
            activeCheckpoint={activeCheckpoint}
            checkpointError={checkpointError}
            errorMessage={errorMessage}
            conversations={conversations}
            sendMessage={sendMessage}
            retryLastMessage={retryLastMessage}
            confirmCheckpoint={confirmCheckpoint}
            switchConversation={switchConversation}
            startNewSession={startNewSession}
            refreshConversations={refreshConversations}
            onInputFocus={handleInputFocus}
          />
        }
        manualContent={
          <MobileManual components={confirmedComponents} />
        }
        guidanceContent={
          <MobileGuidance confirmedCount={confirmedComponents.length} />
        }
        settingsContent={
          <MobileSettings
            userEmail={userEmail}
            sessionCount={conversations.length}
          />
        }
      />
      {showOnboarding && (
        <OnboardingOverlay
          onComplete={handleComplete}
          onDismiss={handleDismiss}
          skipWelcome={skipWelcome}
        />
      )}
    </>
  );
}
