"use client";

import { useRouter } from "next/navigation";
import LoginScreen from "@/components/onboarding/LoginScreen";
import DesktopVitrine from "@/components/layout/DesktopVitrine";

// Renders the login form directly — no entry/splash step. The marketing
// landing at / is the brand moment; anyone arriving here either clicked
// "Sign in" there or was bounced from a protected route by middleware,
// and both want the form immediately. Middleware redirects authenticated
// users from /login to /app, so no auth check is needed here.
export default function LoginPage() {
  const router = useRouter();
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
        <LoginScreen onBack={() => router.push("/")} initialMode="login" />
      </div>
    </DesktopVitrine>
  );
}
