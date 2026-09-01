/**
 * lib/speech/providers/webSpeechProvider.ts
 *
 * Client-Side Web Speech API Provider (Free, Native, Zero Latency)
 * Wraps SpeechRecognition, webkitSpeechRecognition, and SpeechSynthesis
 * with robust error classification and multi-language support.
 */

import {
  SpeechProvider,
  SpeechOptions,
  SpeechResult,
  AudioResult,
  LanguageResult,
  SpeechError,
  SpeechErrorType,
} from "../types";
import { getSupportedLanguage, detectLanguageFromText } from "../languages";

export class WebSpeechProvider implements SpeechProvider {
  public name = "web" as const;

  public isAvailable(): boolean {
    if (typeof window === "undefined") return false;
    return (
      "SpeechRecognition" in window ||
      "webkitSpeechRecognition" in window ||
      "speechSynthesis" in window
    );
  }

  public isRecognitionSupported(): boolean {
    if (typeof window === "undefined") return false;
    return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
  }

  public isSynthesisSupported(): boolean {
    if (typeof window === "undefined") return false;
    return "speechSynthesis" in window;
  }

  /**
   * Transcribe recorded audio Blob by dispatching to backend server cascade
   * (since browser SpeechRecognition only listens to live microphone streams).
   */
  public async speechToText(
    audio: Blob | ArrayBuffer,
    options?: SpeechOptions
  ): Promise<SpeechResult> {
    try {
      const formData = new FormData();
      const blob = audio instanceof Blob ? audio : new Blob([audio], { type: "audio/webm" });
      formData.append("audio", blob, "recording.webm");
      if (options?.language) formData.append("language", options.language);
      formData.append("provider", "auto");

      const res = await fetch("/api/speech/transcribe", {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(9000),
      });

      if (!res.ok) {
        throw new Error(`Transcription endpoint HTTP ${res.status}`);
      }

      const data = await res.json();
      return {
        text: data.text || "",
        language: data.language || options?.language || "en",
        confidence: data.confidence || 0.9,
        provider: data.provider || "web",
        isFinal: true,
      };
    } catch (err: any) {
      throw {
        type: "recognition_failed",
        message: err?.message || "Web Speech audio buffer transcription failed.",
        provider: "web",
        originalError: err,
      } as SpeechError;
    }
  }

  /**
   * Synthesize Speech via Native SpeechSynthesis
   */
  public async textToSpeech(
    text: string,
    options?: SpeechOptions
  ): Promise<AudioResult> {
    if (!this.isSynthesisSupported()) {
      throw {
        type: "unsupported",
        message: "SpeechSynthesis is not supported in this browser.",
        provider: "web",
      } as SpeechError;
    }

    const cleanText = text
      .replace(/\[ACTION:.*?\]/g, "")
      .replace(/```[\s\S]*?```/g, "Code block.")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .trim();

    const targetLangCode = options?.language || detectLanguageFromText(cleanText);
    const langObj = getSupportedLanguage(targetLangCode);
    const locale = langObj.speechSynthesisLocale;

    return new Promise((resolve, reject) => {
      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = locale;
        utterance.rate = options?.rate || 0.98;
        utterance.pitch = options?.pitch || 1.0;
        utterance.volume = options?.volume ?? 1.0;

        const voices = window.speechSynthesis.getVoices();
        const prefix = locale.split("-")[0].toLowerCase();

        const matchingVoice =
          voices.find((v) => v.lang.toLowerCase() === locale.toLowerCase()) ||
          voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ||
          voices.find((v) => v.name.toLowerCase().includes(prefix)) ||
          voices.find((v) => v.name.includes("Google") || v.name.includes("Natural")) ||
          voices[0];

        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }

        utterance.onend = () => {
          resolve({
            provider: "web",
            useNativeSynthesis: true,
          });
        };

        utterance.onerror = (e) => {
          // If cancelled due to intentional stop, resolve gracefully
          if (e.error === "canceled" || e.error === "interrupted") {
            resolve({ provider: "web", useNativeSynthesis: true });
          } else {
            reject({
              type: "recognition_failed",
              message: `Speech synthesis error: ${e.error}`,
              provider: "web",
            } as SpeechError);
          }
        };

        window.speechSynthesis.speak(utterance);
      } catch (err: any) {
        reject({
          type: "recognition_failed",
          message: err?.message || "Speech synthesis execution failed.",
          provider: "web",
        } as SpeechError);
      }
    });
  }

  /**
   * Helper to map raw DOM SpeechRecognition error string to typed SpeechErrorType
   */
  public static mapErrorType(rawError: string): SpeechErrorType {
    switch (rawError) {
      case "not-allowed":
      case "service-not-allowed":
        return "permission_denied";
      case "audio-capture":
      case "no-speech":
        return "recognition_failed";
      case "network":
        return "network";
      case "language-not-supported":
        return "language_not_supported";
      case "bad-grammar":
        return "recognition_failed";
      default:
        return "unknown";
    }
  }
}
