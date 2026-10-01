"use client";

import { CareerTelemetry } from "@/components/progress/CareerTelemetry";

export default function ProgressPage() {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-bg text-ink">
      <CareerTelemetry />
    </main>
  );
}
