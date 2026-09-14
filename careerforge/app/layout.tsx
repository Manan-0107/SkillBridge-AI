import type { Metadata } from "next";
import { Newsreader, Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import { GlobalVoiceDictator } from "@/components/accessibility/GlobalVoiceDictator";
import { GlobalVoiceProvider } from "@/providers/GlobalVoiceProvider";
import { VoiceProvider } from "@/context/VoiceContext";

const display = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
  adjustFontFallback: false,
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

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
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-body antialiased">
        <AppProvider>
          <GlobalVoiceProvider>
            <VoiceProvider>
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-black focus:px-4 focus:py-3 focus:text-white"
              >
                Skip to main content
              </a>
              <a
                href="#voice-assistant-controls"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-20 focus:z-[100] focus:rounded-md focus:bg-black focus:px-4 focus:py-3 focus:text-white"
              >
                Skip to voice assistant controls
              </a>
              {children}
              <GlobalVoiceDictator />
            </VoiceProvider>
          </GlobalVoiceProvider>
        </AppProvider>
      </body>
    </html>
  );
}
