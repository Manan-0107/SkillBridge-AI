"use client";

import { Workspace } from "@/components/workspace/Workspace";

export default function ResumePage() {
  return (
    <main id="main-content" tabIndex={-1} className="bg-bg text-ink">
      <Workspace feature="resume" />
    </main>
  );
}
