"use client";

import CheckpointCard from "./CheckpointCard";
import ManualView from "./ManualView";

interface ManualComponent {
  id: string;
  layer: number;
  type: string;
  name: string | null;
  content: string;
}

interface ActiveCheckpoint {
  messageId: string;
  content: string;
  name: string | null;
  layer: number;
  type: string;
}

interface ContextPaneProps {
  userInitials: string;
  manualComponents: ManualComponent[];
  activeCheckpoint: ActiveCheckpoint | null;
  onCheckpointConfirm?: () => void;
  onCheckpointRefine?: () => void;
  onCheckpointReject?: () => void;
  checkpointError?: string | null;
}

export default function ContextPane({
  userInitials,
  manualComponents,
  activeCheckpoint,
  onCheckpointConfirm,
  onCheckpointRefine,
  onCheckpointReject,
  checkpointError,
}: ContextPaneProps) {
  const hasComponents = manualComponents.length > 0;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "12px",
        gap: "12px",
        boxSizing: "border-box",
      }}
    >
      {/* Top section — context / checkpoint area */}
      <div
        style={{
          flex: "0 0 60%",
          backgroundColor: "rgba(255,255,255,0.4)",
          borderRadius: "12px",
          padding: "20px",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              backgroundColor: "var(--color-accent)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              flexShrink: 0,
            }}
          >
            {userInitials}
          </div>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--color-text-primary)",
            }}
          >
            You
          </span>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--color-text-muted)",
              marginLeft: "auto",
            }}
          >
            Primary
          </span>
        </div>

        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--color-text-muted)",
            margin: "0 0 8px 0",
            cursor: "default",
          }}
        >
          + Add Context
        </p>

        {/* Checkpoint area */}
        {activeCheckpoint && (
          <CheckpointCard
            content={activeCheckpoint.content}
            name={activeCheckpoint.name}
            onConfirm={onCheckpointConfirm || (() => {})}
            onRefine={onCheckpointRefine || (() => {})}
            onReject={onCheckpointReject || (() => {})}
            error={checkpointError}
          />
        )}
      </div>

      {/* Bottom section — manual preview */}
      <div
        style={{
          flex: "0 0 calc(40% - 12px)",
          backgroundColor: "rgba(255,255,255,0.4)",
          borderRadius: "12px",
          padding: "20px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {!hasComponents ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontSize: "14px",
                color: "var(--color-text-muted)",
                textAlign: "center",
                margin: 0,
              }}
            >
              Your manual will take shape here
            </p>
          </div>
        ) : (
          <ManualView components={manualComponents} />
        )}
      </div>
    </div>
  );
}
