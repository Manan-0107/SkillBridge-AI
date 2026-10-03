"use client";

import { useState } from "react";
import { RoleId } from "@/lib/types";
import { PrimaryButton, GhostButton } from "@/components/ui/Primitives";
import { Check, Edit3, Lightbulb, Sparkles, Tag } from "lucide-react";

interface OptimizeApiResponse {
  optimized?: string;
  alternatives?: string[];
  atsKeywordsAdded?: string[];
  scoreImprovement?: string;
  metricPrompt?: string;
  code?: string;
  message?: string;
}

export function Personalizer({
  role,
  onTransferToBuilder,
}: {
  role: RoleId;
  onTransferToBuilder?: (tailoredSummary: string) => void;
}) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [metricPrompt, setMetricPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState<string | null>(null);

  const personalize = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError(null);
    setStatusAnnouncement("Optimizing resume content with factual integrity preservation...");

    try {
      const res = await fetch("/api/resume/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: input.trim(),
          role,
          type: "summary",
        }),
      });

      const data: OptimizeApiResponse = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to optimize content.");
      }

      setOutput(data.optimized || "");
      setAlternatives(data.alternatives || []);
      setKeywords(data.atsKeywordsAdded || []);
      setMetricPrompt(data.metricPrompt || null);
      setStatusAnnouncement("Optimization complete. Review and edit below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to optimize content.");
      setStatusAnnouncement("Optimization request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* ── Left Column: Input text ── */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/60">
          1. Existing Resume Content
        </p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={12}
          placeholder="Paste summary, job bullets, or achievements to tailor for your target role without fabricating facts…"
          className="w-full rounded-xl border border-ink/15 bg-bg p-4 text-sm text-ink placeholder:text-ink/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent shadow-xs"
          aria-label="Existing resume text to optimize"
        />
        <div className="mt-3 flex items-center justify-between">
          <PrimaryButton
            onClick={personalize}
            disabled={loading || !input.trim()}
            className="flex items-center gap-1.5"
          >
            <Sparkles size={13} />
            <span>{loading ? "Optimizing Phrasing…" : `Optimize for ${role.toUpperCase()}`}</span>
          </PrimaryButton>
        </div>

        {statusAnnouncement && (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 text-xs text-accent font-medium"
          >
            {statusAnnouncement}
          </div>
        )}

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
          >
            {error}
          </div>
        )}
      </div>

      {/* ── Right Column: Output and alternatives ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink/60">
            2. Fact-Preserved Optimization (Editable)
          </p>
          {output && (
            <span className="flex items-center gap-1 text-[11px] text-success font-semibold">
              <Check size={12} strokeWidth={2.5} />
              <span>Live Editable Field</span>
            </span>
          )}
        </div>

        {output ? (
          <div className="space-y-4">
            <textarea
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              rows={8}
              className="w-full rounded-xl border border-success/30 bg-success/5 p-4 text-sm text-ink focus:border-success focus:bg-bg focus:outline-none shadow-xs leading-relaxed"
              placeholder="Tailored text will appear here. You can manually edit any line..."
              aria-label="Optimized resume text"
            />

            {/* Added Keywords Badges */}
            {keywords.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink/50 mb-1.5 flex items-center gap-1">
                  <Tag size={11} />
                  <span>Target Role ATS Keywords Added:</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-ink/80 font-medium"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Metric Guidance Prompt */}
            {metricPrompt && (
              <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-xs text-accent flex items-start gap-2">
                <Lightbulb size={13} className="shrink-0 mt-0.5" />
                <span>{metricPrompt}</span>
              </div>
            )}

            {/* Alternatives */}
            {alternatives.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink/50">
                  Alternative Phrasings:
                </p>
                {alternatives.map((alt, i) => (
                  <div
                    key={i}
                    onClick={() => setOutput(alt)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOutput(alt); }}
                    className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-xs text-ink/80 hover:border-accent/40 hover:bg-white/[0.04] transition-all"
                  >
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-ink/40 mb-0.5">
                      Option {i + 1} (Click to use)
                    </p>
                    <p>{alt}</p>
                  </div>
                ))}
              </div>
            )}

            {onTransferToBuilder && (
              <GhostButton
                type="button"
                onClick={() => onTransferToBuilder(output)}
                className="w-full justify-center bg-ink text-bg hover:opacity-90 text-xs py-2.5 shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 size={13} />
                <span>Transfer to Resume Builder →</span>
              </GhostButton>
            )}
          </div>
        ) : (
          <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-ink/15 bg-surface/40 p-6 text-center text-xs text-ink/50">
            Paste your resume text on the left and click &quot;Optimize for {role.toUpperCase()}&quot; to generate an improved, fact-preserving version.
          </div>
        )}
      </div>
    </div>
  );
}
