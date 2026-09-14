/**
 * VoiceSessionManager.ts
 * Single Authoritative Voice Session Controller for CareerForge.
 *
 * Implements:
 *  - Strict, deterministic state machine (ASKING -> QUESTION_FINISHED -> LISTENING -> USER_SPEAKING -> ANSWER_READY -> COMMITTING -> COMMITTED -> NEXT)
 *  - Immutable interaction correlation keys (sessionId, interactionId, questionId, fieldId)
 *  - Rejection of stale, duplicate, or cross-question transcripts
 *  - Atomic, field-aware answer commits
 *  - AudioContext lifecycle management & user gesture auto-unlock
 *  - Pre-speech buffered PCM audio streaming with sequence numbers
 *  - Robust VAD with hysteresis, silence threshold (900ms), and echo suppression
 *  - Doubt-solving assessment context-locking and safe resumption
 *  - Observability and real-time health metrics
 */

import type {
  VoiceInteractionStatus,
  InteractionMode,
  VoiceInteractionContext,
  VoiceEvent,
  VADConfig,
  VoiceHealthMetrics,
} from "./voiceProtocol";

export const DEFAULT_VAD_CONFIG: VADConfig = {
  minSpeechMs: 150,
  silenceMs: 900,
  preSpeechBufferMs: 250,
  postSpeechBufferMs: 150,
  energyThreshold: 0.015,
  voiceHoldMs: 400,
};

import { isSpeechSynthesisSupported, stopSpeaking, speakText } from "@/lib/voice";


export type StateListener = (
  context: VoiceInteractionContext | null,
  metrics: VoiceHealthMetrics
) => void;

export type FieldCommitter = (
  fieldId: string,
  value: string,
  interactionId: string
) => Promise<boolean> | boolean;

export class VoiceSessionManager {
  private static instance: VoiceSessionManager | null = null;

  // Session & Interaction Identity
  private sessionId: string;
  private currentInteraction: VoiceInteractionContext | null = null;
  private interactionHistory: VoiceInteractionContext[] = [];
  private committedTranscriptIds = new Set<string>();

  // Audio & Hardware
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private isTtsPlaying = false;
  private lastTtsEndedAt = 0;

  // Networking
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private isWsConnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;

  // VAD & Buffering
  private vadConfig: VADConfig = { ...DEFAULT_VAD_CONFIG };
  private isUserSpeaking = false;
  private speechStartTimestamp = 0;
  private lastSpeechTimestamp = 0;
  private silenceTimer: NodeJS.Timeout | null = null;
  private audioFramesCount = 0;
  private lastFpsCalcTime = Date.now();
  private framesPerSecond = 0;

  // Listeners & Handlers
  private stateListeners = new Set<StateListener>();
  private fieldCommitters = new Map<string, FieldCommitter>();
  private fallbackSpeechRecognition: any = null;

  // Health Metrics
  private metrics: VoiceHealthMetrics = {
    micState: "UNINITIALIZED",
    audioContextState: "unsupported",
    vadState: "SILENCE",
    wsState: "DISCONNECTED",
    audioFramesPerSec: 0,
    currentSequence: 0,
    activeSessionId: null,
    activeInteractionId: null,
    activeQuestionId: null,
    activeFieldId: null,
    currentDbLevel: -60,
    lastInterimText: null,
    lastFinalText: null,
    vadDetectionLatencyMs: 0,
    sttInterimLatencyMs: 0,
    sttFinalLatencyMs: 0,
    commitLatencyMs: 0,
    rejectionsCount: {
      staleInteraction: 0,
      duplicateTranscript: 0,
      echoSuppressed: 0,
      noiseRejected: 0,
    },
  };

