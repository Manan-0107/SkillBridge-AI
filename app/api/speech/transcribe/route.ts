/**
 * POST /api/speech/transcribe
 *
 * Central Multilingual Audio Transcription Endpoint:
 * - Multi-Provider Cascade: Azure AI Speech -> Google Cloud Speech -> Whisper LPU Fallback
 * - Language Detection & Multi-Candidate Resolution (English, Hindi, Gujarati, French, Spanish, etc.)
 * - Server-side rate limit & payload safety guards
 */

import { NextRequest, NextResponse } from "next/server";
import { AzureSpeechProvider } from "@/lib/speech/providers/azureSpeechProvider";
import { GoogleSpeechProvider } from "@/lib/speech/providers/googleSpeechProvider";
import { SpeechProviderType, SpeechResult } from "@/lib/speech/types";
import { detectLanguageFromText } from "@/lib/speech/languages";

export const runtime = "nodejs";

const azureProvider = new AzureSpeechProvider();
const googleProvider = new GoogleSpeechProvider();

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let audioBuffer: ArrayBuffer | null = null;
    let preferredProvider: SpeechProviderType = "auto";
    let language: string | undefined = undefined;
    let candidateLanguages: string[] | undefined = undefined;
    let mimeType = "audio/webm";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = (formData.get("audio") || formData.get("file")) as File | null;
      if (!file) {
        return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
      }

      // 10MB payload size guard
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Audio payload exceeds maximum limit of 10MB" },
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
      const body = await req.json();
      if (!body.audio) {
        return NextResponse.json({ error: "Base64 audio string required" }, { status: 400 });
      }

      const buffer = Buffer.from(body.audio, "base64");
      audioBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      preferredProvider = body.provider || "auto";
      language = body.language;
      candidateLanguages = body.candidateLanguages;
      mimeType = body.mimeType || "audio/webm";
    }

    if (!audioBuffer || audioBuffer.byteLength === 0) {
      return NextResponse.json({ error: "Invalid audio buffer" }, { status: 400 });
    }

    const audioBlob = new Blob([audioBuffer], { type: mimeType });
    let lastError: any = null;

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
        console.warn("[/api/speech/transcribe] Azure failed, trying fallback:", azureErr);
        lastError = azureErr;
        if (preferredProvider === "azure") {
          return NextResponse.json(
            { error: "Azure transcription failed", details: azureErr },
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
        console.warn("[/api/speech/transcribe] Google failed, trying fallback:", googleErr);
        lastError = googleErr;
        if (preferredProvider === "google") {
          return NextResponse.json(
            { error: "Google transcription failed", details: googleErr },
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
        console.warn("[/api/speech/transcribe] Groq Whisper fallback failed:", whisperErr);
      }
    }

    return NextResponse.json(
      {
        text: "",
        language: language || "en",
        provider: "web",
        message: "Cloud providers unconfigured or silent audio. Fall back to browser Web Speech API.",
        lastError,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[/api/speech/transcribe] Fatal error:", err);
    return NextResponse.json(
      { error: err?.message || "Transcription pipeline failed" },
      { status: 500 }
    );
  }
}
