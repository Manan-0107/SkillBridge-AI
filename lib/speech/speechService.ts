/**
 * lib/speech/speechService.ts
 *
 * Unified Speech Service Orchestrator:
 * - Implements the Unified SpeechProvider Abstraction
 * - Provider Strategy: Web Speech (Primary) -> Azure AI Speech (Secondary) -> Google Cloud Speech (Tertiary)
 * - Auto Mode with Intelligent Error Classification
 * - Client & Server Safe Singleton: `getSpeechService()`
 */

import {
  SpeechProvider,
  SpeechProviderType,
  SpeechOptions,
  SpeechResult,
  AudioResult,
  LanguageResult,
  SpeechError,
} from "./types";
import { WebSpeechProvider } from "./providers/webSpeechProvider";
import { AzureSpeechProvider } from "./providers/azureSpeechProvider";
import { GoogleSpeechProvider } from "./providers/googleSpeechProvider";
import { detectLanguageFromText, getSupportedLanguage } from "./languages";

export class SpeechService implements SpeechProvider {
  public name: SpeechProviderType = "auto";
  private webProvider = new WebSpeechProvider();
  private azureProvider = new AzureSpeechProvider();
  private googleProvider = new GoogleSpeechProvider();
  private selectedProvider: SpeechProviderType = "auto";

  constructor(defaultProvider: SpeechProviderType = "auto") {
    this.selectedProvider = defaultProvider;
  }

  public setProvider(provider: SpeechProviderType) {
    this.selectedProvider = provider;
  }

  public getProvider(): SpeechProviderType {
    return this.selectedProvider;
  }

  public isAvailable(): boolean {
    return (
      this.webProvider.isAvailable() ||
      this.azureProvider.isAvailable() ||
      this.googleProvider.isAvailable()
    );
  }

  /**
   * Unified Speech-to-Text with Automatic Cascade
   */
  public async speechToText(
    audio: Blob | ArrayBuffer,
    options?: SpeechOptions
  ): Promise<SpeechResult> {
    const provider = this.selectedProvider;

    // 1. Explicit Azure selection
    if (provider === "azure") {
      return this.azureProvider.speechToText(audio, options);
    }

    // 2. Explicit Google selection
    if (provider === "google") {
      return this.googleProvider.speechToText(audio, options);
    }

    // 3. Explicit Web selection
    if (provider === "web") {
      return this.webProvider.speechToText(audio, options);
    }

    // ── Auto Mode Cascade (Web -> Azure -> Google) ──
    try {
      if (this.webProvider.isAvailable()) {
        return await this.webProvider.speechToText(audio, options);
      }
    } catch (webErr: any) {
      // Don't fall back silently on microphone permission denial; rethrow so UI can guide user
      if (webErr.type === "permission_denied") {
        throw webErr;
      }
      console.warn("[SpeechService] Web STT failed, falling back to Azure:", webErr);
    }

    try {
      if (this.azureProvider.isAvailable()) {
        return await this.azureProvider.speechToText(audio, options);
      }
    } catch (azureErr) {
      console.warn("[SpeechService] Azure STT failed, falling back to Google:", azureErr);
    }

    try {
      if (this.googleProvider.isAvailable()) {
        return await this.googleProvider.speechToText(audio, options);
      }
    } catch (googleErr) {
      console.warn("[SpeechService] Google STT failed:", googleErr);
    }

    throw {
      type: "recognition_failed",
      message: "All speech recognition providers failed. You can continue using text.",
      provider: "auto",
    } as SpeechError;
  }

  /**
   * Unified Text-to-Speech with Automatic Cascade
   */
  public async textToSpeech(
    text: string,
    options?: SpeechOptions
  ): Promise<AudioResult> {
    const provider = this.selectedProvider;

    // 1. Explicit Azure selection
    if (provider === "azure" && this.azureProvider.isAvailable()) {
      return this.azureProvider.textToSpeech(text, options);
    }

    // 2. Explicit Google selection
    if (provider === "google" && this.googleProvider.isAvailable()) {
      return this.googleProvider.textToSpeech(text, options);
    }

    // 3. Explicit Web selection
    if (provider === "web" && this.webProvider.isSynthesisSupported()) {
      return this.webProvider.textToSpeech(text, options);
    }

    // ── Auto Mode Cascade (Web Native -> Azure -> Google -> Backend /api/speech/synthesize) ──
    if (this.webProvider.isSynthesisSupported()) {
      try {
        return await this.webProvider.textToSpeech(text, options);
      } catch (webErr) {
        console.warn("[SpeechService] Web TTS failed, falling back:", webErr);
      }
    }

    if (this.azureProvider.isAvailable()) {
      try {
        return await this.azureProvider.textToSpeech(text, options);
      } catch (azureErr) {
        console.warn("[SpeechService] Azure TTS failed, falling back to Google:", azureErr);
      }
    }

    if (this.googleProvider.isAvailable()) {
      try {
        return await this.googleProvider.textToSpeech(text, options);
      } catch (googleErr) {
        console.warn("[SpeechService] Google TTS failed:", googleErr);
      }
    }

    // Server-side synthesize route fallback
    try {
      const res = await fetch("/api/speech/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          language: options?.language || detectLanguageFromText(text),
          rate: options?.rate || 1.0,
          pitch: options?.pitch || 1.0,
        }),
      });

      if (res.ok) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("audio")) {
          const audioBuffer = await res.arrayBuffer();
          return {
            audioBuffer,
            provider: (res.headers.get("X-Speech-Provider") as any) || "azure",
            mimeType: ct,
          };
        }
      }
    } catch (fetchErr) {
      console.warn("[SpeechService] Server TTS fallback failed:", fetchErr);
    }

    return {
      provider: "web",
      useNativeSynthesis: true,
    };
  }

  /**
   * Unified Language Detection
   */
  public async detectLanguage(
    audio: Blob | ArrayBuffer,
    options?: { candidateLanguages?: string[] }
  ): Promise<LanguageResult> {
    if (this.azureProvider.isAvailable()) {
      try {
        return await this.azureProvider.detectLanguage(audio, options);
      } catch {}
    }

    if (this.googleProvider.isAvailable()) {
      try {
        return await this.googleProvider.detectLanguage(audio, options);
      } catch {}
    }

    return {
      language: "en",
      confidence: 0.8,
      provider: "web",
    };
  }
}

// ── Singleton Instance ──
let globalSpeechService: SpeechService | null = null;

export function getSpeechService(defaultProvider: SpeechProviderType = "auto"): SpeechService {
  if (!globalSpeechService) {
    globalSpeechService = new SpeechService(defaultProvider);
  }
  return globalSpeechService;
}
