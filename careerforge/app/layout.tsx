import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
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
    <html lang="en" className={fontSans.variable}>
      <body className="font-sans antialiased text-ink bg-paper">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
