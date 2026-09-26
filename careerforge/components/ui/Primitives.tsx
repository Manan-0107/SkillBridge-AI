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
      className={`rounded-xl border border-ink/15 bg-surface p-6 text-ink shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-ink/15 bg-surface/80 px-2.5 py-0.5 text-[11px] font-semibold text-ink">
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
      className={`inline-flex items-center justify-center rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 shadow-xs cursor-pointer ${className}`}
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
      className={`inline-flex items-center justify-center rounded-lg border border-ink/15 bg-surface/60 px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink/80">
      {children}
    </label>
  );
}

export const inputClasses =
  "w-full rounded-lg border border-ink/15 bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/50 focus:border-accent focus:outline-none";
