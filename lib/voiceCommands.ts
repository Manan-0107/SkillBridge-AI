import { parseIntent, type FeatureId, type ResumeTab } from "./intent";

/**
 * The persistent voice layer routes every recognised utterance through
 * `parseVoiceCommand`. The result tells the router what to do:
 *
 *   { kind: "navigate", ... }  — resolve locally, change route now (no network)
 *   { kind: "assistant", ... } — hand the raw utterance to /api/assistant/chat
 *   null                       — empty / no speech, do nothing
 *
 * Anything that isn't an obvious offline navigation command becomes an
 * `assistant` handoff rather than being dropped — that is the whole point of
 * the intent pipeline (overhaul requirement #2).
 */
export type NavigateCommand = {
  kind: "navigate";
  /** Section to navigate to — the app's `careerforge:navigate` target. */
  feature: FeatureId | "assistant";
  resumeTab?: ResumeTab;
  /** Optional side-effect fired after navigation (see `careerforge:action`). */
  action?: "analyze";
  /** Human-readable label for the VoiceBar's "last command" line + the spoken/aria acknowledgement. */
  label: string;
};

export type AssistantCommand = {
  kind: "assistant";
  /** The raw transcript to forward to the in-house AI assistant. */
  query: string;
  label: string;
};

export type VoiceCommand = NavigateCommand | AssistantCommand;

/**
 * Explicit rules for the core spoken commands, checked in order before the fuzzy
 * `parseIntent` fallback. Order matters: "analyze my resume" must hit the analyze
 * rule, not the generic resume rule below it.
 */
const RULES: { test: RegExp; command: NavigateCommand }[] = [
  {
    test: /\b(go\s*(back|home)|(go|take\s*me)\s*(to\s*)?(the\s*)?(home|main\s*menu|dashboard|start)(\s*(page|screen))?|main\s*menu|start\s*over|open\s*(the\s*)?(home|assistant|dashboard))\b/,
    command: { kind: "navigate", feature: "assistant", label: "Home" },
  },
  {
    test: /\b(analy[sz]e|analy[sz]is|ats\s*scan|scan\s*(my\s*)?(resume|cv)|score\s*(my\s*)?(resume|cv))\b/,
    command: {
      kind: "navigate",
      feature: "resume",
      resumeTab: "analyzer",
      action: "analyze",
      label: "Analyze résumé",
    },
  },
  {
    test: /\b(resume|cv|résumé)\b/,
    command: { kind: "navigate", feature: "resume", resumeTab: "analyzer", label: "Résumé" },
  },
  {
    test: /\broad\s?map\b/,
    command: { kind: "navigate", feature: "roadmap", label: "Career Roadmap" },
  },
  {
    test: /\bpractice\b/,
    command: { kind: "navigate", feature: "practice", label: "Practice Hub" },
  },
];

/**
 * Standardize the raw transcript (lower-case + trim), match the explicit rules,
 * then the fuzzy `parseIntent` (courses, jobs, builder, personalizer, role
 * hints). Anything still unmatched is returned as an `assistant` handoff — never
 * `null` unless the input is empty.
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
      kind: "navigate",
      feature: intent.feature,
      resumeTab: intent.resumeTab,
      label: intent.featureTitle ?? intent.feature,
    };
  }

  return { kind: "assistant", query: raw.trim(), label: "Ask assistant" };
}
