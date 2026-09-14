/**
 * POST /api/audio/synthesize
 *
 * Cloud Text-to-Speech API:
 * - ElevenLabs Multilingual v2
 * - Sarvam AI Indic & Regional Accents (Bulbul TTS)
 * - Request size limits (64KB) and sanitized provider error responses
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 64 * 1024; // 64 KB

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

    const { text, voiceId = "21m00Tcm4TlvDq8ikWAM", language = "en-IN" } = body || {};

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        {
          code: "BAD_REQUEST",
          message: "Text is required",
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

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

    // ─── 1. Try ElevenLabs Multilingual v2 ─────────────────────────────────────
    if (elevenLabsKey && elevenLabsKey.trim().length > 5) {
      try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: {
            "xi-api-key": elevenLabsKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: text.slice(0, 1000),
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const audioBuffer = await res.arrayBuffer();
          return new NextResponse(audioBuffer, {
            headers: {
              "Content-Type": "audio/mpeg",
              "X-Engine": "ElevenLabs",
            },
          });
        }
      } catch (elErr) {
        console.warn(`[Audio Synthesize API] ElevenLabs error (${requestId}):`, elErr);
      }
    }

    // ─── 2. Try Sarvam AI (Indic & Regional Accents) ───────────────────────────
    const sarvamKey = process.env.SARVAM_API_KEY;
    if (sarvamKey && sarvamKey.trim().length > 5) {
      try {
        const res = await fetch("https://api.sarvam.ai/text-to-speech", {
          method: "POST",
          headers: {
            "api-subscription-key": sarvamKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: [text.slice(0, 500)],
            target_language_code: language || "en-IN",
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
            const audioBuffer = Buffer.from(data.audios[0], "base64");
            return new NextResponse(audioBuffer, {
              headers: {
                "Content-Type": "audio/wav",
                "X-Engine": "Sarvam AI",
              },
            });
          }
        }
      } catch (sarvamErr) {
        console.warn(`[Audio Synthesize API] Sarvam error (${requestId}):`, sarvamErr);
      }
    }

    // ─── 3. Fallback to Browser Native ───────────────────────────────────────
    return NextResponse.json({
      useNative: true,
      message: "Browser SpeechSynthesis is used for unlimited 100% free voice playback.",
    });
  } catch (error) {
    console.error(`[Synthesize API] Fatal error (${requestId}):`, error);
    return NextResponse.json({
      useNative: true,
      code: "INTERNAL_ERROR",
      message: "Speech synthesis failed; fallback to native voice.",
      retryable: true,
      requestId,
    });
  }
}
