"use client";

import { useState } from "react";
import { marketSkills } from "@/lib/data";
import { RoleId } from "@/lib/types";
import { PrimaryButton, GhostButton } from "@/components/ui/Primitives";

export function Personalizer({
  role,
  onTransferToBuilder,
}: {
  role: RoleId;
  onTransferToBuilder?: (tailoredSummary: string) => void;
}) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEditingOutput, setIsEditingOutput] = useState(false);

  const personalize = () => {
    if (!input.trim()) return;
    setLoading(true);
    setTimeout(() => {
      const skills = marketSkills[role].slice(0, 4).join(", ");
      const tightened = input
        .split(/\n+/)
        .filter(Boolean)
        .map((line) => {
          const trimmed = line.trim();
          if (/^(responsible for|worked on|helped with)/i.test(trimmed)) {
            return trimmed.replace(/^(responsible for|worked on|helped with)\s*/i, "");
          }
          return trimmed;
        })
        .join("\n");
      setOutput(
        `${tightened}\n\nKey Focus Areas: ${skills}.`
      );
      setLoading(false);
      setIsEditingOutput(true);
    }, 400);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/60">1. Existing Resume Content</p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={12}
          placeholder="Paste summary, job bullets, or project achievements to tailor for your target role…"
          className="w-full rounded-xl border border-ink/15 bg-bg p-4 text-sm text-ink placeholder:text-ink/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent shadow-xs"
        />
        <PrimaryButton onClick={personalize} disabled={loading || !input.trim()} className="mt-3">
          {loading ? "Tailoring Content…" : "Tailor Content for Target Role"}
        </PrimaryButton>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink/60">
            2. Intermediate Tailored Output (Editable)
          </p>
          {output && (
            <span className="text-[11px] text-success font-semibold">
              Live Editable Field ✓
            </span>
          )}
        </div>

        {output ? (
          <div className="space-y-3">
            <textarea
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              rows={12}
              className="w-full rounded-xl border border-success/30 bg-success/5 p-4 text-sm text-ink focus:border-success focus:bg-bg focus:outline-none shadow-xs leading-relaxed"
              placeholder="Tailored text will appear here. You can manually edit any line..."
            />
            {onTransferToBuilder && (
              <GhostButton
                type="button"
                onClick={() => onTransferToBuilder(output)}
                className="w-full justify-center bg-ink text-bg hover:opacity-90 text-xs py-2.5 shadow-sm"
              >
                ✏️ Transfer to Resume Builder (Intermediate Edit Mode) →
              </GhostButton>
            )}
          </div>
        ) : (
          <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-ink/15 bg-surface/40 p-6 text-center text-xs text-ink/50">
            Paste your resume text on the left and click Tailor to generate an editable intermediate version.
          </div>
        )}
      </div>
    </div>
  );
}

