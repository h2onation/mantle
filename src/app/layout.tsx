import type { Metadata, Viewport } from "next";
import { Instrument_Serif, DM_Sans, DM_Mono, Source_Serif_4, Newsreader, Spectral } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";
import { PostHogProvider } from "@/components/PostHogProvider";
import ThemeInit from "@/components/ThemeInit";
import PersonaDyslexicFontInit from "@/components/PersonaDyslexicFontInit";

// FOUC-safe theme bootstrap. Reads localStorage.mywalnut.theme; falls
// back to prefers-color-scheme; falls back to "dark". Sets the
// resolved theme on <html data-theme> AND updates the meta
// theme-color tag (iOS PWA status bar) — both before the first paint.
// Subsequent theme changes flow through useTheme / ThemeInit.
const THEME_FOUC_SCRIPT = `(function(){try{var s=localStorage.getItem('mywalnut.theme');var t=(s==='light'||s==='dark')?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);var c=t==='light'?'#E5D8BE':'#0A0B10';var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute('content',c);}}catch(e){}})();`;

// FOUC-safe persona-dyslexic bootstrap. Reads localStorage.mywalnut.persona-dyslexic
// (set by the picker / reconciled by PersonaDyslexicFontInit against the
// authoritative profile value). Sets <html data-persona-dyslexic="true">
// before first paint so a returning dyslexic user never sees their Manual
// flash in serif before the serif tokens rebind to sans. Absent value
// → no attribute → base typography. See globals.css for the swap rule.
const PERSONA_DYSLEXIC_FOUC_SCRIPT = `(function(){try{if(localStorage.getItem('mywalnut.persona-dyslexic')==='true'){document.documentElement.setAttribute('data-persona-dyslexic','true');}}catch(e){}})();`;

const AgentationDev = dynamic(() => import("agentation").then((m) => ({ default: m.Agentation })), { ssr: false });

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-serif",
});

const dmSans = DM_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-sans",
});

const sourceSerif4 = Source_Serif_4({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-persona",
});

const dmMono = DM_Mono({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
});

const newsreader = Newsreader({
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const spectral = Spectral({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-spectral",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0A0B10",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://mywalnut.app"),
  title: "mywalnut",
  description: "Understand how you operate.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "mywalnut",
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
      data-theme="dark"
      suppressHydrationWarning
      className={`${instrumentSerif.variable} ${dmSans.variable} ${sourceSerif4.variable} ${dmMono.variable} ${newsreader.variable} ${spectral.variable}`}
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
