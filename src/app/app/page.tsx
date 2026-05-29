import MainApp from "@/components/MainApp";
import AdminSignupsBadge from "@/components/admin/AdminSignupsBadge";

// Force dynamic rendering. Without this, Next.js prerenders this route as
// a static HTML file at build time, and Vercel serves it straight from the
// edge cache WITHOUT running middleware — unauth visitors would receive the
// static app shell instead of a redirect to /login. force-dynamic makes the
// page server-render per request, so middleware runs every time.
//
// Auth is still enforced by middleware — if the user reaches this page, they
// are authenticated. A redundant getUser() here caused Google OAuth login
// failures in the past, so we deliberately do not re-check auth here.
export const dynamic = "force-dynamic";

export default function App() {
  return (
    <>
      <MainApp />
      <AdminSignupsBadge />
    </>
  );
}
