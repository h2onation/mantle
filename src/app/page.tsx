import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#F5F0E8",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "32px",
          color: "#2C2C2C",
          fontWeight: 400,
          margin: 0,
        }}
      >
        Welcome to Mantle
      </h1>
      <LogoutButton />
    </div>
  );
}
