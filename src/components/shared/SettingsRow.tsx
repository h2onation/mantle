"use client";

import type React from "react";

interface SettingsRowProps {
  title: string;
  subtitle?: string;
  titleColor?: string;
  onClick?: () => void;
  rightContent?: React.ReactNode;
  children?: React.ReactNode;
  noBorder?: boolean;
}

export default function SettingsRow({
  title,
  subtitle,
  titleColor,
  onClick,
  rightContent,
  children,
  noBorder,
}: SettingsRowProps) {
  const isButton = !!onClick;
  const Tag = isButton ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      style={{
        width: "100%",
        padding: "18px 0",
        background: "none",
        border: "none",
        borderBottom: noBorder ? "none" : "1px solid var(--color-divider)",
        cursor: isButton ? "pointer" : "default",
        textAlign: "left" as const,
        WebkitTapHighlightColor: isButton ? "transparent" : undefined,
        display: rightContent ? "flex" : undefined,
        alignItems: rightContent ? "center" : undefined,
        justifyContent: rightContent ? "space-between" : undefined,
      }}
    >
      {children ? (
        children
      ) : (
        <div>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: titleColor || "var(--color-text)",
              letterSpacing: "0.2px",
              margin: 0,
            }}
          >
            {title}
          </p>
          {subtitle && (
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                color: "var(--color-text-ghost)",
                letterSpacing: "0.5px",
                margin: "3px 0 0 0",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}
      {rightContent}
    </Tag>
  );
}
