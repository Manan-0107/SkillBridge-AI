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
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-graphite">1. Existing Resume Content</p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={12}
          placeholder="Paste summary, job bullets, or project achievements to tailor for your target role…"
          className="w-full rounded-xl border border-line bg-white p-4 text-sm text-ink placeholder:text-graphite/60 focus:border-ink focus:outline-none shadow-2xs"
        />
        <PrimaryButton onClick={personalize} disabled={loading || !input.trim()} className="mt-3">
          {loading ? "Tailoring Content…" : "Tailor Content for Target Role"}
        </PrimaryButton>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-graphite">
            2. Intermediate Tailored Output (Editable)
          </p>
          {output && (
            <span className="text-[11px] text-emerald-700 font-semibold">
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
              className="w-full rounded-xl border border-emerald-300 bg-emerald-50/20 p-4 text-sm text-ink focus:border-emerald-600 focus:bg-white focus:outline-none shadow-2xs leading-relaxed"
              placeholder="Tailored text will appear here. You can manually edit any line..."
            />
            {onTransferToBuilder && (
              <GhostButton
                type="button"
                onClick={() => onTransferToBuilder(output)}
                className="w-full justify-center bg-neutral-900 text-white hover:bg-neutral-800 text-xs py-2.5 shadow-sm"
              >
                ✏️ Transfer to Resume Builder (Intermediate Edit Mode) →
              </GhostButton>
            )}
          </div>
        ) : (
          <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-line bg-white p-6 text-center text-xs text-graphite">
            Paste your resume text on the left and click Tailor to generate an editable intermediate version.
          </div>
        )}
      </div>
    </div>
  );
}

