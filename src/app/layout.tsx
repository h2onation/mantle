import type { Metadata, Viewport } from "next";
import { Newsreader, Source_Serif_4, Fraunces, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";
import { PostHogProvider } from "@/components/PostHogProvider";
import { BRAND } from "@/lib/brand";
import ThemeInit from "@/components/ThemeInit";
import PersonaDyslexicFontInit from "@/components/PersonaDyslexicFontInit";

// FOUC-safe theme bootstrap. Reads localStorage.mywalnut.theme. Light
// is the default brand experience: an explicit "light"/"dark" choice
// wins; "system" follows the OS; anything else (including no stored
// value) resolves to light. Sets the resolved theme on <html data-theme>
// AND updates the meta theme-color tag (iOS PWA status bar) — both before
// the first paint. Subsequent theme changes flow through useTheme / ThemeInit.
const THEME_FOUC_SCRIPT = `(function(){try{var s=localStorage.getItem('mywalnut.theme');var t=(s==='light'||s==='dark')?s:(s==='system'?(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):'light');document.documentElement.setAttribute('data-theme',t);var c=t==='light'?'#E6E0D4':'#0A0B10';var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute('content',c);}}catch(e){}})();`;

// FOUC-safe persona-dyslexic bootstrap. Reads localStorage.mywalnut.persona-dyslexic
// (set by the picker / reconciled by PersonaDyslexicFontInit against the
// authoritative profile value). Sets <html data-persona-dyslexic="true">
// before first paint so a returning dyslexic user never sees their Manual
// flash in serif before the serif tokens rebind to sans. Absent value
// → no attribute → base typography. See globals.css for the swap rule.
const PERSONA_DYSLEXIC_FOUC_SCRIPT = `(function(){try{if(localStorage.getItem('mywalnut.persona-dyslexic')==='true'){document.documentElement.setAttribute('data-persona-dyslexic','true');}}catch(e){}})();`;

const AgentationDev = dynamic(() => import("agentation").then((m) => ({ default: m.Agentation })), { ssr: false });

// Redesign type system (Phase 1 Commit B):
//   --font-serif    → Newsreader        (body / prose / "your words")
//   --font-display  → Fraunces          (display headings — opt-in; the v6 moment)
//   --font-sans     → Plus Jakarta Sans (UI)
//   --font-mono     → JetBrains Mono    (meta caps)
//   --font-persona  → Source Serif 4    (prose fallback, unchanged)
//   --font-spectral → Newsreader        (legacy heading token, now the body serif;
//                     true display headings opt into --font-display instead).
const newsreader = Newsreader({
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
});

const newsreaderSpectral = Newsreader({
  weight: ["400", "500"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-spectral",
});

const fraunces = Fraunces({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-display",
});

const jakarta = Plus_Jakarta_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-sans",
});

const sourceSerif4 = Source_Serif_4({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-persona",
});

const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const viewport: Viewport = {
  themeColor: "#E6E0D4",
};

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: BRAND.name,
  description: BRAND.tagline,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: BRAND.name,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${newsreader.variable} ${jakarta.variable} ${sourceSerif4.variable} ${jetbrainsMono.variable} ${fraunces.variable} ${newsreaderSpectral.variable}`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <script
          dangerouslySetInnerHTML={{ __html: THEME_FOUC_SCRIPT }}
        />
        <script
          dangerouslySetInnerHTML={{ __html: PERSONA_DYSLEXIC_FOUC_SCRIPT }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}`,
          }}
        />
      </head>
      <body className="antialiased" style={{ fontFamily: "var(--font-sans)" }}>
        <ThemeInit />
        <PersonaDyslexicFontInit />
        <PostHogProvider>
          {children}
        </PostHogProvider>
        {process.env.NODE_ENV === "development" && <AgentationDev endpoint="http://localhost:4747" />}
      </body>
    </html>
  );
}
