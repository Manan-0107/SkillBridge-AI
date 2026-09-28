import { ReactNode } from "react";

export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-16 py-8 md:py-10">
      <div className="app-shell">
        <div className="mb-6 max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent/80">
            {eyebrow}
          </p>
          <h2 className="mt-1.5 font-sans text-2xl font-bold tracking-tight text-ink">
            {title}
          </h2>
          {description && (
            <p className="mt-1.5 text-sm leading-relaxed text-ink/55">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
