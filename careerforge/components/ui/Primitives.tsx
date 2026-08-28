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
      className={`rounded-xl border border-line bg-white/70 p-6 sm:p-8 text-base ${className}`}
    >
      {children}
    </div>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line px-3 py-1 text-xs font-semibold text-graphite tracking-wide">
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
      className={`inline-flex items-center justify-center rounded-lg bg-ink px-6 py-3.5 text-base font-semibold text-paper shadow-sm transition-all hover:bg-neutral-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 min-h-[48px] ${className}`}
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
      className={`inline-flex items-center justify-center rounded-lg border border-line bg-white px-6 py-3 text-base font-medium text-ink transition-all hover:border-ink hover:bg-neutral-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 min-h-[48px] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-2 block text-sm font-semibold uppercase tracking-wider text-graphite">
      {children}
    </label>
  );
}

export const inputClasses =
  "w-full rounded-lg border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-graphite/60 focus:border-ink focus:ring-1 focus:ring-ink min-h-[48px]";

