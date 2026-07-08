/** @type {import('next').NextConfig} */
const nextConfig = {
  // Explicitly include the markdown source docs in the admin/docs API
  // route's serverless function bundle. Without this, Next.js's file
  // tracer can miss them — especially CLAUDE.md at the repo root and the
  // dynamic per-doc paths constructed from an array in route.ts.
  // In Next.js 14 this lives under `experimental` (promoted to top-level
  // in Next.js 15).
  experimental: {
    outputFileTracingIncludes: {
      "/api/admin/docs": [
        "./CLAUDE.md",
        "./docs/*.md",
        "./docs/reference/conductor-scoring.md",
      ],
      "/api/admin/docs/[name]": [
        "./CLAUDE.md",
        "./docs/*.md",
        "./docs/reference/conductor-scoring.md",
      ],
      // The conversation scorer reads the rubric doc as its code-default
      // floor (the admin override lives in persona_voice_overrides).
      "/api/admin/score-conversation": [
        "./docs/reference/conductor-scoring.md",
      ],
      "/api/admin/scoring-rubric": ["./docs/reference/conductor-scoring.md"],
    },
  },
};

export default nextConfig;
