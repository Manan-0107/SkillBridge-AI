import { parseIntent, type FeatureId, type ResumeTab } from "./intent";

export type VoiceCommand = {
  /** Section to navigate to — the app's `careerforge:navigate` target. */
  feature: FeatureId | "assistant" | "progress" | "back" | "help" | "repeat" | "stop";
  resumeTab?: ResumeTab;
  /** Optional side-effect fired after navigation (see `careerforge:action`). */
  action?: "analyze" | "builder" | "gaps";
  /** Human-readable label for the VoiceBar's "last command" line. */
  label: string;
  /** Guidance speech/text hint */
  guidance?: string;
};

/**
 * Explicit rules for the core spoken commands, checked in order before the fuzzy
 * `parseIntent` fallback. Order matters.
 */
const RULES: { test: RegExp; command: VoiceCommand }[] = [
  {
    test: /\b(stop\s*listening|stop\s*mic|turn\s*off\s*voice|mute)\b/,
    command: {
      feature: "stop",
      label: "Stop Listening",
      guidance: "Microphone turned off. You can click the mic icon or press Alt+V to re-enable.",
    },
  },
  {
    test: /\b(repeat\s*that|say\s*again|repeat)\b/,
    command: {
      feature: "repeat",
      label: "Repeat That",
      guidance: "Repeating previous statement.",
    },
  },
  {
    test: /\b(help|voice\s*help|what\s*can\s*i\s*say)\b/,
    command: {
      feature: "help",
      label: "Voice Help",
      guidance: "Available voice commands: 'open my roadmap', 'show my skill gaps', 'build my resume', 'find jobs', 'show my progress', or 'go back'.",
    },
  },
  {
    test: /\b(show\s*(my\s*)?skill\s*gaps|skill\s*gaps?)\b/,
    command: {
      feature: "roadmap",
      action: "gaps",
      label: "Skill Gaps",
      guidance: "Action completed. Viewing your skill gaps. You can say: 'open my roadmap' or 'build my resume'.",
    },
  },
  {
    test: /\b(build\s*(my\s*)?resume|resume\s*builder|create\s*(my\s*)?resume)\b/,
    command: {
      feature: "resume",
      resumeTab: "builder",
      action: "builder",
      label: "Resume Builder",
      guidance: "Action completed. Viewing your resume builder. You can say: 'find jobs' or 'go back'.",
    },
  },
  {
    test: /\b(find\s*jobs|job\s*search|show\s*(my\s*)?jobs|opportunities)\b/,
    command: {
      feature: "local",
      label: "Job Radar",
      guidance: "Action completed. Viewing opportunity radar. You can say: 'show my progress' or 'go home'.",
    },
  },
  {
    test: /\b(show\s*(my\s*)?progress|career\s*telemetry|my\s*progress)\b/,
    command: {
      feature: "progress",
      label: "Career Telemetry",
      guidance: "Action completed. Viewing your career progress telemetry. You can say: 'start practice' or 'go back'.",
    },
  },
  {
    test: /\b(go\s*back|navigate\s*back)\b/,
    command: {
      feature: "back",
      label: "Go Back",
      guidance: "Action completed. Returning to previous view.",
    },
  },
  {
    test: /\b(go\s*home|main\s*menu|start\s*over)\b/,
    command: {
      feature: "assistant",
      label: "Home",
      guidance: "Action completed. You are now at home. You can say: 'open my roadmap' or 'find jobs'.",
    },
  },
  {
    test: /\b(analy[sz]e|analy[sz]is|ats\s*scan|scan\s*(my\s*)?(resume|cv)|score\s*(my\s*)?(resume|cv))\b/,
    command: {
      feature: "resume",
      resumeTab: "analyzer",
      action: "analyze",
      label: "Analyze résumé",
      guidance: "Action completed. Analyzing your résumé for ATS compatibility.",
    },
  },
  {
    test: /\b(open\s*(my\s*)?roadmap|view\s*(my\s*)?roadmap|road\s?map)\b/,
    command: {
      feature: "roadmap",
      label: "Career Roadmap",
      guidance: "Action completed. You are now viewing your roadmap. You can say: 'show my skill gaps' or 'go back'.",
    },
  },
  {
    test: /\b(resume|cv|résumé)\b/,
    command: {
      feature: "resume",
      resumeTab: "analyzer",
      label: "Résumé",
      guidance: "Action completed. You are now in the Resume Suite.",
    },
  },
  {
    test: /\b(start\s*practice|practice\s*hub|practice)\b/,
    command: {
      feature: "practice",
      label: "Practice Hub",
      guidance: "Action completed. You are now in the Practice Lab. You can say: 'show my progress' or 'go back'.",
    },
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
      guidance: `Action completed. Navigating to ${intent.featureTitle ?? intent.feature}.`,
    };
  }
  return null;
}
