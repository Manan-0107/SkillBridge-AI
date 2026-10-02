"use client";

import { Workspace } from "@/components/workspace/Workspace";

export default function LearningPage() {
  return (
    <main id="main-content" tabIndex={-1} className="bg-bg text-ink min-h-screen">
      <Workspace feature="courses" />
    </main>
  );
}
