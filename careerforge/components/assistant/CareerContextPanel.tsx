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
      className={`flex flex-col border-l border-ink/10 bg-surface/95 backdrop-blur-md text-ink transition-all duration-200 z-20 ${
        isOpen ? "w-80 sm:w-88 shrink-0" : "w-0 translate-x-full overflow-hidden border-none"
      }`}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-ink/10 p-3.5 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink">
            Career Context
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close career context panel"
          className="rounded-lg p-1 text-ink/60 hover:bg-bg hover:text-ink transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* 1. Target Role & Switcher */}
        <div className="rounded-xl border border-ink/15 bg-bg p-3.5 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink/60 uppercase tracking-wide">
              Target Track
            </span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-accent border border-ink/10">
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
            className="w-full rounded-lg border border-ink/15 bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink focus:border-accent focus:outline-none cursor-pointer"
          >
            {roleOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Career Readiness Meter */}
        <div className="rounded-xl border border-ink/15 bg-bg p-3.5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink/70">
              Readiness Score
            </span>
            <span className="font-mono text-xs font-bold text-ink">
              {readinessStats.percent}%
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={readinessStats.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Career readiness score: ${readinessStats.percent}%`}
            className="h-2 w-full overflow-hidden rounded-full bg-surface border border-ink/10"
          >
            <div
              className="h-full bg-success transition-all duration-500 rounded-full"
              style={{ width: `${readinessStats.percent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-ink/60 pt-0.5">
            <span>{readinessStats.verifiedCount} Skills Verified</span>
            <span>{readinessStats.gapCount} Skill Gaps</span>
          </div>
        </div>

        {/* 3. Skill Gap Analysis (High Priority) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wide">
              Identified Skill Gaps
            </h3>
            <button
              type="button"
              onClick={() => onNavigate("roadmap")}
              className="text-[11px] font-semibold text-accent hover:underline cursor-pointer"
            >
              View on Roadmap &rarr;
            </button>
          </div>

          <div className="space-y-2">
            {displayGaps.map((gap, index) => (
              <div
                key={index}
                className="rounded-lg border border-ink/15 bg-bg p-2.5 shadow-2xs space-y-1.5 transition-all hover:border-accent/40"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-ink truncate">
                    {gap}
                  </span>
                  <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold text-accent uppercase">
                    Priority
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pt-1 border-t border-ink/10">
                  <button
                    type="button"
                    onClick={() => onSendPrompt(`Explain ${gap} step-by-step with practical production examples for my role.`)}
                    className="flex-1 rounded border border-ink/15 bg-surface py-1 text-[10px] font-medium text-ink hover:text-accent hover:border-accent/40 transition-colors cursor-pointer text-center"
                  >
                    Teach Me
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate("practice")}
                    className="flex-1 rounded border border-ink/15 bg-surface py-1 text-[10px] font-medium text-ink hover:text-accent hover:border-accent/40 transition-colors cursor-pointer text-center"
                  >
                    Drill Concept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Connected Ecosystem Quick Actions */}
        <div className="space-y-2 pt-2 border-t border-ink/10">
          <h3 className="text-xs font-bold text-ink uppercase tracking-wide">
            Career Ecosystem
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onNavigate("roadmap")}
              className="rounded-lg border border-ink/15 bg-bg p-2.5 text-left hover:border-accent/40 hover:bg-surface transition-all cursor-pointer shadow-2xs group"
            >
              <div className="text-[11px] font-bold text-ink group-hover:text-accent">
                Roadmap
              </div>
              <div className="text-[10px] text-ink/60 mt-0.5">
                Visual career graph
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate("practice")}
              className="rounded-lg border border-ink/15 bg-bg p-2.5 text-left hover:border-accent/40 hover:bg-surface transition-all cursor-pointer shadow-2xs group"
            >
              <div className="text-[11px] font-bold text-ink group-hover:text-accent">
                Practice
              </div>
              <div className="text-[10px] text-ink/60 mt-0.5">
                Interview simulator
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate("resume", "analyzer")}
              className="rounded-lg border border-ink/15 bg-bg p-2.5 text-left hover:border-accent/40 hover:bg-surface transition-all cursor-pointer shadow-2xs group"
            >
              <div className="text-[11px] font-bold text-ink group-hover:text-accent">
                Resume ATS
              </div>
              <div className="text-[10px] text-ink/60 mt-0.5">
                Keyword audit
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate("local")}
              className="rounded-lg border border-ink/15 bg-bg p-2.5 text-left hover:border-accent/40 hover:bg-surface transition-all cursor-pointer shadow-2xs group"
            >
              <div className="text-[11px] font-bold text-ink group-hover:text-accent">
                Jobs
              </div>
              <div className="text-[10px] text-ink/60 mt-0.5">
                Matched opportunities
              </div>
            </button>
          </div>
        </div>

        {/* 5. Recommended Conversational Prompts */}
        <div className="space-y-1.5 pt-2 border-t border-ink/10">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink/60">
            Suggested Prompts
          </span>
          <button
            type="button"
            onClick={() => onSendPrompt("What should I learn next based on my current career roadmap?")}
            className="w-full text-left rounded-lg border border-ink/15 bg-bg px-2.5 py-1.5 text-xs text-ink/80 hover:text-accent hover:border-accent/30 hover:bg-surface transition-all cursor-pointer"
          >
            &bull; What should I learn next?
          </button>
          <button
            type="button"
            onClick={() => onSendPrompt("Break down my top skill gaps and how to address each one.")}
            className="w-full text-left rounded-lg border border-ink/15 bg-bg px-2.5 py-1.5 text-xs text-ink/80 hover:text-accent hover:border-accent/30 hover:bg-surface transition-all cursor-pointer"
          >
            &bull; Break down my skill gaps
          </button>
          <button
            type="button"
            onClick={() => onSendPrompt("How do I frame my technical experience using the STAR method for interviews?")}
            className="w-full text-left rounded-lg border border-ink/15 bg-bg px-2.5 py-1.5 text-xs text-ink/80 hover:text-accent hover:border-accent/30 hover:bg-surface transition-all cursor-pointer"
          >
            &bull; Frame experience with STAR
          </button>
        </div>
      </div>
    </aside>
  );
}
