import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

// Served at /manifest.webmanifest (Next file convention). Replaces the old
// static public/manifest.webmanifest so the PWA identity reads the brand
// sheet. Next injects the <link rel="manifest"> automatically — layout.tsx
// must NOT also set metadata.manifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: "/app",
    display: "standalone",
    background_color: "#0C0B0A",
    theme_color: "#0C0B0A",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
