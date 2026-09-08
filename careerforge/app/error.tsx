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
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-2xl text-rose-600 shadow-sm border border-rose-100">
        ⚠️
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900">
          Something went wrong
        </h1>
        <p className="text-sm text-neutral-600">
          We encountered a temporary issue loading this section. Your saved session data remains safe.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-neutral-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
        >
          Try Again
        </button>
        <a
          href="/"
          className="rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
        >
          Return to Dashboard
        </a>
      </div>
    </div>
  );
}
