"use client";

import { useState } from "react";
import { useChat } from "@/lib/hooks/useChat";
import AppLayout from "@/components/layout/AppLayout";
import LeftNav from "@/components/layout/LeftNav";
import ChatPane from "@/components/layout/ChatPane";
import ContextPane from "@/components/context/ContextPane";
import ConversationHistory from "@/components/chat/ConversationHistory";

export default function MainApp() {
  const {
    messages,
    conversationId,
    isLoading,
    isStreaming,
    activeCheckpoint,
    confirmedComponents,
    initialized,
    displayName,
    errorMessage,
    checkpointError,
    sendMessage,
    retryLastMessage,
    confirmCheckpoint,
    loadConversation,
    startNewConversation,
    supabase,
  } = useChat();

  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    sendMessage(text);
  }

  function handlePromptSelect(text: string) {
    sendMessage(text);
  }

  // PromptCards timing: show after Sage's mirror message (Turn 3)
  // assistant count >= 2 AND user count === 1
  const assistantCount = messages.filter(
    (m) => m.role === "assistant"
  ).length;
  const userCount = messages.filter((m) => m.role === "user").length;
  const showPromptCards =
    assistantCount >= 2 && userCount === 1 && !isLoading && !isStreaming;

  const userInitials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (!initialized) {
    return (
      <div
        style={{
          height: "100vh",
          backgroundColor: "var(--color-bg-primary)",
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
                borderTopColor: i === 0 ? "#5C6B5E" : i === 1 ? "#B5AFA6" : "#E5DFD5",
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
            color: "var(--color-text-muted)",
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
      <ConversationHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={(convId) => loadConversation(convId)}
        onNewConversation={() => startNewConversation()}
        activeConversationId={conversationId}
        supabase={supabase}
      />
      <AppLayout
        leftNav={
          <LeftNav
            displayName={displayName}
            hasManualComponents={confirmedComponents.length > 0}
          />
        }
        chatPane={
          <ChatPane
            messages={messages}
            isLoading={isLoading}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            onPromptSelect={handlePromptSelect}
            showPromptCards={showPromptCards}
            onHistoryToggle={() => setHistoryOpen(true)}
            errorMessage={errorMessage}
            onRetry={retryLastMessage}
          />
        }
        contextPane={
          <ContextPane
            userInitials={userInitials}
            manualComponents={confirmedComponents}
            activeCheckpoint={activeCheckpoint}
            onCheckpointConfirm={() => confirmCheckpoint("confirmed")}
            onCheckpointRefine={() => confirmCheckpoint("refined")}
            onCheckpointReject={() => confirmCheckpoint("rejected")}
            checkpointError={checkpointError}
          />
        }
      />
    </>
  );
}
