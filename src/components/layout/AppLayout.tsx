"use client";

import React, { useState, useRef, useEffect } from "react";

interface AppLayoutProps {
  leftNav: React.ReactNode;
  chatPane: React.ReactNode;
  contextPane: React.ReactNode;
  isBlurred?: boolean;
}

export default function AppLayout({
  leftNav,
  chatPane,
  contextPane,
  isBlurred,
}: AppLayoutProps) {
  const [filterStyle, setFilterStyle] = useState<string | undefined>(
    isBlurred ? "blur(12px)" : undefined
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isBlurred) {
      setFilterStyle("blur(12px)");
    } else {
      // Animate to blur(0), then remove filter entirely after transition
      setFilterStyle("blur(0px)");
      const el = containerRef.current;
      if (!el) return;

      const handleTransitionEnd = (e: TransitionEvent) => {
        if (e.propertyName === "filter") {
          setFilterStyle(undefined);
          el!.removeEventListener("transitionend", handleTransitionEnd);
        }
      };

      el.addEventListener("transitionend", handleTransitionEnd);
      return () => el.removeEventListener("transitionend", handleTransitionEnd);
    }
  }, [isBlurred]);

  return (
    <div
      ref={containerRef}
      style={{
        height: "100vh",
        display: "grid",
        gridTemplateColumns: "200px 1fr minmax(300px, 380px)",
        fontFamily: "var(--font-sans)",
        filter: filterStyle,
        pointerEvents: isBlurred ? "none" : undefined,
        transition: "filter 1.2s ease-out",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--color-bg-primary)",
          height: "100vh",
          overflowY: "auto",
        }}
      >
        {leftNav}
      </div>
      <div
        style={{
          backgroundColor: "var(--color-bg-primary)",
          height: "100vh",
          overflowY: "auto",
          borderLeft: "1px solid var(--color-border)",
          borderRight: "1px solid var(--color-border)",
        }}
      >
        {chatPane}
      </div>
      <div
        style={{
          backgroundColor: "var(--color-bg-secondary)",
          height: "100vh",
          overflowY: "auto",
        }}
      >
        {contextPane}
      </div>
    </div>
  );
}
