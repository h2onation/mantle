"use client";

import { useRouter } from "next/navigation";
import LoginScreen from "@/components/onboarding/LoginScreen";
import DesktopVitrine from "@/components/layout/DesktopVitrine";
import AuthShell from "@/components/desktop/AuthShell";
import { useIsDesktop } from "@/lib/hooks/useIsDesktop";

// Renders the login form directly — no entry/splash step. The marketing
// landing at / is the brand moment; anyone arriving here either clicked
// "Sign in" there or was bounced from a protected route by middleware,
// and both want the form immediately. Middleware redirects authenticated
// users from /login to /app, so no auth check is needed here.
//
// >=1030px gets the AuthShell (the desktop app's room treatment, minus
// the sidebar) so login matches the desktop shell; below that, the
// phone-frame vitrine is unchanged.
export default function LoginPage() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const goBack = () => router.push("/");

  // Same pre-paint gate as MainApp: blank linen until the media query
  // is measured, so neither shell flashes during hydration.
  if (isDesktop === null) {
    return (
      <div style={{ height: "100dvh", backgroundColor: "var(--session-linen)" }} />
    );
  }

  if (isDesktop) {
    return (
      <AuthShell onBack={goBack}>
        <LoginScreen onBack={goBack} initialMode="login" showTopBar={false} />
      </AuthShell>
    );
  }

  return (
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
        <LoginScreen onBack={goBack} initialMode="login" />
      </div>
    </DesktopVitrine>
  );
}
