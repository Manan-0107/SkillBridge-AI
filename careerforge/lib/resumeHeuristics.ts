/**
 * Enhanced local heuristic resume scorer.
 * Scores the resume on 5 dimensions: keyword coverage, action verbs,
 * quantification, section completeness, and length signal.
 */

import { marketSkills } from "./data";
import { ResumeAnalysis, RoleId } from "./types";

// ─── Action verbs associated with high-impact bullets ─────────────────────────
const ACTION_VERBS = [
  "led", "built", "shipped", "launched", "designed", "developed", "architected",
  "optimized", "reduced", "increased", "improved", "delivered", "managed",
  "created", "implemented", "deployed", "automated", "migrated", "scaled",
  "drove", "grew", "negotiated", "collaborated", "mentored", "owned",
  "spearheaded", "pioneered", "transformed", "streamlined", "established",
];

// ─── Resume sections we expect to see ────────────────────────────────────────
const EXPECTED_SECTIONS = [
  ["summary", "objective", "profile", "about"],
  ["experience", "employment", "work history", "positions"],
  ["education", "academic", "degree", "university"],
  ["skills", "technologies", "competencies", "expertise", "tools"],
];

export function analyzeResume(resumeText: string, role: RoleId): ResumeAnalysis {
  const text = resumeText.toLowerCase();
  const words = resumeText.trim().split(/\s+/);
  const targetSkills = marketSkills[role] ?? [];

  // 1. Keyword / skill coverage (40%)
  const matchedSkills = targetSkills.filter((s) => text.includes(s.toLowerCase()));
  const missingSkills = targetSkills.filter((s) => !matchedSkills.includes(s));
  const coverageScore = targetSkills.length
    ? matchedSkills.length / targetSkills.length
    : 0;

  // 2. Action verbs (20%)
  const actionVerbCount = ACTION_VERBS.filter((v) =>
    new RegExp(`\\b${v}(d|ed|s|ing)?\\b`).test(text)
  ).length;
  const actionVerbScore = Math.min(actionVerbCount / 6, 1); // 6+ verbs = full score

  // 3. Quantification — numbers, %, $, x (20%)
  const hasNumbers = /\d+(\.\d+)?\s*(%|x|k\b|\$|m\b|million|billion|users|requests|seconds|ms|minutes|hours|days)/i.test(resumeText);
  const numberMatches = (resumeText.match(/\d+/g) ?? []).length;
  const quantScore = hasNumbers ? 1 : Math.min(numberMatches / 5, 0.6);

  // 4. Section completeness (10%)
  const sectionsFound = EXPECTED_SECTIONS.filter((variants) =>
    variants.some((v) => text.includes(v))
  ).length;
  const sectionScore = sectionsFound / EXPECTED_SECTIONS.length;

  // 5. Length signal (10%)
  const lengthScore = Math.min(words.length / 350, 1);

  const rawScore =
    coverageScore * 0.40 +
    actionVerbScore * 0.20 +
    quantScore * 0.20 +
    sectionScore * 0.10 +
    lengthScore * 0.10;

  const score = Math.max(10, Math.round(rawScore * 100));

  // ─── Generate suggestions ────────────────────────────────────────────────
  const suggestions: string[] = [];

  if (missingSkills.length > 0) {
    suggestions.push(
      `Add measurable evidence of ${missingSkills.slice(0, 3).join(", ")} — a bullet with a real outcome beats a bare keyword.`
    );
  }
  if (!hasNumbers) {
    suggestions.push(
      "Quantify at least two achievements with numbers — percentages, users reached, revenue impact, or time saved."
    );
  }
  if (actionVerbCount < 3) {
    suggestions.push(
      `Open more bullets with strong action verbs like: ${ACTION_VERBS.slice(0, 5).join(", ")}.`
    );
  }
  if (sectionsFound < 3) {
    suggestions.push(
      "Ensure your resume has clearly labelled sections: Summary, Experience, Education, and Skills."
    );
  }
  if (words.length < 200) {
    suggestions.push(
      "Resume reads thin for this role — expand recent experience with specific project outcomes."
    );
  }
  if (suggestions.length === 0) {
    suggestions.push(
      "Strong coverage — tighten bullet phrasing so each line leads with an outcome, not a task."
    );
  }

  return { score, matchedSkills, missingSkills, suggestions };
}
