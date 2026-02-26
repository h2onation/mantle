"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

interface LayerTooltipProps {
  text: string;
  showSageAction: boolean;
  onExploreWithSage?: () => void;
  children: React.ReactNode;
}

export default function LayerTooltip({
  text,
  showSageAction,
  onExploreWithSage,
  children,
}: LayerTooltipProps) {
  const [open, setOpen] = useState(false);
  const [flipUp, setFlipUp] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const checkPosition = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    // Tooltip is ~200px tall (text + optional button + padding)
    // Flip up if there's less than 220px below the trigger
    const spaceBelow = window.innerHeight - rect.bottom;
    setFlipUp(spaceBelow < 220);
  }, []);

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
      style={{ position: "relative", display: "inline-flex", zIndex: open ? 50 : "auto" }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          checkPosition();
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
            @keyframes tooltipFadeInUp {
              from { opacity: 0; transform: translateY(-6px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              ...(flipUp
                ? { bottom: "calc(100% + 8px)" }
                : { top: "calc(100% + 8px)" }),
              right: 0,
              width: 280,
              background: "#1A1816",
              borderRadius: 12,
              border: "1px solid rgba(122,139,114,0.15)",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(122,139,114,0.05)",
              padding: "18px 20px",
              zIndex: 50,
              animation: flipUp
                ? "tooltipFadeInUp 0.2s ease-out both"
                : "tooltipFadeIn 0.2s ease-out both",
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
                  onExploreWithSage?.();
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
