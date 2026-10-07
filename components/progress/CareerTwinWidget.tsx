"use client";

import React, { useState } from "react";
import {
  Compass,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
  Layers,
  ShieldAlert,
  Info,
} from "lucide-react";
import type { CareerTwinSimulationResult } from "@/lib/career/careerTwin";

interface CareerTwinWidgetProps {
  currentRoleTitle?: string;
}

export function CareerTwinWidget({ currentRoleTitle = "Frontend Developer" }: CareerTwinWidgetProps) {
  const [targetSkill, setTargetSkill] = useState("TypeScript");
  const [hoursPerWeek, setHoursPerWeek] = useState(10);
  const [simulation, setSimulation] = useState<CareerTwinSimulationResult | null>(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSimulate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetSkill.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/career/twin/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetSkillToAdd: targetSkill.trim(),
          hoursPerWeek,
          currentRole: currentRoleTitle,
          targetRole: `${currentRoleTitle} (Senior / Specialist)`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.simulation) {
        setSimulation(data.simulation);
        setDisclaimer(data.disclaimer || "Scenario estimates are non-binding projections based on canonical skill graphs.");
      } else {
        setError(data.message || "Unable to simulate scenario.");
      }
    } catch (err: any) {
      setError(err?.message || "Simulation network error.");
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
              <Compass size={15} aria-hidden="true" />
            </span>
            <span className="font-mono text-xs uppercase tracking-wider text-accent font-semibold">
              Deterministic Career Twin
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white">
            What-If Career Trajectory Simulator
          </h2>
          <p className="text-xs text-ink/60 mt-0.5">
            Model the potential trajectory impact of mastering a new skill. Grounded strictly in your verified evidence and canonical prerequisites.
          </p>
        </div>

        <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-ink/50 self-start sm:self-auto">
          No Fictional Projections
        </span>
      </div>

      {/* Simulator Inputs Form */}
      <form onSubmit={handleSimulate} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label htmlFor="twin-skill-select" className="text-xs font-semibold text-ink/70">
            Scenario Skill to Acquire
          </label>
          <select
            id="twin-skill-select"
            value={targetSkill}
            onChange={(e) => setTargetSkill(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-bg p-2.5 text-xs text-ink focus:border-accent focus:outline-none cursor-pointer"
          >
            <option value="TypeScript">TypeScript (Type Safety & Architecture)</option>
            <option value="Next.js">Next.js (Full-Stack SSR & App Router)</option>
            <option value="Docker">Docker (Containerization & Deployment)</option>
            <option value="PostgreSQL">PostgreSQL (Relational Schema & Indexing)</option>
            <option value="Automated Testing">Automated Testing (Jest / Playwright / E2E)</option>
            <option value="GraphQL">GraphQL (Schema Federation & Queries)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="twin-hours-input" className="text-xs font-semibold text-ink/70">
            Dedicated Hours / Week ({hoursPerWeek} hrs)
          </label>
          <input
            id="twin-hours-input"
            type="range"
            min={2}
            max={30}
            step={2}
            value={hoursPerWeek}
            onChange={(e) => setHoursPerWeek(Number(e.target.value))}
            className="w-full mt-2 accent-accent cursor-pointer"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-bg hover:bg-accent/90 transition-colors disabled:opacity-40 cursor-pointer"
          >
            {loading ? "Simulating..." : "Run Scenario Simulation"}
          </button>
        </div>
      </form>

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Simulation Result */}
      {simulation && (
        <div className="p-5 rounded-2xl border border-accent/20 bg-accent/5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent/15 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-accent" aria-hidden="true" />
              <h3 className="text-sm font-bold text-white">{simulation.scenarioName}</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface border border-accent/30 text-accent font-semibold">
                Est. {simulation.effortEstimateWeeks} Weeks
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                +{simulation.marketAlignmentDeltaPercent}% Market Alignment
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink/70 font-semibold block">
                Potential Unlocked Opportunity Categories
              </span>
              <ul className="space-y-1">
                {simulation.unlockedOpportunities.map((op, i) => (
                  <li key={i} className="flex items-center gap-2 text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    <span>{op}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink/70 font-semibold block">
                Prerequisites Required Prior to Mastery
              </span>
              {simulation.keyPrerequisitesToMeetFirst.length === 0 ? (
                <p className="text-emerald-400 font-medium">All prerequisite competencies met!</p>
              ) : (
                <ul className="space-y-1">
                  {simulation.keyPrerequisitesToMeetFirst.map((p, i) => (
                    <li key={i} className="flex items-center gap-2 text-amber-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Truthfulness Disclaimer */}
          <div className="flex items-start gap-2 pt-2 border-t border-accent/15 text-[11px] text-ink/60">
            <Info size={12} className="text-accent shrink-0 mt-0.5" aria-hidden="true" />
            <p className="italic">{disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
