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
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-sans)",
            color: "var(--color-text-muted)",
            fontSize: "14px",
          }}
        >
          Loading...
        </p>
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
