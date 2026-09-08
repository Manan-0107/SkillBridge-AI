/**
 * voiceProtocol.ts
 * Strict TypeScript protocol definitions for CareerForge's deterministic voice pipeline.
 *
 * Enforces:
 *  - Authoritative interaction contexts (sessionId, interactionId, questionId, fieldId)
 *  - Strict state-machine statuses
 *  - Typed WebSocket client <-> server voice events
 *  - Sequenced PCM audio packets
 *  - Configurable VAD and audio frame parameters
 *  - Observability and health diagnostics
 */

export type VoiceInteractionStatus =
  | "UNINITIALIZED"
  | "INITIALIZING"
  | "READY"
  | "ASKING"
  | "QUESTION_FINISHED"
  | "LISTENING"
  | "USER_SPEAKING"
  | "PROCESSING_TRANSCRIPT"
  | "ANSWER_READY"
  | "COMMITTING"
  | "COMMITTED"
  | "INTERRUPTED"
  | "RECOVERING"
  | "CANCELLED"
  | "ERROR";

export type InteractionMode =
  | "ONBOARDING"
  | "RESUME"
  | "ASSESSMENT"
  | "AUDIOBOOK"
  | "GENERAL"
  | "FIELD_DICTATION";

export interface VoiceInteractionContext {
  sessionId: string;
  interactionId: string;
  questionId?: string;
  fieldId?: string;
  mode: InteractionMode;
  status: VoiceInteractionStatus;
  startedAt: number;
  promptText?: string;
  expectedType?: string;
  attempts: number;
  maxAttempts: number;
  interimTranscript?: string;
  finalTranscript?: string;
  committedValue?: string;
  metadata?: Record<string, any>;
}

export interface VADConfig {
  minSpeechMs: number;
  silenceMs: number;
  preSpeechBufferMs: number;
  postSpeechBufferMs: number;
  energyThreshold: number;
  voiceHoldMs: number;
}

export const DEFAULT_VAD_CONFIG: VADConfig = {
  minSpeechMs: 150,
  silenceMs: 900,
  preSpeechBufferMs: 250,
  postSpeechBufferMs: 150,
  energyThreshold: 0.015,
  voiceHoldMs: 400,
};

// ─── Typed Client-Server WebSocket Event Protocol ────────────────────────────

export type VoiceEvent =
  | {
      type: "SESSION_START";
      sessionId: string;
      timestamp: number;
    }
  | {
      type: "INTERACTION_START";
      sessionId: string;
      interactionId: string;
      questionId?: string;
      fieldId?: string;
      mode: InteractionMode;
      promptText?: string;
      timestamp: number;
    }
  | {
      type: "AUDIO_START";
      sessionId: string;
      interactionId: string;
      sampleRate: number;
      channels: number;
      format: "pcm_s16le";
      timestamp: number;
    }
  | {
      type: "AUDIO_CHUNK";
      sessionId: string;
      interactionId: string;
      sequence: number;
      isPreBuffer?: boolean;
      timestamp: number;
      data?: ArrayBuffer;
    }
  | {
      type: "AUDIO_END";
      sessionId: string;
      interactionId: string;
      totalChunks: number;
      timestamp: number;
    }
  | {
      type: "STT_INTERIM";
      sessionId: string;
      interactionId: string;
      text: string;
      confidence?: number;
      timestamp: number;
    }
  | {
      type: "STT_FINAL";
      sessionId: string;
      interactionId: string;
      transcriptId: string;
      text: string;
      confidence?: number;
      timestamp: number;
    }
  | {
      type: "COMMIT_ANSWER";
      sessionId: string;
      interactionId: string;
      questionId?: string;
      fieldId?: string;
      transcriptId: string;
      text: string;
      timestamp: number;
    }
  | {
      type: "COMMIT_CONFIRMATION";
      sessionId: string;
      interactionId: string;
      success: boolean;
      questionId?: string;
      fieldId?: string;
      timestamp: number;
    }
  | {
      type: "INTERACTION_CANCEL";
      sessionId: string;
      interactionId: string;
      reason: string;
      timestamp: number;
    }
  | {
      type: "TTS_STATE";
      sessionId: string;
      isPlaying: boolean;
      text?: string;
      timestamp: number;
    }
  | {
      type: "HANDOFF_STATE";
      sessionId: string;
      text: string;
      timestamp: number;
    }
  | {
      type: "ONBOARDING_COMPLETE";
      sessionId: string;
      payload: {
        fullName?: string;
        email?: string;
        password?: string;
      };
      timestamp: number;
    };

// ─── Diagnostic Health Metrics ───────────────────────────────────────────────

export interface VoiceHealthMetrics {
  micState: "UNINITIALIZED" | "REQUESTING" | "ACTIVE" | "SUSPENDED" | "DENIED" | "ERROR";
  audioContextState: "running" | "suspended" | "closed" | "unsupported";
  vadState: "SPEECH" | "SILENCE";
  wsState: "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "RECONNECTING";
  audioFramesPerSec: number;
  currentSequence: number;
  activeSessionId: string | null;
  activeInteractionId: string | null;
  activeQuestionId: string | null;
  activeFieldId: string | null;
  currentDbLevel: number;
  lastInterimText: string | null;
  lastFinalText: string | null;
  vadDetectionLatencyMs: number;
  sttInterimLatencyMs: number;
  sttFinalLatencyMs: number;
  commitLatencyMs: number;
  rejectionsCount: {
    staleInteraction: number;
    duplicateTranscript: number;
    echoSuppressed: number;
    noiseRejected: number;
  };
}
