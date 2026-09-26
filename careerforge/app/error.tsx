"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error message without exposing internal stacks
    console.error("[CareerForge Error Boundary]:", error.message || "An unexpected error occurred");
  }, [error]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/10 text-2xl text-danger shadow-sm border border-danger/20">
        ⚠️
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-ink font-display">
          Something went wrong
        </h1>
        <p className="text-sm text-ink/70">
          We encountered a temporary issue loading this section. Your saved session data remains safe.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-accent px-5 py-2.5 text-xs font-semibold text-bg shadow-sm hover:bg-accent-soft transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        >
          Try Again
        </button>
        <a
          href="/"
          className="rounded-full border border-ink/15 bg-surface px-5 py-2.5 text-xs font-semibold text-ink hover:bg-surface/80 hover:border-ink/25 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        >
          Return to Dashboard
        </a>
      </div>
    </div>
  );
}
