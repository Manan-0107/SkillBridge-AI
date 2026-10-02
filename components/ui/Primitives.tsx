import { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-surface/90 backdrop-blur-md p-6 text-ink shadow-[0_8px_30px_rgb(0,0,0,0.35)] transition-all duration-200 hover:border-white/[0.14] ${className}`}
    >
      {children}
    </div>
  );
}

export function Tag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-ink/80 transition-colors ${className}`}>
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-bg shadow-[0_0_20px_-3px_rgba(34,211,238,0.35)] transition-all hover:opacity-95 hover:shadow-[0_0_25px_-2px_rgba(34,211,238,0.5)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-surface/60 backdrop-blur-sm px-5 py-2.5 text-sm font-medium text-ink transition-all hover:bg-surface-elevated hover:border-white/[0.2] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink/60">
      {children}
    </label>
  );
}

export const inputClasses =
  "w-full rounded-xl border border-white/[0.1] bg-surface-sunken px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 transition-all";
