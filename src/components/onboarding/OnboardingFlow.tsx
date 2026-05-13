"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import EntryScreen from "./EntryScreen";
import LoginScreen from "./LoginScreen";
import DesktopVitrine from "@/components/layout/DesktopVitrine";

type ViewName = "entry" | "login";

export default function OnboardingFlow() {
  const [currentView, setCurrentView] = useState<ViewName>("entry");
  const [viewOpacity, setViewOpacity] = useState(1);
  const [ready, setReady] = useState(false);
  const [loginMode, setLoginMode] = useState<"login" | "signup">("login");
  const checkedRef = useRef(false);

  // Show UI immediately — middleware already handles redirecting
  // authenticated users from /login to /. No need to duplicate that
  // check here (doing so causes redirect loops with stale cookies).
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    setReady(true);
  }, []);

  const fadeToView = useCallback((view: ViewName, duration = 400) => {
    setViewOpacity(0);
    setTimeout(() => {
      setCurrentView(view);
      setViewOpacity(1);
    }, duration);
  }, []);

  function handleBegin() {
    setLoginMode("signup");
    fadeToView("login");
  }

  function handleLogin() {
    setLoginMode("login");
    fadeToView("login");
  }

  function handleBackToEntry() {
    setCurrentView("entry");
    setViewOpacity(1);
  }

  if (!ready) {
    return (
      <div
        style={{
          width: "100%",
          height: "100dvh",
          background: "var(--session-linen)",
        }}
      />
    );
  }

  // EntryScreen escapes the DesktopVitrine on desktop (see Track A Gate 2):
  // the landing page reads as a real responsive web page, not a 430px column
  // inside a phone frame. All other onboarding views stay inside the
  // vitrine. The opacity wrapper is on the outermost element so cross-fades
  // between entry and the vitrine-wrapped views feel unified rather than
  // having the vitrine chrome (masthead, colophon) pop in/out abruptly.
  return (
    <div
      style={{
        opacity: viewOpacity,
        transition: "opacity 400ms ease",
      }}
    >
      {currentView === "entry" ? (
        <EntryScreen onBegin={handleBegin} onLogin={handleLogin} />
      ) : (
        <DesktopVitrine>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "var(--session-linen)",
              backgroundImage: "var(--session-bg-welcome)",
              overflow: "hidden",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <div style={{ height: "100%" }}>
              {currentView === "login" && (
                <LoginScreen onBack={handleBackToEntry} initialMode={loginMode} />
              )}
            </div>
          </div>
        </DesktopVitrine>
      )}
    </div>
  );
}
