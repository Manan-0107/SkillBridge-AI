/**
 * POST /api/audio/transcribe
 *
 * Cloud Audio Transcription with Groq Cloud Whisper API (Free Tier):
 * - Accepts multipart audio file or raw audio buffer
 * - Model: `whisper-large-v3` on Groq LPU (lightning-fast inference)
 * - Fallback to Deepgram / browser transcription
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }

    // 10MB payload size guard for serverless memory safety
    const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: "Audio file exceeds maximum size limit (10MB)" },
        { status: 413 }
      );
    }

    const groqKey = process.env.GROQ_API_KEY;

    // ─── 1. Try Groq Cloud Whisper-Large-v3 ──────────────────────────────────
    if (groqKey && groqKey.trim().length > 5) {
      try {
        const groqFormData = new FormData();
        groqFormData.append("file", file, "audio.webm");
        groqFormData.append("model", "whisper-large-v3");
        groqFormData.append("response_format", "json");

        const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
          },
          body: groqFormData,
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          const data = await res.json();
          return NextResponse.json({
            text: data.text || "",
            engine: "Groq Whisper-Large-v3",
          });
        }
      } catch (groqErr) {
        console.warn("[Transcribe API] Groq Whisper error:", groqErr);
      }
    }

    // ─── 2. Deepgram API Fallback ───────────────────────────────────────────
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    if (deepgramKey && deepgramKey.trim().length > 5) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true", {
          method: "POST",
          headers: {
            Authorization: `Token ${deepgramKey}`,
            "Content-Type": file.type || "audio/webm",
          },
          body: arrayBuffer,
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          const data = await res.json();
          const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
          return NextResponse.json({
            text: transcript,
            engine: "Deepgram Nova-2",
          });
        }
      } catch (dgErr) {
        console.warn("[Transcribe API] Deepgram error:", dgErr);
      }
    }

    return NextResponse.json({
      text: "",
      engine: "Browser Native Fallback",
      message: "Cloud STT keys not configured. Use browser native Web Speech API.",
    });
  } catch (error) {
    console.error("[Transcribe API] Fatal error:", error);
    return NextResponse.json(
      { error: "Audio transcription failed" },
      { status: 500 }
    );
  }
}
