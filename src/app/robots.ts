import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

// The marketing landing and legal pages are indexable; the app, admin, and
// API/auth surfaces are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/admin", "/api/", "/auth/", "/reset-password"],
    },
    sitemap: `${BRAND.url}/sitemap.xml`,
    host: BRAND.url,
  };
}
