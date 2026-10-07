"use client";

import React, { useState } from "react";
import type { NormalizedJob, ExplainableMatchResult } from "@/lib/career/types";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Bookmark,
  BookmarkCheck,
  Sparkles,
} from "lucide-react";
import { InterviewStudio } from "@/components/career/InterviewStudio";
import { UbixApplyModal } from "@/components/career/UbixApplyModal";

interface JobIntelligenceModalProps {
  job: NormalizedJob;
  matchResult: ExplainableMatchResult | null;
  onClose: () => void;
  onSaveJob?: (job: NormalizedJob, match: ExplainableMatchResult | null) => void;
  isSaved?: boolean;
}

export function JobIntelligenceModal({
  job,
  matchResult,
  onClose,
  onSaveJob,
  isSaved = false,
}: JobIntelligenceModalProps) {
  const [activeTab, setActiveTab] = useState<"match" | "gaps" | "readiness" | "details">("match");
  const [savedState, setSavedState] = useState(isSaved);
  const [showInterviewStudio, setShowInterviewStudio] = useState(false);
  const [showUbixApply, setShowUbixApply] = useState(false);

  const handleToggleSave = () => {
    setSavedState(!savedState);
    if (onSaveJob) {
      onSaveJob(job, matchResult);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-surface-elevated shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-white/10 p-5 sm:p-6 flex items-start justify-between bg-surface/40">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-mono text-ink/70">
                {job.workArrangementLabel || (job.remote ? "Remote" : "On-site")}
              </span>
              <span className="rounded-full border border-accent/20 bg-accent/10 px-2.5 py-0.5 text-[10px] font-mono text-accent">
                {job.source}
              </span>
            </div>
            <h2 id="job-dialog-title" className="text-xl sm:text-2xl font-bold text-white">
              {job.title}
            </h2>
            <p className="text-sm text-ink/70 mt-0.5">
              <span className="font-semibold text-white/90">{job.company}</span> · {job.location}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSave}
              aria-label={savedState ? "Remove from saved jobs" : "Save this job"}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                savedState
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-white/10 bg-white/5 text-ink/70 hover:text-white hover:border-white/20"
              }`}
            >
              {savedState ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details dialog"
              className="p-2 rounded-xl border border-white/10 bg-white/5 text-ink/70 hover:text-white hover:border-white/20 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div role="tablist" aria-label="Job Intelligence Sections" className="flex border-b border-white/10 bg-surface/20 px-6 gap-6 text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            role="tab"
            onClick={() => setActiveTab("match")}
            aria-selected={activeTab === "match"}
            className={`py-3 transition-colors relative cursor-pointer ${
              activeTab === "match" ? "text-accent border-b-2 border-accent" : "text-ink/60 hover:text-ink"
            }`}
          >
            Explainable Match
          </button>
          <button
            type="button"
            role="tab"
            onClick={() => setActiveTab("gaps")}
            aria-selected={activeTab === "gaps"}
            className={`py-3 transition-colors relative cursor-pointer ${
              activeTab === "gaps" ? "text-accent border-b-2 border-accent" : "text-ink/60 hover:text-ink"
            }`}
          >
            Skill Gaps &amp; Actions ({matchResult?.skillGaps.length || 0})
          </button>
          <button
            type="button"
            role="tab"
            onClick={() => setActiveTab("readiness")}
            aria-selected={activeTab === "readiness"}
            className={`py-3 transition-colors relative cursor-pointer ${
              activeTab === "readiness" ? "text-accent border-b-2 border-accent" : "text-ink/60 hover:text-ink"
            }`}
          >
            Application Readiness
          </button>
          <button
            type="button"
            role="tab"
            onClick={() => setActiveTab("details")}
            aria-selected={activeTab === "details"}
            className={`py-3 transition-colors relative cursor-pointer ${
              activeTab === "details" ? "text-accent border-b-2 border-accent" : "text-ink/60 hover:text-ink"
            }`}
          >
            Original Posting &amp; Info
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {activeTab === "match" && (
            <div className="space-y-6">
              {/* Why Summary Banner */}
              {matchResult?.whyExplanation && (
                <div className="rounded-xl border border-accent/25 bg-accent/5 p-4 text-xs leading-relaxed text-ink/90">
                  <div className="flex items-center gap-1.5 font-bold text-accent mb-1 uppercase tracking-wider text-[10px]">
                    <Sparkles size={13} />
                    <span>Why This Matches</span>
                  </div>
                  <p>{matchResult.whyExplanation}</p>
                </div>
              )}

              {/* Version & Provenance Info */}
              <div className="flex flex-wrap items-center justify-between text-[11px] text-ink/50 bg-white/[0.02] p-2.5 rounded-lg border border-white/5 font-mono">
                <span>Analyzed using: {matchResult?.resumeVersionUsed || "Active Resume"}</span>
                <span>{matchResult?.provenanceNotice || "Provenance: Verified Source"}</span>
              </div>

              {/* Requirement Dimensions */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
                  Detailed Requirement Evidence
                </h3>
                <div className="space-y-2.5">
                  {matchResult?.dimensions.map((dim) => {
                    const isMatched = dim.status === "MATCHED";
                    const isPartial = dim.status === "PARTIAL";
                    const isGap = dim.status === "EVIDENCE_GAP";
                    const isMissing = dim.status === "MISSING";

                    return (
                      <div
                        key={dim.requirement.id}
                        className="rounded-xl border border-white/5 bg-surface/30 p-3.5 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-medium text-white/90 text-xs">
                            {dim.requirement.text}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 uppercase tracking-wider ${
                              isMatched
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : isPartial
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : isGap
                                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                                : isMissing
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-white/5 text-ink/50 border border-white/10"
                            }`}
                          >
                            {dim.status.replace("_", " ")}
                          </span>
                        </div>

                        {dim.evidence && (
                          <div className="text-xs text-emerald-300/80 bg-emerald-950/20 p-2 rounded-lg border border-emerald-500/15">
                            <span className="font-semibold text-emerald-400">Your Resume Evidence: </span>
                            {dim.evidence}
                          </div>
                        )}

                        {dim.reason && !dim.evidence && (
                          <div className="text-xs text-ink/60 italic">
                            {dim.reason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "gaps" && (
            <div className="space-y-4">
              <p className="text-xs text-ink/60">
                Identified skill and evidence gaps based on the employer requirements. Use these recommendations to target your learning or clarify omitted resume points before applying.
              </p>

              {matchResult?.skillGaps.length === 0 ? (
                <div className="p-6 text-center text-xs text-emerald-400 bg-emerald-950/10 rounded-xl border border-emerald-500/20">
                  <CheckCircle2 size={24} className="mx-auto mb-2" />
                  No critical skill gaps identified for this role!
                </div>
              ) : (
                <div className="space-y-3">
                  {matchResult?.skillGaps.map((gap, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-white/10 bg-surface/30 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">{gap.skill}</span>
                        <span className="text-[10px] font-mono text-ink/50 uppercase">
                          {gap.importance} · {gap.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-accent/90 bg-accent/5 p-2.5 rounded-lg border border-accent/15 leading-relaxed">
                        {gap.actionRecommendation}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "readiness" && (
            <div className="space-y-5">
              <div className="rounded-xl border border-white/10 bg-surface/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                    Application Readiness Assessment
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                      matchResult?.applicationReadiness.isReady
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {matchResult?.applicationReadiness.isReady ? "Ready to Prepare" : "Gaps to Address"}
                  </span>
                </div>
                <p className="text-xs text-ink/70">
                  {matchResult?.applicationReadiness.scoreExplanation}
                </p>
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-ink/60 uppercase tracking-wider">
                  Preparation Checklist
                </h4>
                {matchResult?.applicationReadiness.checks.map((chk) => (
                  <div
                    key={chk.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-white/5 bg-surface/20"
                  >
                    {chk.status === "ready" ? (
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    ) : chk.status === "needs_attention" ? (
                      <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <HelpCircle size={16} className="text-ink/40 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-white/90">{chk.label}</p>
                      <p className="text-[11px] text-ink/60 mt-0.5">{chk.details}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Steps */}
              {matchResult?.applicationReadiness.preparationSteps && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-ink/60 uppercase tracking-wider">
                    Recommended Steps
                  </h4>
                  <ul className="space-y-1.5 list-disc list-inside text-xs text-ink/80 bg-surface/20 p-3.5 rounded-lg border border-white/5">
                    {matchResult.applicationReadiness.preparationSteps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === "details" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-surface/30 p-4 space-y-3">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                  Employer Provided Description
                </h3>
                <p className="text-xs leading-relaxed text-ink/80 whitespace-pre-wrap">
                  {job.rawDescription || job.description}
                </p>
              </div>

              {/* Accessibility Profile */}
              <div className="rounded-xl border border-white/10 bg-surface/30 p-4 space-y-2">
                <div className="flex items-center gap-2 font-bold text-white text-xs uppercase tracking-wider">
                  <ShieldCheck size={14} className="text-accent" />
                  <span>Accessibility Information</span>
                </div>
                <p className="text-xs text-ink/70">
                  {job.accessibility?.screenReaderReady
                    ? "Screen reader compatibility verified from source feed."
                    : "Accessibility information not explicitly provided by employer source."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 bg-surface/40">
          <span className="text-[11px] text-ink/40 font-mono">
            Phase 6 Decision Support · User Controls All Actions
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowInterviewStudio(true)}
              className="rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2 text-xs font-bold text-accent hover:bg-accent/20 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles size={13} />
              <span>Prepare for Interview</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch("/api/applications", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "create",
                      job,
                      lastMatchResult: matchResult,
                    }),
                  });
                  alert("Job added to Application Tracker!");
                } catch {
                  alert("Unable to track application right now.");
                }
              }}
              className="rounded-xl border border-white/20 bg-surface px-3.5 py-2 text-xs font-semibold text-white hover:border-accent hover:text-accent transition-colors cursor-pointer"
            >
              Track in Applications
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-ink/70 hover:text-white transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => setShowUbixApply(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-bg hover:bg-accent/90 transition-colors cursor-pointer"
            >
              <ShieldCheck size={13} aria-hidden="true" />
              <span>Review & Apply with UBIX</span>
            </button>
            <a
              href={job.applyUrl || job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-surface px-4 py-2 text-xs font-semibold text-white hover:border-accent hover:text-accent transition-colors cursor-pointer"
            >
              <span>Employer Posting</span>
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      {showUbixApply && (
        <UbixApplyModal
          job={job}
          onClose={() => setShowUbixApply(false)}
          onApplicationSubmitted={() => {
            setShowUbixApply(false);
            setSavedState(true);
          }}
        />
      )}

      {showInterviewStudio && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl border border-white/10 bg-surface-elevated p-6 shadow-2xl">
            <InterviewStudio job={job} onClose={() => setShowInterviewStudio(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
