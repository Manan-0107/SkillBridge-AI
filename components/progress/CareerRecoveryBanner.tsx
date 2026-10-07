"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Heart,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import type { CareerRecoveryPlan } from "@/lib/career/careerRecovery";

interface CareerRecoveryBannerProps {
  roleTitle?: string;
}

export function CareerRecoveryBanner({ roleTitle = "Frontend Developer" }: CareerRecoveryBannerProps) {
  const [recovery, setRecovery] = useState<CareerRecoveryPlan | null>(null);

  useEffect(() => {
    fetchRecovery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleTitle]);

  const fetchRecovery = async () => {
    try {
      const res = await fetch(`/api/career/daily-plan?role=${encodeURIComponent(roleTitle)}`);
      if (res.ok) {
        const data = await res.json();
        setRecovery(data.recovery || null);
      }
    } catch (err) {
      console.error("[CareerRecoveryBanner] Error:", err);
    }
  };

  if (!recovery) return null;

  return (
    <div className="p-5 rounded-2xl border border-teal-500/20 bg-teal-500/5 space-y-3 text-xs">
      <div className="flex items-center gap-2 text-teal-300">
        <Heart size={15} aria-hidden="true" />
        <span className="font-mono text-xs uppercase tracking-wider font-bold">
          Empathetic Career Recovery
        </span>
      </div>

      <p className="text-white text-xs leading-relaxed font-medium">
        {recovery.welcomeMessage}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        <div className="p-3 rounded-xl bg-surface/50 border border-white/5 space-y-1">
          <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold block">
            Permanently Retained Strengths
          </span>
          <p className="text-ink/80 text-[11px]">
            {recovery.retainedStrengths.join(", ")}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-surface/50 border border-white/5 space-y-1 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-mono text-accent uppercase font-semibold block">
              Low-Friction Quick Win
            </span>
            <p className="text-white text-xs font-semibold">{recovery.quickWinRestartTask.title}</p>
            <p className="text-ink/60 text-[10px]">{recovery.quickWinRestartTask.description}</p>
          </div>

          <Link
            href={recovery.quickWinRestartTask.actionUrl}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-[11px] font-bold text-bg hover:bg-accent/90 transition-colors shrink-0"
          >
            <span>Resume</span>
            <ArrowRight size={11} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
