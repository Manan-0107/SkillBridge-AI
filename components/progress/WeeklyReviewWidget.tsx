"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Award,
  Send,
  MessageSquare,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import type { WeeklyCareerReport } from "@/lib/career/weeklyReview";

export function WeeklyReviewWidget() {
  const [report, setReport] = useState<WeeklyCareerReport | null>(null);
  const [hasActivity, setHasActivity] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeeklyReview();
  }, []);

  const loadWeeklyReview = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/career/weekly-review");
      if (res.ok) {
        const data = await res.json();
        setReport(data.report);
        setHasActivity(Boolean(data.hasActivity));
      }
    } catch (err) {
      console.error("[WeeklyReviewWidget] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl border border-white/10 bg-surface/40 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-md bg-accent/10 border border-accent/20 text-accent">
              <Calendar size={15} aria-hidden="true" />
            </span>
            <span className="font-mono text-xs uppercase tracking-wider text-accent font-semibold">
              Weekly Factual Review
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white">
            7-Day Career Progress Summary
          </h2>
          <p className="text-xs text-ink/60 mt-0.5">
            Strict factual audit of verified skills gained, practice drills completed, and outbound applications.
          </p>
        </div>

        <button
          type="button"
          onClick={loadWeeklyReview}
          aria-label="Refresh weekly review"
          className="p-2 rounded-xl border border-white/10 bg-surface text-ink/70 hover:text-white transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-ink/50">
          Auditing last 7 days of verified activity...
        </div>
      ) : !hasActivity ? (
        <div className="p-8 rounded-2xl border border-white/10 bg-surface/20 text-center space-y-2">
          <Calendar size={28} className="mx-auto text-ink/30" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-white">No activity recorded yet.</h3>
          <p className="text-xs text-ink/50 max-w-md mx-auto">
            Complete a practice challenge, verify a skill in your wallet, or submit an application to start building your longitudinal record.
          </p>
        </div>
      ) : report && (
        <div className="space-y-5">
          {/* Factual Achievements Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-surface border border-white/10 space-y-1">
              <span className="text-[10px] font-mono text-ink/50 uppercase block">Skills Gained</span>
              <span className="font-display text-xl font-bold text-emerald-400">
                {report.confirmedFacts.skillsGained.length}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface border border-white/10 space-y-1">
              <span className="text-[10px] font-mono text-ink/50 uppercase block">Practice Drills</span>
              <span className="font-display text-xl font-bold text-accent">
                {report.confirmedFacts.practiceSessionsCompleted}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface border border-white/10 space-y-1">
              <span className="text-[10px] font-mono text-ink/50 uppercase block">Applications</span>
              <span className="font-display text-xl font-bold text-blue-400">
                {report.confirmedFacts.applicationsSubmitted.length}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface border border-white/10 space-y-1">
              <span className="text-[10px] font-mono text-ink/50 uppercase block">Interviews</span>
              <span className="font-display text-xl font-bold text-purple-400">
                {report.confirmedFacts.interviewsCompleted}
              </span>
            </div>
          </div>

          {/* Blockers */}
          {report.unresolvedBlockers.length > 0 && (
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                <AlertCircle size={14} aria-hidden="true" />
                <span>Identified Career Blockers</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-ink/80">
                {report.unresolvedBlockers.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Proposed Focus for Next Week */}
          <div className="space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-ink/70 font-semibold">
              Proposed Next Week Priorities
            </h3>
            <div className="space-y-2">
              {report.proposedNextWeekPriorities.map((p) => (
                <div
                  key={p.priority}
                  className="p-3.5 rounded-xl border border-white/5 bg-surface/30 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-white">{p.action}</span>
                    <p className="text-ink/60 text-[11px]">{p.rationale}</p>
                  </div>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-ink/50 shrink-0">
                    ~{p.estimatedHours}h
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
