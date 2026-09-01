/**
 * lib/speech/providers/googleSpeechProvider.ts
 *
 * Server-Safe Google Cloud Speech Provider
 * Uses Google Cloud Speech-to-Text v1 and Text-to-Speech v1 REST APIs.
 * Supports multilingual alternative language candidates and secure server execution.
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

export class GoogleSpeechProvider implements SpeechProvider {
  public name = "google" as const;

  private get apiKey(): string | undefined {
    return (
      process.env.GOOGLE_SPEECH_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim()
    );
  }

  public isAvailable(): boolean {
    const key = this.apiKey;
    const isExplicitlyEnabled = process.env.SPEECH_ENABLE_GOOGLE !== "false";
    return Boolean(key && key.length > 5 && isExplicitlyEnabled);
  }

  /**
   * Speech-to-Text via Google Cloud Speech REST API
   */
  public async speechToText(
    audio: Blob | ArrayBuffer,
    options?: SpeechOptions
  ): Promise<SpeechResult> {
    if (!this.isAvailable()) {
      throw {
        type: "authentication",
        message: "Google Speech API key is not configured or disabled.",
        provider: "google",
      } as SpeechError;
    }

    const langObj = getSupportedLanguage(options?.language || "en");
    const locale = langObj.googleLocale;
    const key = this.apiKey!;

    let buffer: ArrayBuffer;
    let mimeType = "audio/webm";

    if (audio instanceof Blob) {
      mimeType = audio.type || "audio/webm";
      buffer = await audio.arrayBuffer();
    } else {
      buffer = audio;
    }

    const base64Audio = Buffer.from(buffer).toString("base64");
    const candidates = options?.candidateLanguages?.length
      ? options.candidateLanguages
      : getCandidateLanguageLocales(langObj.code, "google").filter((l) => l !== locale);

    const url = `https://speech.googleapis.com/v1/speech:recognize?key=${key}`;

    const requestBody = {
      config: {
        encoding: mimeType.includes("wav")
          ? "LINEAR16"
          : mimeType.includes("ogg")
          ? "OGG_OPUS"
          : "WEBM_OPUS",
        sampleRateHertz: mimeType.includes("wav") ? 16000 : 48000,
        languageCode: locale,
        alternativeLanguageCodes: candidates.slice(0, 3),
        enableAutomaticPunctuation: true,
      },
      audio: {
        content: base64Audio,
      },
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(9000),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw {
            type: "authentication",
            message: `Google Speech API auth error (${res.status}).`,
            provider: "google",
          } as SpeechError;
        }
        if (res.status === 429) {
          throw {
            type: "quota",
            message: "Google Speech quota or rate limit exceeded.",
            provider: "google",
          } as SpeechError;
        }
        throw {
          type: "recognition_failed",
          message: `Google Speech STT error: HTTP ${res.status}`,
          provider: "google",
        } as SpeechError;
      }

      const data = await res.json();
      const firstResult = data?.results?.[0]?.alternatives?.[0];
      const recognizedText = firstResult?.transcript || "";
      const confidence = firstResult?.confidence ?? 0.94;
      const detectedLang = data?.results?.[0]?.languageCode || langObj.code;

      return {
        text: recognizedText.trim(),
        language: detectedLang.split("-")[0],
        confidence,
        provider: "google",
        isFinal: true,
      };
    } catch (err: any) {
      if (err.type) throw err;
      throw {
        type: err.name === "TimeoutError" ? "network" : "recognition_failed",
        message: err.message || "Google Cloud Speech recognition request failed.",
        provider: "google",
        originalError: err,
      } as SpeechError;
    }
  }

  /**
   * Text-to-Speech via Google Cloud TTS REST API
   */
  public async textToSpeech(
    text: string,
    options?: SpeechOptions
  ): Promise<AudioResult> {
    if (!this.isAvailable()) {
      throw {
        type: "authentication",
        message: "Google Speech API key is not configured or disabled.",
        provider: "google",
      } as SpeechError;
    }

    const langObj = getSupportedLanguage(options?.language || "en");
    const locale = langObj.googleLocale;
    const voiceName = options?.voiceName || langObj.googleVoiceName;
    const key = this.apiKey!;

    const cleanText = text
      .replace(/\[ACTION:.*?\]/g, "")
      .replace(/```[\s\S]*?```/g, "Code block.")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .trim();

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`;

    const requestBody = {
      input: { text: cleanText },
      voice: {
        languageCode: locale,
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: options?.rate || 1.0,
        pitch: options?.pitch || 0.0,
      },
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw {
            type: "authentication",
            message: `Google TTS auth error (${res.status}).`,
            provider: "google",
          } as SpeechError;
        }
        throw {
          type: "recognition_failed",
          message: `Google TTS error: HTTP ${res.status}`,
          provider: "google",
        } as SpeechError;
      }

      const data = await res.json();
      const audioContent = data?.audioContent;
      if (!audioContent) {
        throw {
          type: "recognition_failed",
          message: "Google TTS returned empty audio content.",
          provider: "google",
        } as SpeechError;
      }

      const buffer = Buffer.from(audioContent, "base64");
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );

      return {
        audioBuffer: arrayBuffer,
        provider: "google",
        mimeType: "audio/mpeg",
      };
    } catch (err: any) {
      if (err.type) throw err;
      throw {
        type: err.name === "TimeoutError" ? "network" : "recognition_failed",
        message: err.message || "Google Cloud TTS synthesis failed.",
        provider: "google",
        originalError: err,
      } as SpeechError;
    }
  }

  /**
   * Language Detection via Google Cloud Speech alternative candidates
   */
  public async detectLanguage(
    audio: Blob | ArrayBuffer,
    options?: { candidateLanguages?: string[] }
  ): Promise<LanguageResult> {
    try {
      const candidates = options?.candidateLanguages || getCandidateLanguageLocales("en", "google");
      const result = await this.speechToText(audio, {
        language: candidates[0],
        candidateLanguages: candidates.slice(1),
      });

      return {
        language: result.language || "en",
        confidence: result.confidence || 0.9,
        provider: "google",
      };
    } catch {
      return {
        language: "en",
        confidence: 0.5,
        provider: "google",
      };
    }
  }
}
