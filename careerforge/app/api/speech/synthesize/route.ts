/**
 * POST /api/speech/synthesize
 *
 * Central Multilingual & Multi-Accent Text-to-Speech Endpoint:
 * - Multi-Provider Cascade: Microsoft Azure AI Speech -> Google Cloud TTS -> ElevenLabs -> Sarvam AI -> Browser Native TTS
 * - Accent-aware: Supports global accents and native Indic accents
 * - Request size limits (64KB) and sanitized provider error responses
 */

import { NextRequest, NextResponse } from "next/server";
import { AzureSpeechProvider } from "@/lib/speech/providers/azureSpeechProvider";
import { GoogleSpeechProvider } from "@/lib/speech/providers/googleSpeechProvider";
import { SpeechProviderType } from "@/lib/speech/types";
import { detectLanguageFromText } from "@/lib/speech/languages";
import crypto from "crypto";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 64 * 1024; // 64 KB

const azureProvider = new AzureSpeechProvider();
const googleProvider = new GoogleSpeechProvider();

// Helper to map language code to Sarvam AI supported language codes
function mapToSarvamLanguage(lang?: string): string {
  if (!lang) return "en-IN";
  const code = lang.toLowerCase();
  if (code.startsWith("hi")) return "hi-IN";
  if (code.startsWith("gu")) return "gu-IN";
  if (code.startsWith("bn")) return "bn-IN";
  if (code.startsWith("ta")) return "ta-IN";
  if (code.startsWith("te")) return "te-IN";
  if (code.startsWith("kn")) return "kn-IN";
  if (code.startsWith("mr")) return "mr-IN";
  if (code.startsWith("ml")) return "ml-IN";
  if (code.startsWith("pa")) return "pa-IN";
  if (code.startsWith("od")) return "od-IN";
  return "en-IN";
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
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

    const {
      text,
      language: reqLanguage,
      voiceName,
      provider = "auto",
      rate = 1.0,
      pitch = 1.0,
    }: {
      text?: string;
      language?: string;
      voiceName?: string;
      provider?: SpeechProviderType;
      rate?: number;
      pitch?: number;
    } = body || {};

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        {
          code: "BAD_REQUEST",
          message: "Text string is required.",
          retryable: false,
          requestId,
        },
        { status: 400 }
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        {
          code: "PAYLOAD_TOO_LARGE",
          message: `Text exceeds maximum allowed length (${MAX_TEXT_LENGTH / 1024} KB).`,
          retryable: false,
          requestId,
        },
        { status: 413 }
      );
    }

    const detectedLanguage = reqLanguage || detectLanguageFromText(text);

    // ─── 1. Azure AI Speech TTS ──────────────────────────────────────────────
    if ((provider === "azure" || provider === "auto") && azureProvider.isAvailable()) {
      try {
        const audioResult = await azureProvider.textToSpeech(text, {
          language: detectedLanguage,
          voiceName,
          rate,
          pitch,
        });

        if (audioResult.audioBuffer) {
          return new NextResponse(audioResult.audioBuffer, {
            headers: {
              "Content-Type": audioResult.mimeType || "audio/mpeg",
              "X-Speech-Provider": "azure",
              "X-Detected-Language": detectedLanguage,
            },
          });
        }
      } catch (azureErr) {
        console.warn(`[/api/speech/synthesize] Azure TTS error (${requestId}):`, azureErr);
        if (provider === "azure") {
          return NextResponse.json(
            {
              code: "PROVIDER_UNAVAILABLE",
              message: "Azure speech synthesis is temporarily unavailable.",
              retryable: true,
              requestId,
            },
            { status: 502 }
          );
        }
      }
    }

    // ─── 2. Google Cloud Speech TTS ──────────────────────────────────────────
    if ((provider === "google" || provider === "auto") && googleProvider.isAvailable()) {
      try {
        const audioResult = await googleProvider.textToSpeech(text, {
          language: detectedLanguage,
          voiceName,
          rate,
          pitch,
        });

        if (audioResult.audioBuffer) {
          return new NextResponse(audioResult.audioBuffer, {
            headers: {
              "Content-Type": audioResult.mimeType || "audio/mpeg",
              "X-Speech-Provider": "google",
              "X-Detected-Language": detectedLanguage,
            },
          });
        }
      } catch (googleErr) {
        console.warn(`[/api/speech/synthesize] Google TTS error (${requestId}):`, googleErr);
        if (provider === "google") {
          return NextResponse.json(
            {
              code: "PROVIDER_UNAVAILABLE",
              message: "Google speech synthesis is temporarily unavailable.",
              retryable: true,
              requestId,
            },
            { status: 502 }
          );
        }
      }
    }

    // ─── 3. ElevenLabs AI ───────────────────────────────────────────────────
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (elevenLabsKey && elevenLabsKey.trim().length > 5) {
      try {
        const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: {
            "xi-api-key": elevenLabsKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: text.slice(0, 1000),
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.55,
              similarity_boost: 0.8,
              style: 0.15,
              use_speaker_boost: true,
            },
          }),
          signal: AbortSignal.timeout(7000),
        });

        if (res.ok) {
          const audioBuffer = await res.arrayBuffer();
          return new NextResponse(audioBuffer, {
            headers: {
              "Content-Type": "audio/mpeg",
              "X-Speech-Provider": "elevenlabs",
              "X-Detected-Language": detectedLanguage,
            },
          });
        }
      } catch (elErr) {
        console.warn(`[/api/speech/synthesize] ElevenLabs error (${requestId}):`, elErr);
      }
    }

    // ─── 4. Sarvam AI Multilingual & Indic Accents (Bulbul TTS) ─────────────
    const sarvamKey = process.env.SARVAM_API_KEY;
    if (sarvamKey && sarvamKey.trim().length > 5) {
      try {
        const sarvamLang = mapToSarvamLanguage(detectedLanguage);
        const res = await fetch("https://api.sarvam.ai/text-to-speech", {
          method: "POST",
          headers: {
            "api-subscription-key": sarvamKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: [text.slice(0, 500)],
            target_language_code: sarvamLang,
            speaker: "meera",
            pitch: 0,
            pace: 1.0,
            loudness: 1.5,
            speech_sample_rate: 8000,
            enable_preprocessing: true,
            model: "bulbul:v1",
          }),
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.audios && data.audios.length > 0) {
            const base64Audio = data.audios[0];
            const audioBuffer = Buffer.from(base64Audio, "base64");
            return new NextResponse(audioBuffer, {
              headers: {
                "Content-Type": "audio/wav",
                "X-Speech-Provider": "sarvam",
                "X-Detected-Language": sarvamLang,
              },
            });
          }
        }
      } catch (sarvamErr) {
        console.warn(`[/api/speech/synthesize] Sarvam AI error (${requestId}):`, sarvamErr);
      }
    }

    // ─── 5. Instruct Client to use Browser Web Speech Synthesis ─────────────
    return NextResponse.json({
      useNative: true,
      language: detectedLanguage,
      provider: "web",
      message: "Browser SpeechSynthesis is used for zero-latency, free voice playback.",
    });
  } catch (err) {
    console.error(`[/api/speech/synthesize] Fatal error (${requestId}):`, err);
    return NextResponse.json(
      {
        useNative: true,
        code: "INTERNAL_ERROR",
        message: "Speech synthesis failed; fallback to native voice.",
        retryable: true,
        requestId,
      },
      { status: 500 }
    );
  }
}
