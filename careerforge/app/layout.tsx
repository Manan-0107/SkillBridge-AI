import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import { GlobalVoiceDictator } from "@/components/accessibility/GlobalVoiceDictator";
import { GlobalVoiceProvider } from "@/providers/GlobalVoiceProvider";
import { VoiceProvider } from "@/context/VoiceContext";

const fontSans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

import { TopNav } from "@/components/layout/TopNav";
import { FloatingControlBar } from "@/components/layout/FloatingControlBar";
import { AccessibilityProfileModal } from "@/components/accessibility/AccessibilityProfileModal";
import { VoiceModeDetector } from "@/components/accessibility/VoiceModeDetector";

export const metadata: Metadata = {
  title: "CareerForge — Build the path, not just the resume",
  description:
    "Resume tooling, dynamic career roadmaps, curated courses, and local opportunities in one quiet workspace.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fontSans.variable}`}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="font-sans antialiased bg-bg text-ink min-h-screen selection:bg-surface selection:text-ink">
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
