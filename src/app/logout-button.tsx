"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: "10px 24px",
        backgroundColor: "transparent",
        color: "var(--color-text)",
        border: "1px solid var(--color-divider)",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: 500,
        fontFamily: "var(--font-sans)",
        cursor: "pointer",
      }}
    >
      Log Out
    </button>
  );
}
