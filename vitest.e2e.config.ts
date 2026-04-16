import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// E2E test config — runs `*.e2e.test.ts` files against a running local
// Supabase instance (started via `supabase start`). See Track 5 of
// docs/checkpoint-hardening-plan.md.
//
// Expects these env vars set before running:
//   NEXT_PUBLIC_SUPABASE_URL      — typically http://127.0.0.1:54321
//   SUPABASE_SERVICE_ROLE_KEY     — from `supabase status` after start
//
// Locally: `supabase start && npm run test:e2e`.
// CI: handled by .github/workflows/supabase-e2e.yml.

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.e2e.test.ts"],
    exclude: ["node_modules/**"],
    testTimeout: 30_000, // DB round-trips are slower than unit tests
    hookTimeout: 60_000,
    // Serial — tests share a real DB. Parallel would cause row
    // contamination without careful isolation.
    fileParallelism: false,
  },
});
