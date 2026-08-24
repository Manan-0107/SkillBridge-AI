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
      <div className="mx-auto max-w-content px-6">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite">
            {eyebrow}
          </p>
          <h2 className="mt-3 font-display text-3xl italic text-ink md:text-4xl">
            {title}
          </h2>
          {description && (
            <p className="mt-3 text-[15px] leading-relaxed text-graphite">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
