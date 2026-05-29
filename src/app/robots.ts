import type { MetadataRoute } from "next";

// The marketing landing and legal pages are indexable; the app, admin, and
// API/auth surfaces are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/admin", "/api/", "/auth/", "/reset-password"],
    },
    sitemap: "https://mywalnut.app/sitemap.xml",
    host: "https://mywalnut.app",
  };
}
