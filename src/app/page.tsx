import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MainApp from "@/components/MainApp";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <MainApp />;
}
