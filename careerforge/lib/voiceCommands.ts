import { parseIntent, type FeatureId, type ResumeTab } from "./intent";

export type VoiceCommand = {
  /** Section to navigate to — the app's `careerforge:navigate` target. */
  feature: FeatureId | "assistant";
  resumeTab?: ResumeTab;
  /** Optional side-effect fired after navigation (see `careerforge:action`). */
  action?: "analyze";
  /** Human-readable label for the VoiceBar's "last command" line. */
  label: string;
};

/**
 * Explicit rules for the core spoken commands, checked in order before the fuzzy
 * `parseIntent` fallback. Order matters: "analyze my resume" must hit the analyze
 * rule, not the generic resume rule below it.
 */
const RULES: { test: RegExp; command: VoiceCommand }[] = [
  {
    test: /\b(go\s*home|go\s*back|main\s*menu|start\s*over)\b/,
    command: { feature: "assistant", label: "Home" },
  },
  {
    test: /\b(analy[sz]e|analy[sz]is|ats\s*scan|scan\s*(my\s*)?(resume|cv)|score\s*(my\s*)?(resume|cv))\b/,
    command: {
      feature: "resume",
      resumeTab: "analyzer",
      action: "analyze",
      label: "Analyze résumé",
    },
  },
  {
    test: /\b(resume|cv|résumé)\b/,
    command: { feature: "resume", resumeTab: "analyzer", label: "Résumé" },
  },
  {
    test: /\broad\s?map\b/,
    command: { feature: "roadmap", label: "Career Roadmap" },
  },
  {
    test: /\bpractice\b/,
    command: { feature: "practice", label: "Practice Hub" },
  },
];

/**
 * Standardize the raw transcript (lower-case + trim), match the explicit rules,
 * then fall back to `parseIntent` for everything else (courses, jobs, builder,
 * personalizer, role hints). Returns `null` when nothing matches.
 */
export function parseVoiceCommand(raw: string): VoiceCommand | null {
  const text = raw.toLowerCase().trim();
  if (!text) return null;

  for (const { test, command } of RULES) {
    if (test.test(text)) return command;
  }

  const intent = parseIntent(text);
  if (intent.feature) {
    return {
      feature: intent.feature,
      resumeTab: intent.resumeTab,
      label: intent.featureTitle ?? intent.feature,
    };
  }
  return null;
}
