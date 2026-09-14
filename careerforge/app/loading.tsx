export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <div className="relative flex h-12 w-12 items-center justify-center">
        <div className="absolute h-full w-full animate-ping rounded-full bg-emerald-400/30" />
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-emerald-600" />
      </div>
      <div>
        <p className="text-sm font-semibold text-neutral-900">Loading CareerForge...</p>
        <p className="text-xs text-neutral-500">Preparing your accessible career workspace</p>
      </div>
      <span className="sr-only">Loading application, please wait...</span>
    </div>
  );
}
