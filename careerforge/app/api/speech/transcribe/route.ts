/**
 * POST /api/speech/transcribe
 *
 * Central Multilingual Audio Transcription Endpoint:
 * - Multi-Provider Cascade: Azure AI Speech -> Google Cloud Speech -> Whisper LPU Fallback
 * - Language Detection & Multi-Candidate Resolution (English, Hindi, Gujarati, French, Spanish, etc.)
 * - Server-side payload size safety guards (10MB) and sanitized error responses
 */

import { NextRequest, NextResponse } from "next/server";
import { AzureSpeechProvider } from "@/lib/speech/providers/azureSpeechProvider";
import { GoogleSpeechProvider } from "@/lib/speech/providers/googleSpeechProvider";
import { SpeechProviderType } from "@/lib/speech/types";
import { detectLanguageFromText } from "@/lib/speech/languages";
import crypto from "crypto";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_BASE64_LENGTH = Math.ceil((MAX_AUDIO_BYTES * 4) / 3) + 1024;

const azureProvider = new AzureSpeechProvider();
const googleProvider = new GoogleSpeechProvider();

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const contentType = req.headers.get("content-type") || "";

    let audioBuffer: ArrayBuffer | null = null;
    let preferredProvider: SpeechProviderType = "auto";
    let language: string | undefined = undefined;
    let candidateLanguages: string[] | undefined = undefined;
    let mimeType = "audio/webm";

    if (contentType.includes("multipart/form-data")) {
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch {
        return NextResponse.json(
          {
            code: "BAD_REQUEST",
            message: "Failed to parse multipart form data.",
            retryable: false,
            requestId,
          },
          { status: 400 }
        );
      }

      const file = (formData.get("audio") || formData.get("file")) as File | null;
      if (!file) {
        return NextResponse.json(
          {
            code: "BAD_REQUEST",
            message: "Audio file is required",
            retryable: false,
            requestId,
          },
          { status: 400 }
        );
      }

      // 10MB payload size guard
      if (file.size > MAX_AUDIO_BYTES) {
        return NextResponse.json(
          {
            code: "PAYLOAD_TOO_LARGE",
            message: `Audio payload exceeds maximum limit of ${MAX_AUDIO_BYTES / (1024 * 1024)}MB`,
            retryable: false,
            requestId,
          },
          { status: 413 }
        );
      }

      audioBuffer = await file.arrayBuffer();
      mimeType = file.type || "audio/webm";
      preferredProvider = (formData.get("provider") as SpeechProviderType) || "auto";
      language = (formData.get("language") as string) || undefined;
      const candidatesRaw = formData.get("candidateLanguages") as string | null;
      if (candidatesRaw) {
        try {
          candidateLanguages = JSON.parse(candidatesRaw);
        } catch {
          candidateLanguages = candidatesRaw.split(",").map((s) => s.trim());
        }
      }
    } else {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          {
            code: "BAD_REQUEST",
            message: "Invalid JSON request payload.",
            retryable: false,
            requestId,
          },
          { status: 400 }
        );
      }

      if (!body?.audio || typeof body.audio !== "string") {
        return NextResponse.json(
          {
            code: "BAD_REQUEST",
            message: "Base64 audio string required",
            retryable: false,
            requestId,
          },
          { status: 400 }
        );
      }

      if (body.audio.length > MAX_BASE64_LENGTH) {
        return NextResponse.json(
          {
            code: "PAYLOAD_TOO_LARGE",
            message: "Audio data exceeds maximum limit of 10MB",
            retryable: false,
            requestId,
          },
          { status: 413 }
        );
      }

      const buffer = Buffer.from(body.audio, "base64");
      audioBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      preferredProvider = body.provider || "auto";
      language = body.language;
      candidateLanguages = body.candidateLanguages;
      mimeType = body.mimeType || "audio/webm";
    }

    if (!audioBuffer || audioBuffer.byteLength === 0) {
      return NextResponse.json(
        {
          code: "BAD_REQUEST",
          message: "Invalid audio buffer",
          retryable: false,
          requestId,
        },
        { status: 400 }
      );
    }

    const audioBlob = new Blob([audioBuffer], { type: mimeType });

    // ─── 1. If Azure explicitly requested or in auto mode ──────────────────────
    if (
      (preferredProvider === "azure" || preferredProvider === "auto") &&
      azureProvider.isAvailable()
    ) {
      try {
        const result = await azureProvider.speechToText(audioBlob, {
          language,
          candidateLanguages,
        });
        if (result.text && result.text.trim()) {
          const autoLang = detectLanguageFromText(result.text);
          return NextResponse.json({
            text: result.text,
            language: result.language || autoLang,
            confidence: result.confidence || 0.95,
            provider: "azure",
          });
        }
      } catch (azureErr) {
        console.warn(`[/api/speech/transcribe] Azure failed (${requestId}):`, azureErr);
        if (preferredProvider === "azure") {
          return NextResponse.json(
            {
              code: "PROVIDER_UNAVAILABLE",
              message: "Azure transcription service is temporarily unavailable.",
              retryable: true,
              requestId,
            },
            { status: 502 }
          );
        }
      }
    }

    // ─── 2. If Google Cloud explicitly requested or in auto mode ───────────────
    if (
      (preferredProvider === "google" || preferredProvider === "auto") &&
      googleProvider.isAvailable()
    ) {
      try {
        const result = await googleProvider.speechToText(audioBlob, {
          language,
          candidateLanguages,
        });
        if (result.text && result.text.trim()) {
          const autoLang = detectLanguageFromText(result.text);
          return NextResponse.json({
            text: result.text,
            language: result.language || autoLang,
            confidence: result.confidence || 0.94,
            provider: "google",
          });
        }
      } catch (googleErr) {
        console.warn(`[/api/speech/transcribe] Google failed (${requestId}):`, googleErr);
        if (preferredProvider === "google") {
          return NextResponse.json(
            {
              code: "PROVIDER_UNAVAILABLE",
              message: "Google transcription service is temporarily unavailable.",
              retryable: true,
              requestId,
            },
            { status: 502 }
          );
        }
      }
    }

    // ─── 3. Groq Cloud Whisper-Large-v3 Fallback (Free & Ultra-Fast) ───────────
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && groqKey.trim().length > 5) {
      try {
        const groqFormData = new FormData();
        groqFormData.append("file", audioBlob, "audio.webm");
        groqFormData.append("model", "whisper-large-v3");
        groqFormData.append("response_format", "json");
        if (language) groqFormData.append("language", language.split("-")[0]);

        const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${groqKey}` },
          body: groqFormData,
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          const data = await res.json();
          const recognizedText = data.text || "";
          const detectedLang = detectLanguageFromText(recognizedText);

          return NextResponse.json({
            text: recognizedText.trim(),
            language: detectedLang,
            confidence: 0.92,
            provider: "groq_whisper",
          });
        }
      } catch (whisperErr) {
        console.warn(`[/api/speech/transcribe] Groq Whisper fallback failed (${requestId}):`, whisperErr);
      }
    }

    // ─── 4. Sarvam AI Multilingual & Indic Speech-to-Text Fallback ──────────
    const sarvamKey = process.env.SARVAM_API_KEY;
    if (sarvamKey && sarvamKey.trim().length > 5) {
      try {
        const sarvamFormData = new FormData();
        sarvamFormData.append("file", audioBlob, "audio.wav");
        sarvamFormData.append("model", "saarika:v2");
        if (language) sarvamFormData.append("language_code", language.includes("-") ? language : `${language}-IN`);

        const res = await fetch("https://api.sarvam.ai/speech-to-text", {
          method: "POST",
          headers: { "api-subscription-key": sarvamKey },
          body: sarvamFormData,
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          const data = await res.json();
          const recognizedText = data.transcript || "";
          if (recognizedText.trim()) {
            const detectedLang = detectLanguageFromText(recognizedText);
            return NextResponse.json({
              text: recognizedText.trim(),
              language: data.language_code || detectedLang,
              confidence: 0.94,
              provider: "sarvam_saarika",
            });
          }
        }
      } catch (sarvamErr) {
        console.warn(`[/api/speech/transcribe] Sarvam AI fallback failed (${requestId}):`, sarvamErr);
      }
    }

    return NextResponse.json(
      {
        text: "",
        language: language || "en",
        provider: "web",
        message: "Cloud providers unconfigured or silent audio. Fall back to browser Web Speech API.",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error(`[/api/speech/transcribe] Fatal error (${requestId}):`, err);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "Transcription pipeline failed.",
        retryable: true,
        requestId,
      },
      { status: 500 }
    );
  }
}
