import type { MetadataRoute } from "next";

// Public, indexable pages only. The app and admin surfaces are auth-gated and
// excluded (see robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://mywalnut.app";
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
