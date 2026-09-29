"use client";

import { Workspace } from "@/components/workspace/Workspace";

export default function JobsPage() {
  return (
    <main id="main-content" tabIndex={-1} className="bg-bg text-ink min-h-screen">
      <Workspace feature="local" />
    </main>
  );
}