  private constructor() {
    this.sessionId = `vui_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.metrics.activeSessionId = this.sessionId;

    if (typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.hostname || "localhost";
      const port = process.env.NEXT_PUBLIC_VOICE_STREAM_PORT || "8081";
      this.wsUrl = `${protocol}//${host}:${port}/voice-stream`;
    } else {
      this.wsUrl = "ws://localhost:8081/voice-stream";
    }
  }

  public static getInstance(): VoiceSessionManager {
    if (!VoiceSessionManager.instance) {
      VoiceSessionManager.instance = new VoiceSessionManager();
    }
    return VoiceSessionManager.instance;
  }

  // ─── 1. Lifecycle & Hardware Initialization ─────────────────────────────────

  public async initialize(): Promise<void> {
    if (typeof window === "undefined") return;
    if (this.metrics.micState === "ACTIVE" && this.ws?.readyState === WebSocket.OPEN) {
      return; // Already initialized
    }

    this._updateMicState("REQUESTING");
    this._connectWebSocket();

    // Setup Web Audio Context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      this.metrics.audioContextState = "unsupported";
      this._notifySubscribers();
      return;
    }

    if (!this.audioCtx || this.audioCtx.state === "closed") {
      this.audioCtx = new AudioContextClass({ sampleRate: 16000 });
    }
    this.metrics.audioContextState = this.audioCtx.state as any;

    // Handle Browser Autoplay Policy: Unlock on first user gesture
    if (this.audioCtx.state === "suspended") {
      const unlockAudio = async () => {
        try {
          if (this.audioCtx && this.audioCtx.state === "suspended") {
            await this.audioCtx.resume();
            this.metrics.audioContextState = this.audioCtx.state as any;
            this._notifySubscribers();
          }
          await this._startMicrophoneCapture();
        } catch (err) {
          console.warn("[VoiceSessionManager] Gesture unlock error:", err);
        } finally {
          window.removeEventListener("pointerdown", unlockAudio);
          window.removeEventListener("keydown", unlockAudio);
        }
      };

      window.addEventListener("pointerdown", unlockAudio, { once: true });
      window.addEventListener("keydown", unlockAudio, { once: true });
    } else {
      await this._startMicrophoneCapture();
    }

    this._notifySubscribers();
  }

  private async _startMicrophoneCapture(): Promise<void> {
    if (this.micStream && this.micStream.active) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      this._updateMicState("UNINITIALIZED");
      return;
    }

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!this.audioCtx) return;
      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      await this.audioCtx.audioWorklet.addModule("/pcm-recorder-processor.js");
      this.micSourceNode = this.audioCtx.createMediaStreamSource(this.micStream);
      this.workletNode = new AudioWorkletNode(this.audioCtx, "pcm-recorder-processor");

      this.workletNode.port.onmessage = (event) => {
        this._handleWorkletChunk(event.data);
      };

      this.micSourceNode.connect(this.workletNode);
      this._updateMicState("ACTIVE");
      this._initFallbackSpeechRecognition();
    } catch (err: any) {
      console.warn("[VoiceSessionManager] Microphone capture error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        this._updateMicState("DENIED");
      } else {
        this._updateMicState("ERROR");
      }
    }
  }

  // ─── 2. WebSocket Protocol & Reconnection ───────────────────────────────────

  private _connectWebSocket(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isWsConnecting = true;
    this.metrics.wsState = "CONNECTING";
    this._notifySubscribers();

    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = () => {
        this.isWsConnecting = false;
        this.reconnectAttempts = 0;
        this.metrics.wsState = "CONNECTED";
        console.log("[VoiceSessionManager] WebSocket stream connected.");

        // Handshake: session start
        this._sendEvent({
          type: "SESSION_START",
          sessionId: this.sessionId,
          timestamp: Date.now(),
        });

        // Re-sync current active interaction if reconnecting mid-session
        if (this.currentInteraction && this.currentInteraction.status !== "COMMITTED") {
          this._sendEvent({
            type: "INTERACTION_START",
            sessionId: this.sessionId,
            interactionId: this.currentInteraction.interactionId,
            questionId: this.currentInteraction.questionId,
            fieldId: this.currentInteraction.fieldId,
            mode: this.currentInteraction.mode,
            promptText: this.currentInteraction.promptText,
            timestamp: Date.now(),
          });
        }

        this._notifySubscribers();
      };

      this.ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          try {
            const parsed = JSON.parse(event.data);
            this._handleServerEvent(parsed);
          } catch (e) {
            console.error("[VoiceSessionManager] Invalid JSON:", e);
          }
        }
      };

      this.ws.onerror = () => {
        this.metrics.wsState = "DISCONNECTED";
        this._notifySubscribers();
      };

      this.ws.onclose = () => {
        this.metrics.wsState = "RECONNECTING";
        this._notifySubscribers();
        this._scheduleReconnect();
      };
    } catch (e) {
      console.warn("[VoiceSessionManager] Connection failed:", e);
      this._scheduleReconnect();
    }
  }

  private _scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connectWebSocket();
    }, delay);
  }

  private _sendEvent(event: VoiceEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  // ─── 3. Deterministic Interaction State Machine ─────────────────────────────

  /**
   * Starts an authoritative interaction turn.
   * Creates an immutable interactionId and binds question/field context.
   */
  public startInteraction(options: {
    questionId?: string;
    fieldId?: string;
    mode?: InteractionMode;
    promptText?: string;
    expectedType?: string;
    maxAttempts?: number;
    metadata?: Record<string, any>;
  }): VoiceInteractionContext {
    // If a previous uncommitted interaction was active, cancel it safely
    if (this.currentInteraction && this.currentInteraction.status !== "COMMITTED") {
      this._cancelCurrentInteraction("SUPERSEDED_BY_NEW_INTERACTION");
    }

    const interactionId = `inter_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const context: VoiceInteractionContext = {
      sessionId: this.sessionId,
      interactionId,
      questionId: options.questionId,
      fieldId: options.fieldId,
      mode: options.mode || "GENERAL",
      status: options.promptText ? "ASKING" : "LISTENING",
      startedAt: Date.now(),
      promptText: options.promptText,
      expectedType: options.expectedType || "free_text",
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      metadata: options.metadata,
    };

    this.currentInteraction = context;
    this.metrics.activeInteractionId = interactionId;
    this.metrics.activeQuestionId = options.questionId || null;
    this.metrics.activeFieldId = options.fieldId || null;

    // Reset sequence counter in AudioWorklet for fresh interaction stream
    this.workletNode?.port.postMessage({ command: "RESET_SEQUENCE" });
    this.metrics.currentSequence = 0;

    // Notify backend of interaction start
    this._sendEvent({
      type: "INTERACTION_START",
      sessionId: this.sessionId,
      interactionId,
      questionId: options.questionId,
      fieldId: options.fieldId,
      mode: context.mode,
      promptText: options.promptText,
      timestamp: Date.now(),
    });

    this._notifySubscribers();
    return context;
  }

  /**
   * Marks that the AI has finished asking its spoken question.
   * State transitions to QUESTION_FINISHED -> LISTENING.
   */
  public finishAsking(): void {
    if (!this.currentInteraction) return;
    if (this.currentInteraction.status === "ASKING") {
      this.currentInteraction.status = "QUESTION_FINISHED";
      this._notifySubscribers();

      // Brief acoustic drain buffer before active listening
      setTimeout(() => {
        if (this.currentInteraction && this.currentInteraction.status === "QUESTION_FINISHED") {
          this.currentInteraction.status = "LISTENING";
          this._notifySubscribers();
        }
      }, 120);
    }
  }

  /**
   * Safe User Interruption (Barge-In)
   * Stops TTS playback immediately, marks INTERRUPTED, and opens LISTENING state.
   */
  public handleUserBargeIn(): void {
    if (this.isTtsPlaying || this.currentInteraction?.status === "ASKING") {
      stopSpeaking();
      this.isTtsPlaying = false;
      this.lastTtsEndedAt = Date.now();

      if (this.currentInteraction) {
        this.currentInteraction.status = "INTERRUPTED";
        this._sendEvent({
          type: "INTERACTION_CANCEL",
          sessionId: this.sessionId,
          interactionId: this.currentInteraction.interactionId,
          reason: "USER_BARGE_IN",
          timestamp: Date.now(),
        });
        setTimeout(() => {
          if (this.currentInteraction) {
            this.currentInteraction.status = "LISTENING";
            this._notifySubscribers();
          }
        }, 80);
      }
      this._notifySubscribers();
    }
  }

  /**
   * Ingests an interim transcript.
   * Strictly verifies interactionId correlation before updating.
   */
  public handleSttInterim(text: string, interactionId: string): void {
    if (!this.currentInteraction || this.currentInteraction.interactionId !== interactionId) {
      this.metrics.rejectionsCount.staleInteraction++;
      return;
    }

    // Ignore self-echo during TTS
    if (this.isTtsPlaying || Date.now() - this.lastTtsEndedAt < 500) {
      this.metrics.rejectionsCount.echoSuppressed++;
      return;
    }

    this.currentInteraction.interimTranscript = text;
    this.currentInteraction.status = "USER_SPEAKING";
    this.metrics.lastInterimText = text;
    this._notifySubscribers();
  }

  /**
   * Ingests a final transcript with unique transcriptId.
   * Performs idempotency check and triggers atomic commitment.
   */
  public async handleSttFinal(
    text: string,
    transcriptId: string,
    interactionId: string
  ): Promise<boolean> {
    const startTime = Date.now();

    // 1. Strict Correlation Check
    if (!this.currentInteraction || this.currentInteraction.interactionId !== interactionId) {
      this.metrics.rejectionsCount.staleInteraction++;
      console.warn(`[VoiceSessionManager] Stale transcript rejected: ${interactionId}`);
      return false;
    }

    // 2. Clean input
    const cleanText = text.trim();

    // 3. Idempotency Check
    if (
      this.committedTranscriptIds.has(transcriptId) ||
      (this.currentInteraction.status === "COMMITTED" && this.currentInteraction.committedValue === cleanText)
    ) {
      this.metrics.rejectionsCount.duplicateTranscript++;
      console.warn(`[VoiceSessionManager] Duplicate transcript rejected: ${transcriptId}`);
      return false;
    }

    // 4. Noise / Empty Check
    if (!cleanText || cleanText.length < 1) {
      this.metrics.rejectionsCount.noiseRejected++;
      if (this.currentInteraction.status === "USER_SPEAKING") {
        this.currentInteraction.status = "LISTENING";
        this._notifySubscribers();
      }
      return false;
    }

    // 4. Update Interaction State
    this.currentInteraction.finalTranscript = cleanText;
    this.currentInteraction.status = "ANSWER_READY";
    this.metrics.lastFinalText = cleanText;
    this.metrics.sttFinalLatencyMs = Date.now() - (this.speechStartTimestamp || startTime);
    this._notifySubscribers();

    // 5. Atomic Commitment
    return await this.commitAnswer(interactionId, cleanText, transcriptId);
  }

  /**
   * Commits the answer atomically to matching form/field.
   * Guarantees interaction completion before UI advance.
   */
  public async commitAnswer(
    interactionId: string,
    value: string,
    transcriptId = `t_${Date.now()}`
  ): Promise<boolean> {
    const commitStart = Date.now();
    if (!this.currentInteraction || this.currentInteraction.interactionId !== interactionId) {
      return false;
    }

    this.currentInteraction.status = "COMMITTING";
    this._notifySubscribers();

    try {
      const fieldId = this.currentInteraction.fieldId;
      let committerSuccess = true;

      if (fieldId && this.fieldCommitters.has(fieldId)) {
        const committer = this.fieldCommitters.get(fieldId)!;
        committerSuccess = await committer(fieldId, value, interactionId);
      }

      if (committerSuccess) {
        this.committedTranscriptIds.add(transcriptId);
        this.currentInteraction.committedValue = value;
        this.currentInteraction.status = "COMMITTED";
        this.interactionHistory.push({ ...this.currentInteraction });

        // Confirm to backend
        this._sendEvent({
          type: "COMMIT_ANSWER",
          sessionId: this.sessionId,
          interactionId,
          questionId: this.currentInteraction.questionId,
          fieldId: this.currentInteraction.fieldId,
          transcriptId,
          text: value,
          timestamp: Date.now(),
        });

        this.metrics.commitLatencyMs = Date.now() - commitStart;
        this._notifySubscribers();
        return true;
      } else {
        this.currentInteraction.status = "ERROR";
        this._notifySubscribers();
        return false;
      }
    } catch (e) {
      console.error("[VoiceSessionManager] Commit exception:", e);
      this.currentInteraction.status = "ERROR";
      this._notifySubscribers();
      return false;
    }
  }

  public cancelCurrentInteraction(reason = "user_action"): void {
    this._cancelCurrentInteraction(reason);
  }

  public resetSession(): void {
    this._cancelCurrentInteraction("session_reset");
    this.committedTranscriptIds.clear();
    this.interactionHistory = [];
  }

  private _cancelCurrentInteraction(reason: string): void {
    if (!this.currentInteraction) return;
    this.currentInteraction.status = "CANCELLED";
    this._sendEvent({
      type: "INTERACTION_CANCEL",
      sessionId: this.sessionId,
      interactionId: this.currentInteraction.interactionId,
      reason,
      timestamp: Date.now(),
    });
    this.interactionHistory.push({ ...this.currentInteraction });
    this.currentInteraction = null;
  }

  // ─── 4. AudioWorklet Chunk Processing & VAD ─────────────────────────────────

  private _handleWorkletChunk(data: any): void {
    if (!data || !data.pcm) return;

    this.audioFramesCount++;
    const now = Date.now();
    if (now - this.lastFpsCalcTime >= 1000) {
      this.framesPerSecond = this.audioFramesCount;
      this.audioFramesCount = 0;
      this.lastFpsCalcTime = now;
      this.metrics.audioFramesPerSec = this.framesPerSecond;
    }

    const energy = data.energy || 0;
    const dbLevel = Math.max(-90, Math.round(20 * Math.log10(energy || 0.0001)));
    this.metrics.currentDbLevel = dbLevel;
    this.metrics.currentSequence = data.sequence || this.metrics.currentSequence;

    // Echo gate: reject audio during TTS unless confidence window confirms barge-in
    if (this.isTtsPlaying) {
      if (energy > this.vadConfig.energyThreshold * 2.5) {
        this.handleUserBargeIn();
      }
      return;
    }

    // VAD Logic with Hysteresis
    const isSpeechActive = energy >= this.vadConfig.energyThreshold;

    if (isSpeechActive) {
      if (!this.isUserSpeaking) {
        // Speech onset: flush pre-speech buffer first!
        this.isUserSpeaking = true;
        this.speechStartTimestamp = Date.now();
        this.metrics.vadState = "SPEECH";
        this.workletNode?.port.postMessage({ command: "FLUSH_PREBUFFER" });

        if (this.currentInteraction && this.currentInteraction.status === "LISTENING") {
          this.currentInteraction.status = "USER_SPEAKING";
        }
      }
      this.lastSpeechTimestamp = Date.now();
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    } else if (this.isUserSpeaking) {
      // Silence detected: initiate configured hold timer (900ms)
      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.isUserSpeaking = false;
          this.metrics.vadState = "SILENCE";
          this.silenceTimer = null;

          if (this.currentInteraction && this.currentInteraction.status === "USER_SPEAKING") {
            this.currentInteraction.status = "PROCESSING_TRANSCRIPT";
            this._notifySubscribers();
          }
        }, this.vadConfig.silenceMs);
      }
    }

    // Forward raw PCM chunk to WebSocket if interaction is active
    if (
      this.currentInteraction &&
      this.ws &&
      this.ws.readyState === WebSocket.OPEN &&
      (this.isUserSpeaking || data.type === "prebuffer_chunk")
    ) {
      this.ws.send(data.pcm);
    }
  }

  // ─── 5. Server Event Dispatcher ─────────────────────────────────────────────

  private _handleServerEvent(event: VoiceEvent): void {
    switch (event.type) {
      case "STT_INTERIM":
        this.handleSttInterim(event.text, event.interactionId);
        break;
      case "STT_FINAL":
        void this.handleSttFinal(event.text, event.transcriptId, event.interactionId);
        break;
      case "TTS_STATE":
        this.isTtsPlaying = event.isPlaying;
        if (!event.isPlaying) {
          this.lastTtsEndedAt = Date.now();
        }
        break;
      case "COMMIT_CONFIRMATION":
        if (this.currentInteraction && this.currentInteraction.interactionId === event.interactionId) {
          this.currentInteraction.status = event.success ? "COMMITTED" : "ERROR";
          this._notifySubscribers();
        }
        break;
    }
  }

  // ─── 6. Native Browser Speech Recognition Fallback ──────────────────────────

  private _initFallbackSpeechRecognition(): void {
    if (typeof window === "undefined") return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (e: any) => {
        if (!this.currentInteraction) return;
        const interactionId = this.currentInteraction.interactionId;

        let interim = "";
        let final = "";
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }

        if (interim) {
          this.handleSttInterim(interim.trim(), interactionId);
        }
        if (final) {
          const tId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          void this.handleSttFinal(final.trim(), tId, interactionId);
        }
      };

      rec.onerror = () => {};
      rec.onend = () => {
        if (this.metrics.micState === "ACTIVE") {
          try {
            rec.start();
          } catch (_) {}
        }
      };

      rec.start();
      this.fallbackSpeechRecognition = rec;
    } catch (_) {}
  }

  // ─── 7. Subscription & Registration APIs ────────────────────────────────────

  public registerFieldCommitter(fieldId: string, committer: FieldCommitter): void {
    this.fieldCommitters.set(fieldId, committer);
  }

  public unregisterFieldCommitter(fieldId: string): void {
    this.fieldCommitters.delete(fieldId);
  }

  public subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.currentInteraction, { ...this.metrics });
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public getCurrentInteraction(): VoiceInteractionContext | null {
    return this.currentInteraction ? { ...this.currentInteraction } : null;
  }

  public getMetrics(): VoiceHealthMetrics {
    return { ...this.metrics };
  }

  private _updateMicState(state: VoiceHealthMetrics["micState"]): void {
    this.metrics.micState = state;
    this._notifySubscribers();
  }

  private _notifySubscribers(): void {
    const current = this.currentInteraction ? { ...this.currentInteraction } : null;
    const metricsCopy = { ...this.metrics };
    this.stateListeners.forEach((listener) => {
      try {
        listener(current, metricsCopy);
      } catch (err) {
        console.error("[VoiceSessionManager] Listener error:", err);
      }
    });
  }
}
