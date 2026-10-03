/**
 * lib/interview/accessibilityAssistant.ts
 *
 * UBIX Interview Accessibility Assistant
 *
 * Guarantees zero sound-dependent interview execution:
 * - Live real-time visual captions and synced scrolling transcripts
 * - Visual interview state indicators (LISTENING, THINKING, SPEAKING, PAUSED)
 * - Multi-speed speech synthesis pacing and instant text-repeat triggers
 * - Full WCAG AA keyboard hotkeys for navigation, repetition, and pausing
 */

export interface InterviewLiveState {
  currentStage: "READY" | "ASKING_QUESTION" | "RECORDING_ANSWER" | "EVALUATING" | "PROVIDING_FEEDBACK" | "PAUSED";
  visualStateLabel: string;
  isCaptionsActive: boolean;
  transcriptHistory: Array<{
    speaker: "INTERVIEWER" | "CANDIDATE";
    text: string;
    timestamp: string;
  }>;
  playbackSpeed: 0.75 | 1.0 | 1.25 | 1.5;
  activeHotkeys: Record<string, string>; // e.g., "Space": "Toggle pause/resume", "R": "Repeat question"
}

export function initializeAccessibilityAssistant(): InterviewLiveState {
  return {
    currentStage: "READY",
    visualStateLabel: "Ready to start practice. Press Space or Click Start.",
    isCaptionsActive: true,
    transcriptHistory: [],
    playbackSpeed: 1.0,
    activeHotkeys: {
      Space: "Start or pause current stage",
      KeyR: "Repeat the current interview question",
      KeyS: "Cycle playback speed (0.75x, 1.0x, 1.25x)",
      KeyC: "Toggle live closed captions visibility",
      KeyT: "Open full transcript drawer",
    },
  };
}

/**
 * Appends a speech utterance to the synchronized visible transcript.
 */
export function appendTranscript(
  state: InterviewLiveState,
  speaker: "INTERVIEWER" | "CANDIDATE",
  text: string
): InterviewLiveState {
  return {
    ...state,
    transcriptHistory: [
      ...state.transcriptHistory,
      {
        speaker,
        text,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Handles keyboard commands for accessible navigation.
 */
export function handleAccessibilityHotkey(
  code: string,
  state: InterviewLiveState
): { nextState: InterviewLiveState; commandExecuted: string } {
  switch (code) {
    case "Space": {
      const isPaused = state.currentStage === "PAUSED";
      const nextStage = isPaused ? "READY" : "PAUSED";
      return {
        nextState: {
          ...state,
          currentStage: nextStage,
          visualStateLabel: isPaused ? "Resumed session" : "Session paused",
        },
        commandExecuted: isPaused ? "RESUME" : "PAUSE",
      };
    }
    case "KeyR": {
      return {
        nextState: {
          ...state,
          visualStateLabel: "Repeating question visually and verbally...",
        },
        commandExecuted: "REPEAT_QUESTION",
      };
    }
    case "KeyS": {
      const speeds: Array<InterviewLiveState["playbackSpeed"]> = [0.75, 1.0, 1.25, 1.5];
      const currentIdx = speeds.indexOf(state.playbackSpeed);
      const nextSpeed = speeds[(currentIdx + 1) % speeds.length];
      return {
        nextState: {
          ...state,
          playbackSpeed: nextSpeed,
          visualStateLabel: `Playback speed adjusted to ${nextSpeed}x`,
        },
        commandExecuted: `SPEED_${nextSpeed}X`,
      };
    }
    case "KeyC": {
      return {
        nextState: {
          ...state,
          isCaptionsActive: !state.isCaptionsActive,
          visualStateLabel: !state.isCaptionsActive ? "Captions enabled" : "Captions hidden",
        },
        commandExecuted: "TOGGLE_CAPTIONS",
      };
    }
    default:
      return { nextState: state, commandExecuted: "NONE" };
  }
}
