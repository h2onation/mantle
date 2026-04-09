import MainApp from "@/components/MainApp";

// Force dynamic rendering. Without this, Next.js prerenders `/` as
// a static HTML file at build time, and Vercel serves it straight
// from the edge cache WITHOUT running middleware. That meant unauth
// visitors received the static linen splash instead of a redirect
// to /login, then the client-side useChat bailed on no user and
// the splash stuck forever. force-dynamic makes the page
// server-render per request, so middleware runs every time.
//
// Auth is still enforced by middleware — if the user reaches this
// page, they are authenticated. A redundant getUser() here caused
// Google OAuth login failures in the past, so we deliberately do
// not re-check auth in this Server Component.
export const dynamic = "force-dynamic";

export default function Home() {
  return <MainApp />;
}
