/**
 * lib/speech/providers/azureSpeechProvider.ts
 *
 * Server-Safe Microsoft Azure AI Speech Provider
 * Uses Azure Cognitive Services REST API for Speech-to-Text, Text-to-Speech, and Language ID.
 * Key & Region are strictly isolated on the backend Node.js server.
 */

import {
  SpeechProvider,
  SpeechOptions,
  SpeechResult,
  AudioResult,
  LanguageResult,
  SpeechError,
} from "../types";
import { getSupportedLanguage, getCandidateLanguageLocales } from "../languages";

export class AzureSpeechProvider implements SpeechProvider {
  public name = "azure" as const;

  private get apiKey(): string | undefined {
    return process.env.AZURE_SPEECH_KEY?.trim();
  }

  private get region(): string {
    return process.env.AZURE_SPEECH_REGION?.trim() || "eastus";
  }

  public isAvailable(): boolean {
    const key = this.apiKey;
    const isExplicitlyEnabled = process.env.SPEECH_ENABLE_AZURE !== "false";
    return Boolean(key && key.length > 5 && isExplicitlyEnabled);
  }

  /**
   * Speech-to-Text via Azure Speech REST API
   */
  public async speechToText(
    audio: Blob | ArrayBuffer,
    options?: SpeechOptions
  ): Promise<SpeechResult> {
    if (!this.isAvailable()) {
      throw {
        type: "authentication",
        message: "Azure Speech key is not configured or disabled.",
        provider: "azure",
      } as SpeechError;
    }

    const langObj = getSupportedLanguage(options?.language || "en");
    const locale = langObj.azureLocale;
    const region = this.region;
    const key = this.apiKey!;

    let buffer: ArrayBuffer;
    let mimeType = "audio/webm";

    if (audio instanceof Blob) {
      mimeType = audio.type || "audio/webm";
      buffer = await audio.arrayBuffer();
    } else {
      buffer = audio;
    }

    // Azure STT REST endpoint
    const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(
      locale
    )}&format=detailed`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": mimeType.includes("wav")
            ? "audio/wav; codecs=audio/pcm; samplerate=16000"
            : mimeType.includes("ogg")
            ? "audio/ogg; codecs=opus"
            : "audio/webm",
          Accept: "application/json",
        },
        body: buffer,
        signal: AbortSignal.timeout(9000),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw {
            type: "authentication",
            message: `Azure authentication failed (HTTP ${res.status}).`,
            provider: "azure",
          } as SpeechError;
        }
        if (res.status === 429) {
          throw {
            type: "quota",
            message: "Azure Speech quota or rate limit exceeded.",
            provider: "azure",
          } as SpeechError;
        }
        throw {
          type: "recognition_failed",
          message: `Azure STT error: HTTP ${res.status}`,
          provider: "azure",
        } as SpeechError;
      }

      const data = await res.json();
      const recognizedText =
        data?.DisplayText ||
        data?.NBest?.[0]?.Display ||
        data?.NBest?.[0]?.Lexical ||
        data?.Text ||
        "";

      const confidence = data?.NBest?.[0]?.Confidence ?? 0.95;

      return {
        text: recognizedText.trim(),
        language: langObj.code,
        confidence,
        provider: "azure",
        isFinal: true,
      };
    } catch (err: any) {
      if (err.type) throw err;
      throw {
        type: err.name === "TimeoutError" ? "network" : "recognition_failed",
        message: err.message || "Azure Speech recognition request failed.",
        provider: "azure",
        originalError: err,
      } as SpeechError;
    }
  }

  /**
   * Text-to-Speech via Azure Speech REST API with SSML
   */
  public async textToSpeech(
    text: string,
    options?: SpeechOptions
  ): Promise<AudioResult> {
    if (!this.isAvailable()) {
      throw {
        type: "authentication",
        message: "Azure Speech key is not configured or disabled.",
        provider: "azure",
      } as SpeechError;
    }

    const langObj = getSupportedLanguage(options?.language || "en");
    const locale = langObj.azureLocale;
    const voiceName = options?.voiceName || langObj.azureVoiceName || `${locale}-JennyNeural`;
    const region = this.region;
    const key = this.apiKey!;

    // Clean text: strip markdown & directives
    const cleanText = text
      .replace(/\[ACTION:.*?\]/g, "")
      .replace(/```[\s\S]*?```/g, "Code block.")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .trim();

    // Construct SSML payload
    const ratePercentage = options?.rate ? `${Math.round((options.rate - 1.0) * 100)}%` : "0%";
    const ssml = `<speak version='1.0' xml:lang='${locale}'>
      <voice xml:lang='${locale}' name='${voiceName}'>
        <prosody rate='${ratePercentage}'>
          ${escapeXml(cleanText)}
        </prosody>
      </voice>
    </speak>`;

    const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
          "User-Agent": "CareerForge-Voice-Assistant",
        },
        body: ssml,
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw {
            type: "authentication",
            message: `Azure TTS auth error (${res.status}).`,
            provider: "azure",
          } as SpeechError;
        }
        throw {
          type: "recognition_failed",
          message: `Azure TTS request failed: HTTP ${res.status}`,
          provider: "azure",
        } as SpeechError;
      }

      const audioBuffer = await res.arrayBuffer();

      return {
        audioBuffer,
        provider: "azure",
        mimeType: "audio/mpeg",
      };
    } catch (err: any) {
      if (err.type) throw err;
      throw {
        type: err.name === "TimeoutError" ? "network" : "recognition_failed",
        message: err.message || "Azure TTS synthesis failed.",
        provider: "azure",
        originalError: err,
      } as SpeechError;
    }
  }

  /**
   * Continuous Language Identification
   */
  public async detectLanguage(
    audio: Blob | ArrayBuffer,
    options?: { candidateLanguages?: string[] }
  ): Promise<LanguageResult> {
    const candidates = options?.candidateLanguages || getCandidateLanguageLocales("en", "azure");

    try {
      const primaryCandidate = candidates[0] || "en-US";
      const result = await this.speechToText(audio, { language: primaryCandidate });
      return {
        language: result.language || "en",
        confidence: result.confidence || 0.9,
        provider: "azure",
      };
    } catch {
      return {
        language: "en",
        confidence: 0.5,
        provider: "azure",
      };
    }
  }
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
