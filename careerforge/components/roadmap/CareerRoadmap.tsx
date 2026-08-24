import { Section } from "@/components/ui/Section";
import { roadmaps, roleOptions } from "@/lib/data";
import { RoleId } from "@/lib/types";
import { Tag } from "@/components/ui/Primitives";

export function CareerRoadmap({ role }: { role: RoleId }) {
  const steps = roadmaps[role];
  const roleLabel = roleOptions.find((r) => r.id === role)?.label ?? "";

  return (
    <Section
      id="roadmap"
      eyebrow="Career Roadmap"
      title={`Your path to ${roleLabel}`}
      description="Ordered stages — each one builds on the last. Move at your own pace."
    >
      <ol className="relative">
        {steps.map((step, i) => (
          <li key={step.title} className="relative flex gap-5 pb-10 last:pb-0">
            {i < steps.length - 1 && (
              <span className="step-line absolute left-[15px] top-8 h-full w-px" />
            )}
            <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink bg-paper text-xs font-medium text-ink">
              {i + 1}
            </span>
            <div className="pb-2">
              <p className="text-base font-semibold text-ink">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-graphite">{step.detail}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {step.skills.map((s) => (
                  <Tag key={s}>{s}</Tag>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
