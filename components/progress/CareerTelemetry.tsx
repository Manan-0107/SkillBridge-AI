"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { roleOptions } from "@/lib/data";
import { RoleId } from "@/lib/types";
import {
  TrendingUp,
  Award,
  CheckCircle2,
  Check,
  Clock,
  Code2,
  FileText,
  Map,
  ArrowRight,
  ShieldCheck,
  Target,
  Sparkles,
  BarChart3,
  Layers,
} from "lucide-react";
import { CareerRecoveryBanner } from "./CareerRecoveryBanner";
import { DailyPlanWidget } from "./DailyPlanWidget";
import { CareerTwinWidget } from "./CareerTwinWidget";
import { WeeklyReviewWidget } from "./WeeklyReviewWidget";

export function CareerTelemetry() {
  const { user, userSkills, missingSkills } = useApp();

  const currentRole = useMemo(() => {
    return roleOptions.find((r) => r.id === user?.targetRole) || roleOptions[0];
  }, [user?.targetRole]);

  // Derived telemetry metrics
  const acquiredCount = userSkills?.length || 0;
  const missingCount = missingSkills?.length || 0;
  const totalTrackSkills = acquiredCount + missingCount || 1;
  const skillReadiness = Math.min(100, Math.round((acquiredCount / totalTrackSkills) * 100));

  // Telemetry milestones
  const milestones = [
    {
      id: "foundation",
      title: "Core Foundations",
      status: acquiredCount >= 2 ? "completed" : "in_progress",
      desc: "Syntax fundamentals, version control, core paradigms",
      evidence: "Verified via initial profile assessment",
    },
    {
      id: "architecture",
      title: "System Architecture",
      status: acquiredCount >= 4 ? "completed" : acquiredCount >= 2 ? "in_progress" : "upcoming",
      desc: "State design, caching, component lifecycles, and API contracts",
      evidence: "Roadmap node completions",
    },
    {
      id: "production",
      title: "Production Engineering",
      status: acquiredCount >= 6 ? "in_progress" : "upcoming",
      desc: "Performance budgets, error boundaries, automated test coverage",
      evidence: "Practice lab submissions",
    },
    {
      id: "market",
      title: "Market Readiness",
      status: acquiredCount >= 8 ? "in_progress" : "upcoming",
      desc: "ATS-optimized resume bullet points, behavioral STAR framing",
      evidence: "Resume studio validation",
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 font-sans">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-ink/8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1 rounded-md bg-accent/10 border border-accent/20 text-accent">
              <BarChart3 size={16} />
            </span>
            <span className="text-xs font-mono uppercase tracking-widest text-accent font-semibold">
              Career Telemetry & Intelligence
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {currentRole.label} Trajectory
          </h1>
          <p className="text-xs sm:text-sm text-ink/60 mt-1 max-w-xl">
            Real-time telemetry measuring verified competencies, completed learning nodes, and market readiness.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-surface border border-ink/10 text-right">
            <div className="text-[10px] font-mono text-ink/50 uppercase">Readiness Index</div>
            <div className="font-display text-xl font-bold text-accent">{skillReadiness}%</div>
          </div>
        </div>
      </div>

      {/* ── Empathetic Career Recovery Banner ───────────────────────────────── */}
      <CareerRecoveryBanner roleTitle={currentRole.label} />

      {/* ── Daily Action Plan (What Should I Do Today?) ─────────────────────── */}
      <DailyPlanWidget roleTitle={currentRole.label} />

      {/* ── Stat Cards Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-surface border border-ink/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-ink/50 mb-3">
            <span className="text-xs font-mono uppercase">Verified Skills</span>
            <CheckCircle2 size={16} className="text-accent" />
          </div>
          <div>
            <div className="font-display text-3xl font-bold text-white mb-1">{acquiredCount}</div>
            <p className="text-xs text-ink/60">Competencies validated in roadmap & practice</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface border border-ink/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-ink/50 mb-3">
            <span className="text-xs font-mono uppercase">Missing Skills</span>
            <Target size={16} className="text-accent" />
          </div>
          <div>
            <div className="font-display text-3xl font-bold text-white mb-1">{missingCount}</div>
            <p className="text-xs text-ink/60">Identified gaps against employer job benchmarks</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface border border-ink/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-ink/50 mb-3">
            <span className="text-xs font-mono uppercase">Active Track</span>
            <Layers size={16} className="text-accent" />
          </div>
          <div>
            <div className="font-display text-xl font-bold text-white mb-1 truncate">{currentRole.label}</div>
            <p className="text-xs text-ink/60">Target professional specification</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface border border-ink/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-ink/50 mb-3">
            <span className="text-xs font-mono uppercase">Telemetry Mode</span>
            <ShieldCheck size={16} className="text-emerald-400" />
          </div>
          <div>
            <div className="font-display text-lg font-bold text-emerald-400 mb-1">EVIDENCE_BASED</div>
            <p className="text-xs text-ink/60">Zero fabricated metrics. Derived from active work.</p>
          </div>
        </div>
      </div>

      {/* ── Main Telemetry Breakdown ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Milestones Progress */}
        <div className="lg:col-span-8 p-6 rounded-2xl bg-surface border border-ink/10 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-white">
              Curriculum Milestone Trajectory
            </h2>
            <span className="text-xs font-mono text-ink/50">4 Phased Stages</span>
          </div>

          <div className="space-y-4">
            {milestones.map((m, idx) => (
              <div
                key={m.id}
                className="p-4 rounded-xl border border-white/[0.04] bg-bg/60 flex items-start gap-4 transition-all"
              >
                <div className="mt-1 shrink-0">
                  {m.status === "completed" ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-bg shadow-xs">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  ) : m.status === "in_progress" ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-accent text-accent text-xs font-mono font-bold animate-pulse">
                      {idx + 1}
                    </span>
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-ink/40 text-xs font-mono">
                      {idx + 1}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white font-display truncate">
                      {m.title}
                    </h3>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase ${
                        m.status === "completed"
                          ? "bg-accent/15 text-accent border border-accent/25"
                          : m.status === "in_progress"
                          ? "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                          : "bg-white/[0.04] text-ink/40 border border-white/[0.06]"
                      }`}
                    >
                      {m.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-ink/70 mt-1 leading-relaxed">{m.desc}</p>
                  <p className="text-[10px] font-mono text-ink/40 mt-2">
                    Evidence source: <span className="text-ink/60">{m.evidence}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Quick Navigation / Actions */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-6 rounded-2xl bg-surface border border-ink/10 space-y-4">
            <h3 className="font-display text-sm font-bold text-white">Direct Accelerators</h3>
            <p className="text-xs text-ink/60 leading-relaxed">
              Accelerate your telemetry index by completing active roadmap nodes or training in the practice lab.
            </p>

            <div className="space-y-2 pt-2">
              <Link
                href="/roadmap"
                className="w-full flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-bg hover:border-accent/30 transition-all text-xs font-medium text-white group"
              >
                <div className="flex items-center gap-2.5">
                  <Map size={16} className="text-accent" />
                  <span>Resume Roadmap</span>
                </div>
                <ArrowRight size={14} className="text-ink/40 group-hover:text-accent transition-colors" />
              </Link>

              <Link
                href="/practice"
                className="w-full flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-bg hover:border-accent/30 transition-all text-xs font-medium text-white group"
              >
                <div className="flex items-center gap-2.5">
                  <Code2 size={16} className="text-accent" />
                  <span>Interactive Drills</span>
                </div>
                <ArrowRight size={14} className="text-ink/40 group-hover:text-accent transition-colors" />
              </Link>

              <Link
                href="/resume"
                className="w-full flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-bg hover:border-accent/30 transition-all text-xs font-medium text-white group"
              >
                <div className="flex items-center gap-2.5">
                  <FileText size={16} className="text-accent" />
                  <span>Sync Resume ATS</span>
                </div>
                <ArrowRight size={14} className="text-ink/40 group-hover:text-accent transition-colors" />
              </Link>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-accent/20 bg-accent/5 space-y-2">
            <div className="flex items-center gap-2 text-accent">
              <Sparkles size={16} />
              <span className="text-xs font-mono font-semibold uppercase">Assistant Tip</span>
            </div>
            <p className="text-xs text-ink/80 leading-relaxed">
              Say <strong className="text-white">&quot;show my skill gaps&quot;</strong> or{" "}
              <strong className="text-white">&quot;open my roadmap&quot;</strong> anytime to navigate hands-free.
            </p>
          </div>
        </div>
      </div>

      {/* ── Deterministic Career Twin Scenario Simulator ────────────────────── */}
      <CareerTwinWidget currentRoleTitle={currentRole.label} />

      {/* ── Weekly Factual Review Audit ─────────────────────────────────────── */}
      <WeeklyReviewWidget />
    </div>
  );
}
