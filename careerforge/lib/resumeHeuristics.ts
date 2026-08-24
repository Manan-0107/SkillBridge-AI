import { marketSkills } from "./data";
import { ResumeAnalysis, RoleId } from "./types";

/**
 * Lightweight, dependency-free keyword-overlap scorer so the Analyzer module
 * works with zero backend. Swap this for a call to NEXT_PUBLIC_RESUME_ANALYSIS_API
 * (or an LLM prompt) when a real analysis service is available — the return
 * shape (ResumeAnalysis) is what the UI expects either way.
 */
export function analyzeResume(resumeText: string, role: RoleId): ResumeAnalysis {
  const text = resumeText.toLowerCase();
  const targetSkills = marketSkills[role];

  const matchedSkills = targetSkills.filter((skill) =>
    text.includes(skill.toLowerCase())
  );
  const missingSkills = targetSkills.filter(
    (skill) => !matchedSkills.includes(skill)
  );

  const coverage = targetSkills.length
    ? matchedSkills.length / targetSkills.length
    : 0;
  const lengthSignal = Math.min(resumeText.trim().split(/\s+/).length / 300, 1);
  const score = Math.round((coverage * 0.75 + lengthSignal * 0.25) * 100);

  const suggestions: string[] = [];
  if (missingSkills.length > 0) {
    suggestions.push(
      `Add measurable evidence of ${missingSkills.slice(0, 3).join(", ")} — a bullet with a real outcome beats a bare keyword.`
    );
  }
  if (!/\d/.test(text)) {
    suggestions.push("Quantify at least two achievements with numbers (%, time saved, users, revenue).");
  }
  if (resumeText.trim().split(/\s+/).length < 150) {
    suggestions.push("Resume reads thin for this role — expand recent experience with specific outcomes.");
  }
  if (suggestions.length === 0) {
    suggestions.push("Strong coverage — tighten bullet phrasing so each line leads with an outcome, not a task.");
  }

  return { score, matchedSkills, missingSkills, suggestions };
}
