/**
 * POST /api/speech/synthesize
 *
 * Central Multilingual Text-to-Speech Endpoint:
 * - Multi-Provider Cascade: Microsoft Azure AI Speech -> Google Cloud TTS -> ElevenLabs -> Browser Native TTS
 * - Returns streaming audio/mpeg buffer with audio headers
 */

import { NextRequest, NextResponse } from "next/server";
import { AzureSpeechProvider } from "@/lib/speech/providers/azureSpeechProvider";
import { GoogleSpeechProvider } from "@/lib/speech/providers/googleSpeechProvider";
import { SpeechProviderType } from "@/lib/speech/types";
import { detectLanguageFromText } from "@/lib/speech/languages";

export const runtime = "nodejs";

const azureProvider = new AzureSpeechProvider();
const googleProvider = new GoogleSpeechProvider();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      text,
      language: reqLanguage,
      voiceName,
      provider = "auto",
      rate = 1.0,
      pitch = 1.0,
    }: {
      text: string;
      language?: string;
      voiceName?: string;
      provider?: SpeechProviderType;
      rate?: number;
      pitch?: number;
    } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Text string is required" }, { status: 400 });
    }

    const detectedLanguage = reqLanguage || detectLanguageFromText(text);

    // ─── 1. Azure AI Speech TTS ───────────────────────────────────────────────
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
        console.warn("[/api/speech/synthesize] Azure TTS error:", azureErr);
        if (provider === "azure") {
          return NextResponse.json({ error: "Azure TTS failed", details: azureErr }, { status: 502 });
        }
      }
    }

    // ─── 2. Google Cloud Speech TTS ───────────────────────────────────────────
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
        console.warn("[/api/speech/synthesize] Google TTS error:", googleErr);
        if (provider === "google") {
          return NextResponse.json({ error: "Google TTS failed", details: googleErr }, { status: 502 });
        }
      }
    }

    // ─── 3. ElevenLabs Fallback (if key is configured) ────────────────────────
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (elevenLabsKey && elevenLabsKey.trim().length > 5) {
      try {
        const voiceId = "21m00Tcm4TlvDq8ikWAM";
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: {
            "xi-api-key": elevenLabsKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: text.slice(0, 1000),
            model_id: "eleven_multilingual_v2",
          }),
          signal: AbortSignal.timeout(6000),
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
        console.warn("[/api/speech/synthesize] ElevenLabs fallback error:", elErr);
      }
    }

    // ─── 4. Instruct Client to use Browser Web Speech Synthesis ───────────────
    return NextResponse.json({
      useNative: true,
      language: detectedLanguage,
      provider: "web",
      message: "Browser SpeechSynthesis is used for zero-latency, free voice playback.",
    });
  } catch (err: any) {
    console.error("[/api/speech/synthesize] Fatal error:", err);
    return NextResponse.json({ useNative: true, error: err?.message }, { status: 500 });
  }
}
