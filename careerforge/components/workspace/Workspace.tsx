"use client";

import { FeatureId, ResumeTab } from "@/lib/intent";
import { RoleId } from "@/lib/types";
import { ResumeSuite } from "@/components/resume/ResumeSuite";
import { CareerRoadmap } from "@/components/roadmap/CareerRoadmap";
import { CourseCards } from "@/components/courses/CourseCards";
import { PracticeHub } from "@/components/practice/PracticeHub";
import { LocalOpportunities } from "@/components/local/LocalOpportunities";
import { roleOptions } from "@/lib/data";
import { useApp } from "@/lib/store";

const copy: Record<FeatureId, { eyebrow: string; title: string }> = {
  resume: { eyebrow: "Resume", title: "Resume suite" },
  roadmap: { eyebrow: "Path", title: "Career roadmap" },
  courses: { eyebrow: "Learn", title: "Curated courses" },
  practice: { eyebrow: "Drill", title: "Practice hub" },
  local: { eyebrow: "Nearby", title: "Local opportunities" },
};

export function Workspace({
  feature,
  resumeTab,
}: {
  feature: FeatureId;
  resumeTab?: ResumeTab;
}) {
  const { user, setTargetRole } = useApp();
  const role: RoleId =
    user?.targetRole && roleOptions.some((r) => r.id === user.targetRole)
      ? (user.targetRole as RoleId)
      : "frontend";
  const heading = copy[feature];

  return (
    <div className="min-h-[calc(100vh-4.25rem)] bg-bg text-ink">
      <div className="border-b border-ink/10 py-8 sm:py-10 bg-surface/60 backdrop-blur-md">
        <div className="app-shell flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span>{heading.eyebrow}</span>
            </div>
            <h1 className="font-sans text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              {heading.title}
            </h1>
          </div>
          <label className="flex items-center gap-2.5 rounded-2xl border border-ink/15 bg-surface px-3.5 py-2 text-xs font-medium text-ink shadow-sm">
            <span className="text-ink/70">Target Track:</span>
            <select
              value={role}
              onChange={(e) => setTargetRole(e.target.value as RoleId)}
              className="rounded-lg border border-ink/15 bg-bg px-2.5 py-1 text-xs font-semibold text-accent focus:border-accent focus:outline-none cursor-pointer"
            >
              {roleOptions.map((r) => (
                <option key={r.id} value={r.id} className="bg-surface text-ink">
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {feature === "resume" && (
        <ResumeSuite role={role} initialTab={resumeTab ?? "analyzer"} />
      )}
      {feature === "roadmap" && <CareerRoadmap role={role} />}
      {feature === "courses" && <CourseCards role={role} />}
      {feature === "practice" && <PracticeHub />}
      {feature === "local" && <LocalOpportunities />}
    </div>
  );
}
