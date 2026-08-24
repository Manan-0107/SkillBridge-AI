"use client";

import { useState } from "react";
import { marketSkills } from "@/lib/data";
import { RoleId } from "@/lib/types";
import { Card, PrimaryButton } from "@/components/ui/Primitives";

export function Personalizer({ role }: { role: RoleId }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const personalize = () => {
    if (!input.trim()) return;
    setLoading(true);
    // Local rewrite heuristic: surfaces role-relevant skill vocabulary and
    // tightens phrasing. Swap for an LLM call (Claude via the Anthropic API)
    // for genuine rewriting quality in production.
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
        `${tightened}\n\n— Tailored emphasis for this path: ${skills}. Consider foregrounding these where your experience already touches them.`
      );
      setLoading(false);
    }, 600);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-graphite">Existing resume text</p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={12}
          placeholder="Paste a section of your resume to tailor…"
          className="w-full rounded-md border border-line bg-white p-4 text-sm text-ink placeholder:text-graphite/60 focus:border-ink"
        />
        <PrimaryButton onClick={personalize} disabled={loading || !input.trim()} className="mt-3">
          {loading ? "Tailoring…" : "Tailor for my target role"}
        </PrimaryButton>
      </div>
      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-graphite">Tailored result</p>
        <Card className="min-h-[280px] whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {output || (
            <span className="text-graphite">Your tailored text will appear here.</span>
          )}
        </Card>
      </div>
    </div>
  );
}
