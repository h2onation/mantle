import type { Metadata, Viewport } from "next";
import { Instrument_Serif, DM_Sans, DM_Mono, Source_Serif_4, Newsreader } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";
import { PostHogProvider } from "@/components/PostHogProvider";
import ThemeInit from "@/components/ThemeInit";

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

// Newsreader is used ONLY on the landing page (EntryScreen). The rest of
// the app stays on Instrument Serif via --font-serif. Two weights + italic
// cover the masthead, headline, and rotating-specimen italic text.
const newsreader = Newsreader({
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#FAF7F0",
};

export const metadata: Metadata = {
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
    <html lang="en" suppressHydrationWarning className={`${instrumentSerif.variable} ${dmSans.variable} ${sourceSerif4.variable} ${dmMono.variable} ${newsreader.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var p=localStorage.getItem('mw-theme');if(p==='dark'||p==='light'){document.documentElement.setAttribute('data-theme',p)}var d=p==='dark'||(p!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'#15110C':'#FAF7F0')})()`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}`,
          }}
        />
      </head>
      <body className="antialiased" style={{ fontFamily: "var(--font-sans)" }}>
        <ThemeInit />
        <PostHogProvider>
          {children}
        </PostHogProvider>
        {process.env.NODE_ENV === "development" && <AgentationDev endpoint="http://localhost:4747" />}
      </body>
    </html>
  );
}
