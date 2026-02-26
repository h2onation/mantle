"use client";

import React, { useState, useRef, useEffect } from "react";

interface LayerTooltipProps {
  text: string;
  showSageAction: boolean;
  children: React.ReactNode;
}

export default function LayerTooltip({
  text,
  showSageAction,
  children,
}: LayerTooltipProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside, true);
    return () =>
      document.removeEventListener("click", handleClickOutside, true);
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      style={{ position: "relative", display: "inline-flex" }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        style={{ cursor: "pointer" }}
      >
        {children}
      </div>

      {open && (
        <>
          {/* Tooltip fade-in animation */}
          <style>{`
            @keyframes tooltipFadeIn {
              from { opacity: 0; transform: translateY(6px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: 280,
              background: "#1A1816",
              borderRadius: 12,
              border: "1px solid rgba(122,139,114,0.15)",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(122,139,114,0.05)",
              padding: "18px 20px",
              zIndex: 30,
              animation: "tooltipFadeIn 0.2s ease-out both",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "13.5px",
                color: "rgba(212,203,192,0.6)",
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              {text}
            </p>

            {showSageAction && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  console.log("Navigate to Session tab");
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#A8B89F",
                  background:
                    "linear-gradient(135deg, rgba(122,139,114,0.15) 0%, rgba(122,139,114,0.08) 100%)",
                  border: "1px solid rgba(122,139,114,0.25)",
                  borderRadius: 8,
                  padding: "9px 14px 9px 12px",
                  cursor: "pointer",
                  marginTop: 14,
                  transition: "border-color 0.2s ease",
                }}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  style={{ display: "block" }}
                >
                  <path
                    d="M3 1.5L7 5L3 8.5"
                    stroke="#A8B89F"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Explore with Sage
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
