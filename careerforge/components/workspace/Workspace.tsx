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
  const role: RoleId = user?.targetRole ?? "frontend";
  const heading = copy[feature];

  return (
    <div className="min-h-[calc(100vh-4.25rem)]">
      <div className="border-b border-line py-10">
        <div className="mx-auto flex max-w-content flex-col gap-4 px-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite">
              {heading.eyebrow}
            </p>
            <h1 className="mt-2 font-display text-3xl italic text-ink md:text-4xl">
              {heading.title}
            </h1>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-graphite">
            Target role
            <select
              value={role}
              onChange={(e) => setTargetRole(e.target.value as RoleId)}
              className="rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink"
            >
              {roleOptions.map((r) => (
                <option key={r.id} value={r.id}>
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
