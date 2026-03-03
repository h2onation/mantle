"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import ExploreWithSageButton from "@/components/shared/ExploreWithSageButton";

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
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              ...(flipUp
                ? { bottom: "calc(100% + 8px)" }
                : { top: "calc(100% + 8px)" }),
              right: 0,
              width: 280,
              background: "var(--color-tooltip-bg)",
              borderRadius: 12,
              border: "1px solid var(--color-tooltip-border)",
              boxShadow:
                "0 20px 60px var(--color-backdrop), 0 0 30px rgba(122,139,114,0.05)",
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
                color: "var(--color-tooltip-text)",
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              {text}
            </p>

            {showSageAction && onExploreWithSage && (
              <ExploreWithSageButton
                onClick={onExploreWithSage}
                variant="dark"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
