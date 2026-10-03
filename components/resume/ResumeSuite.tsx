"use client";

import { useEffect, useState } from "react";
import { Section } from "@/components/ui/Section";
import { RoleId } from "@/lib/types";
import { Analyzer } from "./Analyzer";
import { Personalizer } from "./Personalizer";
import { Builder } from "./Builder";
import { ScanText, Wand2, FileEdit } from "lucide-react";

import { CanonicalResume } from "@/lib/resume/structuredParser";

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
  const [injectedResume, setInjectedResume] = useState<CanonicalResume | null>(null);

  useEffect(() => {
    setActive(initialTab);
  }, [initialTab]);

  const handleTransferToBuilder = (tailoredSummary: string) => {
    setInjectedSummary(tailoredSummary);
    setActive("builder");
  };

  const handleTransferResumeToBuilder = (structured: CanonicalResume) => {
    setInjectedResume(structured);
    setActive("builder");
  };

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 animate-slideUp">
      <div className="mb-8 space-y-2">
        <span className="font-display text-xs uppercase tracking-[0.24em] text-ink/60 font-semibold select-none">
          ubix
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Resume
        </h1>
        <p className="text-sm text-ink/60">
          Document studio for live tailoring, ATS analysis, and instant export.
        </p>
      </div>

      {/* Document Studio Mode Tabs */}
      <div
        className="mb-8 flex gap-1 rounded-2xl border border-white/10 bg-surface/60 p-1.5 sm:inline-flex"
        role="tablist"
        aria-label="Resume suite tabs"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={`flex items-center gap-2 flex-1 sm:flex-none rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
              active === t.id
                ? "bg-surface text-white shadow-xs border border-white/15"
                : "text-ink/60 hover:text-white hover:bg-surface/40"
            }`}
          >
            <span aria-hidden="true" className={active === t.id ? "text-accent" : "text-ink/40"}>
              {t.icon}
            </span>
            <span>{t.label}</span>
            <span className={`hidden sm:inline text-[10px] font-normal ${active === t.id ? "text-ink/60" : "text-ink/40"}`}>
              {t.desc}
            </span>
          </button>
        ))}
      </div>

      {active === "analyzer" && (
        <Analyzer
          role={role}
          onTransferToBuilder={handleTransferResumeToBuilder}
        />
      )}
      {active === "personalizer" && (
        <Personalizer role={role} onTransferToBuilder={handleTransferToBuilder} />
      )}
      {active === "builder" && (
        <Builder
          initialSummary={injectedSummary || undefined}
          initialResume={injectedResume || undefined}
        />
      )}
    </div>
  );
}
