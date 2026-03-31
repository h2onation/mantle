import MainApp from "@/components/MainApp";

// Auth is enforced by middleware — if the user reaches this page,
// they are authenticated. A redundant getUser() here caused Google
// OAuth login failures: middleware refreshes the token and writes
// updated cookies to the response, but a second getUser() in the
// Server Component reads stale request cookies, fails the refresh
// write (cookies().set() throws in Server Components), and triggers
// a redirect to /login — creating a loop.
export default function Home() {
  return <MainApp />;
}
