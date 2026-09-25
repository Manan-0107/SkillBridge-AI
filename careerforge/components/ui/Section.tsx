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
    <section id={id} className="scroll-mt-24 py-16 md:py-24">
      <div className="app-shell">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
            {eyebrow}
          </p>
          <h2 className="mt-3 font-sans text-3xl font-bold tracking-tight text-ink md:text-4xl">
            {title}
          </h2>
          {description && (
            <p className="mt-3 text-[15px] leading-relaxed text-ink/75">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
