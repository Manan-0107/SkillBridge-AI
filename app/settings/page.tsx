import React from "react";
import { SettingsView } from "@/components/settings/SettingsView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Center & Settings | UBIX",
  description: "Inspect personal career memory, configure automation permissions, and manage your data.",
};

export default function SettingsPage() {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-bg text-ink">
      <SettingsView />
    </main>
  );
}
