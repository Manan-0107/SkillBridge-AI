"use client";

import React, { useMemo } from "react";
import { useApp } from "@/lib/store";
import { roleOptions } from "@/lib/data";
import { RoleId } from "@/lib/types";

interface CareerContextPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSendPrompt: (prompt: string) => void;
  onNavigate: (feature: "resume" | "roadmap" | "practice" | "local" | "courses", tab?: string) => void;
}

export function CareerContextPanel({
  isOpen,
  onClose,
  onSendPrompt,
  onNavigate,
}: CareerContextPanelProps) {
  const { user, userSkills, missingSkills, setTargetRole } = useApp();
  const currentRole = (user?.targetRole || "frontend") as RoleId;

  // Compute Career Readiness score based on verified skills and gaps
  const readinessStats = useMemo(() => {
    const verifiedCount = userSkills.length || 6;
    const gapCount = missingSkills.length || 3;
    const totalCount = verifiedCount + gapCount;
    const percent = Math.min(100, Math.round((verifiedCount / totalCount) * 100));

    return {
      percent,
      verifiedCount,
      gapCount,
      totalCount,
    };
  }, [userSkills, missingSkills]);

  // Default skill gaps if not populated
  const displayGaps = useMemo(() => {
    if (missingSkills && missingSkills.length > 0) {
      return missingSkills.slice(0, 5);
    }
    if (currentRole === "frontend") {
      return ["TypeScript & Generics", "React 19 & Server Components", "Core Web Vitals"];
    }
    if (currentRole === "backend") {
      return ["Distributed Caching (Redis)", "Database Indexing & Locks", "gRPC & Protobuf"];
    }
    if (currentRole === "devops") {
      return ["Kubernetes Helm Charts", "Terraform Infrastructure as Code", "CI/CD Security Scanning"];
    }
    return ["System Architecture", "Performance Optimization", "Automated Testing"];
  }, [missingSkills, currentRole]);

  return (
    <aside
      aria-label="Career Context and Skill Gap Co-Pilot"
      className={`flex flex-col border-l border-ink/10 bg-surface/98 backdrop-blur-xl text-ink transition-all duration-200 z-20 ${
        isOpen ? "w-80 sm:w-88 shrink-0" : "w-0 translate-x-full overflow-hidden border-none"
      }`}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-ink/8 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-1.5 w-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true" />
          <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-ink">
            Career Context
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close career context panel"
          className="rounded-full p-1 text-ink/40 hover:text-ink transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable Content (Section 2 & 16: Open space, minimal containers) */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* 1. Target Track Selector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-ink/50 uppercase tracking-wider">
              Target Track
            </span>
            <span className="text-[10px] font-medium text-accent">
              Active Focus
            </span>
          </div>

          <label htmlFor="context-role-select" className="sr-only">
            Select target career track
          </label>
          <select
            id="context-role-select"
            value={currentRole}
            onChange={(e) => setTargetRole(e.target.value as RoleId)}
            className="w-full rounded-xl border border-ink/12 bg-surface px-3 py-2 text-xs font-medium text-ink focus:border-accent/40 focus:outline-none transition-colors cursor-pointer"
          >
            {roleOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Readiness Stats (Typography & hairline meter) */}
        <div className="space-y-2 pt-1 border-t border-ink/8">
          <div className="flex items-baseline justify-between pt-2">
            <span className="text-[10px] font-medium text-ink/50 uppercase tracking-wider">
              Readiness Benchmark
            </span>
            <span className="font-display text-xl font-semibold text-ink">
              {readinessStats.percent}%
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={readinessStats.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Career readiness score: ${readinessStats.percent}%`}
            className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10"
          >
            <div
              className="h-full bg-accent transition-all duration-500 rounded-full"
              style={{ width: `${readinessStats.percent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-ink/45 pt-0.5 font-sans">
            <span>{readinessStats.verifiedCount} Verified</span>
            <span>{readinessStats.gapCount} Identified Gaps</span>
          </div>
        </div>

        {/* 3. Skill Gap Analysis (Clean Typographic List, No Heavy Boxes) */}
        <div className="space-y-3 pt-2 border-t border-ink/8">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-medium text-ink/50 uppercase tracking-wider">
              Identified Skill Gaps
            </h3>
            <button
              type="button"
              onClick={() => onNavigate("roadmap")}
              className="text-[10px] font-medium text-accent hover:underline cursor-pointer"
            >
              Roadmap &rarr;
            </button>
          </div>

          <div className="divide-y divide-ink/8">
            {displayGaps.map((gap, index) => (
              <div
                key={index}
                className="py-2.5 first:pt-0 last:pb-0 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-ink truncate">
                    {gap}
                  </span>
                  <span className="text-[9px] font-semibold text-accent/80 shrink-0">
                    High Impact
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSendPrompt(`Explain ${gap} step-by-step with practical production examples for my role.`)}
                    className="rounded-lg border border-ink/10 bg-transparent px-2.5 py-1 text-[10px] font-medium text-ink/70 hover:text-ink hover:border-accent/35 transition-colors cursor-pointer"
                  >
                    Teach Me
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate("practice")}
                    className="rounded-lg border border-ink/10 bg-transparent px-2.5 py-1 text-[10px] font-medium text-ink/70 hover:text-ink hover:border-accent/35 transition-colors cursor-pointer"
                  >
                    Drill Concept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Connected Ecosystem Quick Actions */}
        <div className="space-y-2 pt-3 border-t border-ink/8">
          <h3 className="text-[10px] font-medium text-ink/50 uppercase tracking-wider">
            Workspace Ecosystem
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "roadmap", label: "Roadmap", desc: "Skill graph" },
              { id: "practice", label: "Practice", desc: "Interview drills" },
              { id: "resume", label: "Resume ATS", desc: "Targeted audit" },
              { id: "local", label: "Opportunities", desc: "Live matches" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id as any)}
                className="rounded-xl border border-ink/10 bg-surface/50 p-2.5 text-left hover:border-accent/30 hover:bg-surface transition-all cursor-pointer group"
              >
                <div className="text-[11px] font-semibold text-ink group-hover:text-accent transition-colors">
                  {item.label}
                </div>
                <div className="text-[10px] text-ink/45 mt-0.5">
                  {item.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 5. Recommended Conversational Prompts */}
        <div className="space-y-1.5 pt-3 border-t border-ink/8">
          <span className="text-[10px] font-medium uppercase tracking-wider text-ink/50">
            Suggested Queries
          </span>
          {[
            { label: "What should I learn next?", query: "What should I learn next based on my current career roadmap?" },
            { label: "Break down my skill gaps", query: "Break down my top skill gaps and how to address each one." },
            { label: "Frame experience with STAR", query: "How do I frame my technical experience using the STAR method for interviews?" },
          ].map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSendPrompt(item.query)}
              className="w-full text-left rounded-lg px-2 py-1.5 text-xs text-ink/65 hover:text-ink hover:bg-surface/40 transition-colors cursor-pointer"
            >
              &bull; {item.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
