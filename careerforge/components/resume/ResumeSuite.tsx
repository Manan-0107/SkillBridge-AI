"use client";

import { useEffect, useState } from "react";
import { Section } from "@/components/ui/Section";
import { RoleId } from "@/lib/types";
import { Analyzer } from "./Analyzer";
import { Personalizer } from "./Personalizer";
import { Builder } from "./Builder";
import { ScanText, Wand2, FileEdit } from "lucide-react";

const tabs = [
  { id: "analyzer", label: "Analyzer", icon: <ScanText size={13} strokeWidth={2} />, desc: "ATS score & gaps" },
  { id: "personalizer", label: "Personalizer", icon: <Wand2 size={13} strokeWidth={2} />, desc: "Tailor to role" },
  { id: "builder", label: "Builder", icon: <FileEdit size={13} strokeWidth={2} />, desc: "Build from scratch" },
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
  const [injectedSummary, setInjectedSummary] = useState<string | null>(null);

  useEffect(() => {
    setActive(initialTab);
  }, [initialTab]);

  const handleTransferToBuilder = (tailoredSummary: string) => {
    setInjectedSummary(tailoredSummary);
    setActive("builder");
  };

  return (
    <Section
      id="resume"
      eyebrow="Resume Suite"
      title="Get your resume market-ready"
      description="Analyze against live market skills, tailor to your target role, or build from scratch."
    >
      {/* Tab bar */}
      <div
        className="mb-6 flex gap-1 rounded-xl border border-ink/10 bg-surface/50 p-1 sm:inline-flex"
        role="tablist"
        aria-label="Resume suite tabs"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={`flex items-center gap-2 flex-1 sm:flex-none rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
              active === t.id
                ? "bg-bg text-ink shadow-sm border border-ink/10"
                : "text-ink/55 hover:text-ink hover:bg-bg/50"
            }`}
          >
            <span aria-hidden="true" className={active === t.id ? "text-accent" : "text-ink/40"}>
              {t.icon}
            </span>
            <span>{t.label}</span>
            <span className={`hidden sm:inline text-[10px] font-normal ${active === t.id ? "text-ink/50" : "text-ink/35"}`}>
              {t.desc}
            </span>
          </button>
        ))}
      </div>

      {active === "analyzer" && <Analyzer role={role} />}
      {active === "personalizer" && (
        <Personalizer role={role} onTransferToBuilder={handleTransferToBuilder} />
      )}
      {active === "builder" && <Builder initialSummary={injectedSummary || undefined} />}
    </Section>
  );
}
