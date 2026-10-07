"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  BookOpen,
  Code2,
  RefreshCw,
  Sparkles,
  Layers,
} from "lucide-react";

interface CareerGapExplainerProps {
  roleTitle?: string;
}

export function CareerGapExplainer({ roleTitle = "Frontend Developer" }: CareerGapExplainerProps) {
  const [gaps, setGaps] = useState<any[]>([]);
  const [hasSufficientEvidence, setHasSufficientEvidence] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleTitle]);

  const loadGaps = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/career/gaps?role=${encodeURIComponent(roleTitle)}`);
      if (res.ok) {
        const data = await res.json();
        setGaps(data.gaps || []);
        setHasSufficientEvidence(Boolean(data.hasSufficientEvidence));
      }
    } catch (err) {
      console.error("[CareerGapExplainer] Error loading gaps:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl border border-white/10 bg-surface/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-md bg-accent/10 text-accent">
              <TrendingUp size={15} aria-hidden="true" />
            </span>
            <span className="font-mono text-xs uppercase tracking-wider text-accent font-semibold">
              Evidence-Grounded Gap Explainer
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white">
            Skill Requirements for {roleTitle}
          </h2>
          <p className="text-xs text-ink/60 mt-0.5">
            Clear, transparent explanations derived from your Evidence Wallet. No arbitrary scores or unexplained claims.
          </p>
        </div>

        <button
          type="button"
          onClick={loadGaps}
          aria-label="Refresh gap analysis"
          className="p-2 rounded-xl border border-white/10 bg-surface text-ink/70 hover:text-white transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-ink/50">
          Analyzing verified evidence and engineering prerequisites...
        </div>
      ) : !hasSufficientEvidence ? (
        <div className="p-8 rounded-2xl border border-white/10 bg-surface/30 space-y-3 text-center">
          <HelpCircle size={28} className="mx-auto text-ink/40" aria-hidden="true" />
          <h3 className="text-sm font-bold text-white">UBIX does not have enough evidence yet.</h3>
          <p className="text-xs text-ink/60 max-w-lg mx-auto">
            Add your completed projects, upload your resume, or verify skills in your Evidence Wallet to generate an evidence-backed gap breakdown.
          </p>
          <div className="pt-2">
            <Link
              href="/roadmap?tab=evidence"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-xs font-bold text-bg hover:bg-accent/90 transition-colors"
            >
              <span>Open Evidence Wallet</span>
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {gaps.map((g) => {
            const exp = g.explanation;
            return (
              <div
                key={g.skillId}
                className="p-5 rounded-2xl border border-white/10 bg-surface/40 hover:bg-surface/60 transition-colors space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-base">{exp.skillName}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-ink/60">
                      {exp.category}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                      !g.isGap
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    }`}
                  >
                    {!g.isGap ? "VERIFIED IN WALLET" : "SKILL GAP DETECTED"}
                  </span>
                </div>

                {/* Evidence vs Requirement Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-bg/50 border border-white/5 space-y-1">
                    <span className="text-[10px] font-mono text-ink/40 uppercase block">Current Evidence</span>
                    <p className="text-ink/80 font-medium">{exp.existingEvidenceSummary}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-bg/50 border border-white/5 space-y-1">
                    <span className="text-[10px] font-mono text-ink/40 uppercase block">Target Role Requirement</span>
                    <p className="text-ink/80 font-medium">{exp.missingEvidenceDetails}</p>
                  </div>
                </div>

                {/* Why it Matters */}
                <div className="p-3.5 rounded-xl bg-accent/5 border border-accent/15 text-xs space-y-1">
                  <span className="text-[10px] font-mono text-accent font-bold uppercase tracking-wider block">
                    Engineering Significance
                  </span>
                  <p className="text-ink/90 leading-relaxed">{exp.whyThisGapMatters}</p>
                </div>

                {/* Recommended Next Step */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-ink/50 uppercase block">Recommended Next Step</span>
                    <p className="text-white font-medium">{exp.recommendedPractice}</p>
                  </div>

                  <Link
                    href="/practice"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-white/10 text-xs font-semibold text-white hover:border-accent hover:text-accent transition-colors self-start sm:self-auto"
                  >
                    <span>Practice Drill</span>
                    <ArrowRight size={12} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
