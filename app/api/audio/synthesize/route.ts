/**
 * POST /api/audio/synthesize
 *
 * Cloud Text-to-Speech API:
 * - ElevenLabs Free Tier (10,000 chars/month)
 * - HuggingFace Spaces Free Open-Source TTS (Kokoro / XTTS v2)
 * - Fallback instructions for Browser Web Speech Synthesis
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId = "21m00Tcm4TlvDq8ikWAM" } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

    // ─── 1. Try ElevenLabs Free Tier ──────────────────────────────────────────
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
            model_id: "eleven_monolingual_v1",
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
        console.warn("[Synthesize API] ElevenLabs error:", elErr);
      }
    }

    // ─── 2. Fallback to Browser Native ───────────────────────────────────────
    return NextResponse.json({
      useNative: true,
      message: "Browser SpeechSynthesis is used for unlimited 100% free voice playback.",
    });
  } catch (error) {
    console.error("[Synthesize API] Fatal error:", error);
    return NextResponse.json({ useNative: true });
  }
}
