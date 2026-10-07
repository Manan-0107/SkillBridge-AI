"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Clock,
  BatteryCharging,
  Zap,
  ArrowRight,
  CheckCircle2,
  ListTodo,
  RefreshCw,
} from "lucide-react";
import type { DailyActionPlan } from "@/lib/career/dailyActionEngine";

interface DailyPlanWidgetProps {
  roleTitle?: string;
}

export function DailyPlanWidget({ roleTitle = "Frontend Developer" }: DailyPlanWidgetProps) {
  const [minutes, setMinutes] = useState(45);
  const [energy, setEnergy] = useState<"low" | "medium" | "high">("medium");
  const [plan, setPlan] = useState<DailyActionPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutes, energy, roleTitle]);

  const loadPlan = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/career/daily-plan?minutes=${minutes}&energy=${energy}&role=${encodeURIComponent(roleTitle)}`);
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan);
      }
    } catch (err) {
      console.error("[DailyPlanWidget] Error:", err);
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
              <ListTodo size={15} aria-hidden="true" />
            </span>
            <span className="font-mono text-xs uppercase tracking-wider text-accent font-semibold">
              Daily Action Architecture
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white">
            What Should I Do Today?
          </h2>
          <p className="text-xs text-ink/60 mt-0.5">
            Personalized, prioritized daily plan calibrated to your current time budget and cognitive energy.
          </p>
        </div>

        <button
          type="button"
          onClick={loadPlan}
          aria-label="Recalculate daily plan"
          className="p-2 rounded-xl border border-white/10 bg-surface text-ink/70 hover:text-white transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Energy & Time Budget Selectors */}
      <div className="flex flex-wrap items-center gap-4 text-xs bg-bg/50 p-3.5 rounded-xl border border-white/5">
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-accent" aria-hidden="true" />
          <span className="text-ink/60 font-semibold">Time Budget:</span>
          <div className="flex items-center gap-1.5">
            {[20, 45, 60].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-colors cursor-pointer ${
                  minutes === m
                    ? "bg-accent text-bg"
                    : "bg-surface border border-white/10 text-ink/60 hover:text-white"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <BatteryCharging size={13} className="text-accent" aria-hidden="true" />
          <span className="text-ink/60 font-semibold">Energy Level:</span>
          <div className="flex items-center gap-1.5">
            {(["low", "medium", "high"] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setEnergy(lvl)}
                className={`px-2.5 py-1 rounded-lg text-[11px] capitalize font-bold transition-colors cursor-pointer ${
                  energy === lvl
                    ? "bg-accent text-bg"
                    : "bg-surface border border-white/10 text-ink/60 hover:text-white"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-ink/50">
          Generating daily prioritized actions...
        </div>
      ) : plan && (
        <div className="space-y-3">
          <p className="text-xs text-ink/80 italic">{plan.summaryMessage}</p>

          <div className="space-y-2">
            {plan.items.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-white/10 bg-surface/40 hover:bg-surface/60 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent font-bold">
                      {item.durationMinutes} min
                    </span>
                    <span className="font-bold text-white text-sm">{item.title}</span>
                    <span className="text-[10px] font-mono text-ink/50 px-1.5 py-0.2 rounded bg-white/5">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-ink/60 text-xs pl-0.5">{item.rationale}</p>
                </div>

                <Link
                  href={item.actionUrl}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface border border-white/15 text-xs font-semibold text-white hover:border-accent hover:text-accent transition-colors self-start sm:self-auto shrink-0"
                >
                  <span>Start Activity</span>
                  <ArrowRight size={12} aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
