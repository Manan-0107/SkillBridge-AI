/**
 * lib/speech/vadManager.ts
 * Real-Time AudioWorklet & Voice Activity Detection (VAD) Manager
 *
 * Captures microphone audio, resamples to 16kHz mono linear PCM in an AudioWorklet,
 * computes visual amplitude for accessibility, and automatically detects speech start/end
 * for Alexa-grade conversational turn-taking.
 */

export interface VADCallbacks {
  onAmplitude?: (level: number) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: (accumulatedPcm: ArrayBuffer) => void;
  onPcmChunk?: (chunk: ArrayBuffer, isSpeaking: boolean) => void;
  onError?: (err: Error) => void;
}

export class VADManager {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private isCapturing = false;
  private callbacks: VADCallbacks = {};
  private pcmChunks: ArrayBuffer[] = [];

  constructor(callbacks?: VADCallbacks) {
    if (callbacks) this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: VADCallbacks) {
    this.callbacks = callbacks;
  }

  public async start(): Promise<void> {
    if (this.isCapturing) return;

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone capture is not supported in this browser environment.");
    }

    try {
      this.pcmChunks = [];
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      this.mediaStream = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      this.audioContext = ctx;

      // Load the 16kHz PCM + VAD AudioWorklet processor
      await ctx.audioWorklet.addModule("/audio-vad-processor.js");

      const source = ctx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(ctx, "audio-vad-processor");
      this.workletNode = worklet;

      worklet.port.onmessage = (event) => {
        const data = event.data;
        if (!data) return;

        if (data.type === "AMPLITUDE") {
          const level = data.level || 0;
          this.callbacks.onAmplitude?.(level);
          // Broadcast to UI components (e.g. FloatingControlBar)
          window.dispatchEvent(
            new CustomEvent("careerforge:amplitude", { detail: { level } })
          );
        } else if (data.type === "VAD_SPEECH_START") {
          this.callbacks.onSpeechStart?.();
          window.dispatchEvent(
            new CustomEvent("careerforge:voice-state", {
              detail: { state: "listening", message: "Listening to user speech" },
            })
          );
        } else if (data.type === "PCM_CHUNK") {
          if (data.buffer) {
            this.pcmChunks.push(data.buffer);
            this.callbacks.onPcmChunk?.(data.buffer, Boolean(data.isSpeaking));
          }
        } else if (data.type === "VAD_SPEECH_END") {
          // Flatten accumulated 16kHz PCM chunks into one buffer for STT
          const totalLength = this.pcmChunks.reduce((acc, c) => acc + c.byteLength, 0);
          const merged = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of this.pcmChunks) {
            merged.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
          }

          // Reset buffer for next utterance
          this.pcmChunks = [];

          this.callbacks.onSpeechEnd?.(merged.buffer);
          window.dispatchEvent(
            new CustomEvent("careerforge:voice-state", {
              detail: { state: "processing", message: "Processing speech..." },
            })
          );
        }
      };

      source.connect(worklet);
      this.isCapturing = true;
    } catch (err: any) {
      this.stop();
      this.callbacks.onError?.(err);
      throw err;
    }
  }

  public stop(): void {
    this.isCapturing = false;

    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch {}
      this.workletNode = null;
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((t) => t.stop());
      } catch {}
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    this.pcmChunks = [];
    window.dispatchEvent(
      new CustomEvent("careerforge:amplitude", { detail: { level: 0 } })
    );
  }

  public isActive(): boolean {
    return this.isCapturing;
  }
}

// Global Singleton
let globalVadManager: VADManager | null = null;

export function getVADManager(callbacks?: VADCallbacks): VADManager {
  if (!globalVadManager) {
    globalVadManager = new VADManager(callbacks);
  } else if (callbacks) {
    globalVadManager.setCallbacks(callbacks);
  }
  return globalVadManager;
}
