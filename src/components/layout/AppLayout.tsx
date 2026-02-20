"use client";

import React from "react";

interface AppLayoutProps {
  leftNav: React.ReactNode;
  chatPane: React.ReactNode;
  contextPane: React.ReactNode;
}

export default function AppLayout({
  leftNav,
  chatPane,
  contextPane,
}: AppLayoutProps) {
  return (
    <div
      style={{
        height: "100vh",
        display: "grid",
        gridTemplateColumns: "200px 1fr minmax(300px, 380px)",
        fontFamily: "var(--font-sans)",
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
