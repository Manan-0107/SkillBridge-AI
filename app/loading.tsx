import { UbixThinkingOrb } from "@/components/ubix/UbixThinkingOrb";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <UbixThinkingOrb state="processing" size="lg" />
      <div>
        <p className="text-sm font-semibold text-ink">Loading ubix...</p>
        <p className="text-xs text-ink/50">Preparing your accessible ubix workspace</p>
      </div>
      <span className="sr-only">Loading ubix workspace, please wait...</span>
    </div>
  );
}

