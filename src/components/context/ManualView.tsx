"use client";

import { useState } from "react";

interface ManualComponent {
  id: string;
  layer: number;
  type: string;
  name: string | null;
  content: string;
}

interface ManualViewProps {
  components: ManualComponent[];
}

const LAYER_HEADINGS: Record<number, string> = {
  1: "WHAT DRIVES YOU",
  2: "HOW YOU REACT",
  3: "HOW YOU RELATE",
};

function LayerSection({
  layer,
  components,
}: {
  layer: number;
  components: ManualComponent[];
}) {
  const component = components.find(
    (c) => c.layer === layer && c.type === "component"
  );
  const patterns = components.filter(
    (c) => c.layer === layer && c.type === "pattern"
  );

  return (
    <div style={{ marginBottom: "28px" }}>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontWeight: 600,
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--color-text-muted)",
          margin: "0 0 12px 0",
        }}
      >
        {LAYER_HEADINGS[layer]}
      </p>

      {component ? (
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: "16px",
            lineHeight: 1.65,
            color: "var(--color-text-primary)",
            margin: 0,
            whiteSpace: "pre-wrap",
          }}
        >
          {component.content}
        </p>
      ) : (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontStyle: "italic",
            fontSize: "13px",
            color: "var(--color-text-muted)",
            margin: 0,
          }}
        >
          Still forming.
        </p>
      )}

      {patterns.map((p) => (
        <div key={p.id} style={{ marginTop: "16px" }}>
          {p.name && (
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                fontSize: "12px",
                color: "var(--color-text-secondary)",
                margin: "0 0 6px 0",
              }}
            >
              {p.name}
            </p>
          )}
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 400,
              fontSize: "15px",
              lineHeight: 1.6,
              color: "var(--color-text-primary)",
              margin: 0,
              paddingLeft: "12px",
              borderLeft: "2px solid var(--color-border)",
              whiteSpace: "pre-wrap",
            }}
          >
            {p.content}
          </p>
        </div>
      ))}
    </div>
  );
}

function ManualModal({
  components,
  onClose,
}: {
  components: ManualComponent[];
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--color-bg-primary)",
          borderRadius: "16px",
          padding: "32px",
          maxWidth: "640px",
          width: "90%",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "28px",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 400,
              fontSize: "22px",
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            Your Manual
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            &times;
          </button>
        </div>

        {[1, 2, 3].map((layer) => (
          <LayerSection key={layer} layer={layer} components={components} />
        ))}
      </div>
    </div>
  );
}

export default function ManualView({ components }: ManualViewProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {[1, 2, 3].map((layer) => (
          <LayerSection key={layer} layer={layer} components={components} />
        ))}

        <button
          onClick={() => setModalOpen(true)}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "var(--color-accent)",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            fontFamily: "var(--font-sans)",
            cursor: "pointer",
            marginTop: "8px",
          }}
        >
          View Full Manual
        </button>
      </div>

      {modalOpen && (
        <ManualModal
          components={components}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
