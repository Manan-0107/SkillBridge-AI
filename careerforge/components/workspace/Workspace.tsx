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
import { Bot, Map, Code2, FileText, Briefcase, BookOpen, ChevronDown } from "lucide-react";

const featureMeta: Record<FeatureId, {
  icon: React.ReactNode;
  label: string;
  description: string;
}> = {
  resume: {
    icon: <FileText size={16} strokeWidth={2} />,
    label: "Resume Suite",
    description: "Build, analyze, and tailor your resume for any role",
  },
  roadmap: {
    icon: <Map size={16} strokeWidth={2} />,
    label: "Career Roadmap",
    description: "Phased skill milestones from beginner to role-ready",
  },
  courses: {
    icon: <BookOpen size={16} strokeWidth={2} />,
    label: "Curated Learning",
    description: "Curated courses, books, and certifications for your track",
  },
  practice: {
    icon: <Code2 size={16} strokeWidth={2} />,
    label: "Technical Practice",
    description: "Interactive coding drills and mock interview prep",
  },
  local: {
    icon: <Briefcase size={16} strokeWidth={2} />,
    label: "Job Discovery",
    description: "Live openings, remote positions, and real-time alerts",
  },
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

  const meta = featureMeta[feature];

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-bg text-ink">
      {/* Slim workspace header */}
      <div className="border-b border-ink/8 bg-bg/98">
        <div className="app-shell flex items-center justify-between h-14 gap-4">
          {/* Left: feature identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface border border-ink/10 text-ink/60"
              aria-hidden="true"
            >
              {meta.icon}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-ink tracking-tight truncate">
                {meta.label}
              </h1>
              <p className="text-[11px] text-ink/50 truncate hidden sm:block">
                {meta.description}
              </p>
            </div>
          </div>

          {/* Right: role selector */}
          <label className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-medium text-ink/50 hidden sm:inline">Track:</span>
            <div className="relative flex items-center">
              <select
                value={role}
                onChange={(e) => setTargetRole(e.target.value as RoleId)}
                className="appearance-none rounded-full border border-ink/12 bg-surface/80 pl-3 pr-7 py-1.5 text-xs font-semibold text-ink focus:border-accent focus:outline-none cursor-pointer transition-colors hover:border-ink/25"
                aria-label="Target career track"
              >
                {roleOptions.map((r) => (
                  <option key={r.id} value={r.id} className="bg-bg text-ink">
                    {r.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={11}
                strokeWidth={2.5}
                className="pointer-events-none absolute right-2.5 text-ink/40"
                aria-hidden="true"
              />
            </div>
          </label>
        </div>
      </div>

      {/* Feature content */}
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
