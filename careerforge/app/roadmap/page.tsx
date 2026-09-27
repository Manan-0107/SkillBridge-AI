"use client";

import { Workspace } from "@/components/workspace/Workspace";

export default function RoadmapPage() {
  return (
    <main id="main-content" tabIndex={-1} className="bg-bg text-ink min-h-0 flex-1">
      <Workspace feature="roadmap" />
    </main>
  );
}
