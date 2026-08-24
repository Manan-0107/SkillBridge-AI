"use client";

import { useState } from "react";
import { analyzeResume } from "@/lib/resumeHeuristics";
import { RoleId, ResumeAnalysis } from "@/lib/types";
import { Card, PrimaryButton, Tag } from "@/components/ui/Primitives";

export function Analyzer({ role }: { role: RoleId }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ResumeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const run = () => {
    if (!text.trim()) return;
    setLoading(true);
    // Simulated latency so the interaction reads as real analysis, not an
    // instant client-side regex. Replace with an await fetch(...) to
    // NEXT_PUBLIC_RESUME_ANALYSIS_API for a production-grade evaluation.
    setTimeout(() => {
      setResult(analyzeResume(text, role));
      setLoading(false);
    }, 600);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          placeholder="Paste your resume text here…"
          className="w-full rounded-md border border-line bg-white p-4 text-sm text-ink placeholder:text-graphite/60 focus:border-ink"
        />
        <PrimaryButton onClick={run} disabled={loading || !text.trim()} className="mt-3">
          {loading ? "Analyzing…" : "Analyze against market skills"}
        </PrimaryButton>
      </div>

      <Card className="min-h-[320px]">
        {!result ? (
          <p className="text-sm text-graphite">
            Your match score, covered skills, and gaps will appear here.
          </p>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-graphite">Market-fit score</p>
              <p className="font-display text-4xl italic text-ink">{result.score}<span className="text-lg text-graphite">/100</span></p>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-graphite">Covered skills</p>
              <div className="flex flex-wrap gap-1.5">
                {result.matchedSkills.length ? (
                  result.matchedSkills.map((s) => <Tag key={s}>{s}</Tag>)
                ) : (
                  <span className="text-sm text-graphite">None detected yet.</span>
                )}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-graphite">Gaps vs. current market</p>
              <div className="flex flex-wrap gap-1.5">
                {result.missingSkills.length ? (
                  result.missingSkills.map((s) => <Tag key={s}>{s}</Tag>)
                ) : (
                  <span className="text-sm text-graphite">No gaps found — strong coverage.</span>
                )}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-graphite">Suggestions</p>
              <ul className="space-y-1.5 text-sm text-ink">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="leading-relaxed">— {s}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
