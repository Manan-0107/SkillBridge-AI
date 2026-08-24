import { Section } from "@/components/ui/Section";
import { Card } from "@/components/ui/Primitives";

const tools = [
  {
    name: "Codédex",
    role: "Primary recommendation",
    description: "Gamified, quest-based coding practice with visual progression — best starting point.",
    url: "https://www.codedex.io/",
  },
  {
    name: "Codepip",
    role: "Secondary option",
    description: "Bite-sized coding games that build specific skills fast — good for focused drills.",
    url: "https://codepip.com/",
  },
];

export function PracticeHub() {
  return (
    <Section
      id="practice"
      eyebrow="Practice Hub"
      title="Practice like it's a game"
      description="Quick-launch into gamified practice environments — no setup required."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {tools.map((tool) => (
          <a key={tool.name} href={tool.url} target="_blank" rel="noopener noreferrer">
            <Card className="h-full transition-colors hover:border-ink">
              <p className="text-xs font-medium uppercase tracking-wide text-graphite">
                {tool.role}
              </p>
              <p className="mt-2 font-display text-xl italic text-ink">{tool.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-graphite">
                {tool.description}
              </p>
              <p className="mt-4 text-xs font-medium text-ink underline decoration-line underline-offset-4">
                Launch →
              </p>
            </Card>
          </a>
        ))}
      </div>
    </Section>
  );
}
