import Link from "next/link";

export default function NotFound() {
  return (
    <main
      role="region"
      aria-labelledby="not-found-heading"
      className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface text-2xl font-bold text-accent shadow-sm border border-ink/15">
        404
      </div>
      <div className="max-w-md space-y-2">
        <h1 id="not-found-heading" className="text-xl font-bold tracking-tight text-ink font-display">
          Page Not Found
        </h1>
        <p className="text-sm text-ink/70">
          The career resource or page you requested could not be found. You can return to the dashboard or ask your AI assistant for assistance.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-accent px-5 py-2.5 text-xs font-semibold text-bg shadow-sm hover:bg-accent-soft transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        >
          Return to Dashboard
        </Link>
      </div>
    </main>
  );
}
