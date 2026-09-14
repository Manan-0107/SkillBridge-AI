import type { Metadata } from "next";
import { Newsreader, Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import { GlobalVoiceDictator } from "@/components/accessibility/GlobalVoiceDictator";
import { GlobalVoiceProvider } from "@/providers/GlobalVoiceProvider";
import { VoiceProvider } from "@/context/VoiceContext";
import { VoiceBar } from "@/components/common/VoiceBar";

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
              {children}
              <GlobalVoiceDictator />
              <VoiceBar />
            </VoiceProvider>
          </GlobalVoiceProvider>
        </AppProvider>
      </body>
    </html>
  );
}
