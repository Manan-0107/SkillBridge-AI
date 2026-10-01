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
      className={`rounded-xl border border-line bg-surface backdrop-blur-sm shadow-glass p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-graphite tracking-wide">
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
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-[#0A0C0F] transition-all hover:brightness-110 hover:shadow-glow-accent disabled:cursor-not-allowed disabled:opacity-40 active:scale-95 ${className}`}
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
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface/60 px-5 py-2.5 text-sm font-medium text-ink transition-all hover:border-accent/40 hover:bg-surfaceHover hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 active:scale-95 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-graphite">
      {children}
    </label>
  );
}

export const inputClasses =
  "w-full rounded-lg border border-line bg-mist px-3.5 py-2.5 text-sm text-ink placeholder:text-graphite/60 focus:border-accent/60 focus:bg-surfaceHover focus:outline-none transition-colors";
