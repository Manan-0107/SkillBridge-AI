"use client";

import { useEffect, useState } from "react";
import { Section } from "@/components/ui/Section";
import { RoleId } from "@/lib/types";
import { Analyzer } from "./Analyzer";
import { Personalizer } from "./Personalizer";
import { Builder } from "./Builder";

const tabs = [
  { id: "analyzer", label: "Analyzer" },
  { id: "personalizer", label: "Personalizer" },
  { id: "builder", label: "Builder" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function ResumeSuite({
  role,
  initialTab = "analyzer",
}: {
  role: RoleId;
  initialTab?: TabId;
}) {
  const [active, setActive] = useState<TabId>(initialTab);

  useEffect(() => {
    setActive(initialTab);
  }, [initialTab]);

  return (
    <Section
      id="resume"
      eyebrow="Resume Suite"
      title="Get your resume market-ready"
      description="Analyze it against live market skills, tailor it to your target role, or build one from scratch."
    >
      <div className="mb-8 flex gap-1 rounded-md border border-line p-1 sm:inline-flex">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`flex-1 rounded px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
              active === t.id ? "bg-ink text-paper" : "text-graphite hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "analyzer" && <Analyzer role={role} />}
      {active === "personalizer" && <Personalizer role={role} />}
      {active === "builder" && <Builder />}
    </Section>
  );
}
