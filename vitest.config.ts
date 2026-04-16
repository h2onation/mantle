import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Unit tests only by default. E2E tests live in `*.e2e.test.ts` and need
// a running local Supabase instance; they're run via `vitest.e2e.config.ts`
// / `npm run test:e2e`.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.e2e.test.ts", "node_modules/**"],
  },
});
