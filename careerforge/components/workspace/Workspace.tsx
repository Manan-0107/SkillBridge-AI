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
    <div className="min-h-[calc(100vh-3rem)] bg-bg text-ink selection:bg-surface relative">

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
