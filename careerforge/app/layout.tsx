import type { Metadata } from "next";
import { Space_Grotesk, Instrument_Sans } from "next/font/google";
import "./globals.css";
import "../styles/ubix-effects.css";
import { AppProvider } from "@/lib/store";
import { GlobalVoiceDictator } from "@/components/accessibility/GlobalVoiceDictator";
import { GlobalVoiceProvider } from "@/providers/GlobalVoiceProvider";
import { VoiceProvider } from "@/context/VoiceContext";
import { UbixAmbientGlow } from "@/components/ubix/UbixAmbientGlow";
import { UbixCursorGlow } from "@/components/ubix/UbixCursorGlow";

const fontDisplay = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const fontSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

import { TopNav } from "@/components/layout/TopNav";
import { FloatingControlBar } from "@/components/layout/FloatingControlBar";
import { AccessibilityProfileModal } from "@/components/accessibility/AccessibilityProfileModal";
import { VoiceModeDetector } from "@/components/accessibility/VoiceModeDetector";

export const metadata: Metadata = {
  title: "ubix — workspace",
  description:
    "Resume tooling, dynamic career roadmaps, curated courses, and local opportunities in one quiet workspace.",
  openGraph: {
    title: "ubix — workspace",
    description:
      "Resume tooling, dynamic career roadmaps, curated courses, and local opportunities in one quiet workspace.",
    siteName: "ubix",
  },
  icons: {
    icon: "/favicon.svg",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontSans.variable} dark`}
      data-theme="dark"
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('ubix_theme');
                if (theme === 'light') {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.removeAttribute('data-theme');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-bg text-ink min-h-screen selection:bg-surface selection:text-ink relative">
        <UbixAmbientGlow />
        <UbixCursorGlow />
        <AppProvider>
          <GlobalVoiceProvider>
            <VoiceProvider>
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-ink focus:px-4 focus:py-3 focus:text-bg"
              >
                Skip to main content
              </a>
              <a
                href="#voice-assistant-controls"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-20 focus:z-[100] focus:rounded-md focus:bg-ink focus:px-4 focus:py-3 focus:text-bg"
              >
                Skip to voice assistant controls
              </a>
              <TopNav />
              {children}
              <FloatingControlBar />
              <AccessibilityProfileModal />
              <VoiceModeDetector />
              <GlobalVoiceDictator />
            </VoiceProvider>
          </GlobalVoiceProvider>
        </AppProvider>
      </body>
    </html>
  );
}

