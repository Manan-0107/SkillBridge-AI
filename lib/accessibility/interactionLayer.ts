/**
 * lib/accessibility/interactionLayer.ts
 *
 * UBIX Universal Interaction Layer
 *
 * Provides a unified abstraction for dispatching and responding to user actions
 * across all input modalities: keyboard, mouse, touch, voice, screen reader,
 * and conversational text.
 *
 * Security & Accessibility Invariants:
 * - Voice is 100% event-driven. Never enables continuous recording.
 * - Every voice action has an exact visual equivalent.
 * - Screen readers receive immediate semantic feedback via ARIA live announcements.
 */

export type ModalityType =
  | "keyboard"
  | "mouse"
  | "touch"
  | "voice"
  | "screen_reader"
  | "conversational_text";

export interface GlobalCommandAction {
  id: string;
  command: string;
  targetRoute?: string;
  actionType: "NAVIGATE" | "CONTROL" | "ASSIST";
  spokenFeedback: string;
  visualFeedback: string;
}

export const GLOBAL_VOICE_COMMANDS: Record<string, GlobalCommandAction> = {
  "go home": {
    id: "nav_home",
    command: "go home",
    targetRoute: "/",
    actionType: "NAVIGATE",
    spokenFeedback: "Navigating to home.",
    visualFeedback: "Navigating to Home",
  },
  "open assistant": {
    id: "nav_assistant",
    command: "open assistant",
    targetRoute: "/journey",
    actionType: "NAVIGATE",
    spokenFeedback: "Opening AI career assistant.",
    visualFeedback: "Opening Career Assistant",
  },
  "open roadmap": {
    id: "nav_roadmap",
    command: "open roadmap",
    targetRoute: "/roadmap",
    actionType: "NAVIGATE",
    spokenFeedback: "Opening your personalized roadmap.",
    visualFeedback: "Opening Roadmap",
  },
  "show skill gaps": {
    id: "nav_skill_gaps",
    command: "show skill gaps",
    targetRoute: "/journey",
    actionType: "NAVIGATE",
    spokenFeedback: "Showing identified skill gaps.",
    visualFeedback: "Displaying Skill Gaps",
  },
  "show jobs": {
    id: "nav_jobs",
    command: "show jobs",
    targetRoute: "/jobs",
    actionType: "NAVIGATE",
    spokenFeedback: "Opening matched career opportunities.",
    visualFeedback: "Opening Jobs",
  },
  "build resume": {
    id: "nav_resume",
    command: "build resume",
    targetRoute: "/resume",
    actionType: "NAVIGATE",
    spokenFeedback: "Opening resume builder and analyzer.",
    visualFeedback: "Opening Resume",
  },
  "show progress": {
    id: "nav_progress",
    command: "show progress",
    targetRoute: "/progress",
    actionType: "NAVIGATE",
    spokenFeedback: "Opening your career journey progress.",
    visualFeedback: "Opening Progress",
  },
  "start practice": {
    id: "nav_practice",
    command: "start practice",
    targetRoute: "/practice",
    actionType: "NAVIGATE",
    spokenFeedback: "Starting interview and skills practice.",
    visualFeedback: "Starting Practice",
  },
  "go back": {
    id: "ctrl_back",
    command: "go back",
    actionType: "CONTROL",
    spokenFeedback: "Going back to previous screen.",
    visualFeedback: "Going Back",
  },
  "repeat": {
    id: "ctrl_repeat",
    command: "repeat",
    actionType: "CONTROL",
    spokenFeedback: "Repeating last statement.",
    visualFeedback: "Repeating",
  },
  "help": {
    id: "ctrl_help",
    command: "help",
    actionType: "ASSIST",
    spokenFeedback:
      "Available commands: go home, open assistant, open roadmap, show jobs, build resume, start practice, or ask a question.",
    visualFeedback: "Showing Voice and Keyboard Commands Help",
  },
  "stop listening": {
    id: "ctrl_stop",
    command: "stop listening",
    actionType: "CONTROL",
    spokenFeedback: "Microphone stopped.",
    visualFeedback: "Microphone Inactive",
  },
};

/**
 * Matches a spoken or typed phrase against canonical global commands.
 */
export function matchGlobalCommand(input: string): GlobalCommandAction | null {
  if (!input || typeof input !== "string") return null;

  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");

  // Direct exact match
  if (GLOBAL_VOICE_COMMANDS[normalized]) {
    return GLOBAL_VOICE_COMMANDS[normalized];
  }

  // Synonym and partial matching
  if (normalized.includes("go home") || normalized === "home") return GLOBAL_VOICE_COMMANDS["go home"];
  if (normalized.includes("open assistant") || normalized.includes("ask assistant") || normalized === "assistant")
    return GLOBAL_VOICE_COMMANDS["open assistant"];
  if (normalized.includes("open roadmap") || normalized.includes("show roadmap") || normalized === "roadmap")
    return GLOBAL_VOICE_COMMANDS["open roadmap"];
  if (normalized.includes("skill gaps") || normalized.includes("show gaps"))
    return GLOBAL_VOICE_COMMANDS["show skill gaps"];
  if (normalized.includes("show jobs") || normalized.includes("open jobs") || normalized === "jobs")
    return GLOBAL_VOICE_COMMANDS["show jobs"];
  if (normalized.includes("build resume") || normalized.includes("open resume") || normalized === "resume")
    return GLOBAL_VOICE_COMMANDS["build resume"];
  if (normalized.includes("show progress") || normalized.includes("open progress") || normalized === "progress")
    return GLOBAL_VOICE_COMMANDS["show progress"];
  if (normalized.includes("start practice") || normalized.includes("open practice") || normalized === "practice")
    return GLOBAL_VOICE_COMMANDS["start practice"];
  if (normalized.includes("go back") || normalized === "back") return GLOBAL_VOICE_COMMANDS["go back"];
  if (normalized.includes("repeat") || normalized === "say again") return GLOBAL_VOICE_COMMANDS["repeat"];
  if (normalized.includes("help") || normalized === "what can i say") return GLOBAL_VOICE_COMMANDS["help"];
  if (normalized.includes("stop listening") || normalized.includes("mute") || normalized === "stop")
    return GLOBAL_VOICE_COMMANDS["stop listening"];

  return null;
}
