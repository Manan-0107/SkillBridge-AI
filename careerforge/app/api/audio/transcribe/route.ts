/**
 * POST /api/audio/transcribe
 *
 * Cloud Audio Transcription with Groq Cloud Whisper API:
 * - Accepts multipart audio file or raw audio buffer
 * - Model: `whisper-large-v3` on Groq LPU
 * - 10MB payload size guard & sanitized error responses
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
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

    const file = formData.get("file") as File | null;

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

    if (file.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        {
          code: "PAYLOAD_TOO_LARGE",
          message: `Audio file exceeds maximum size limit (${MAX_AUDIO_SIZE / (1024 * 1024)}MB)`,
          retryable: false,
          requestId,
        },
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
        console.warn(`[Transcribe API] Groq Whisper error (${requestId}):`, groqErr);
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
        console.warn(`[Transcribe API] Deepgram error (${requestId}):`, dgErr);
      }
    }

    return NextResponse.json({
      text: "",
      engine: "Browser Native Fallback",
      message: "Cloud STT keys not configured. Use browser native Web Speech API.",
    });
  } catch (error) {
    console.error(`[Transcribe API] Fatal error (${requestId}):`, error);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "Audio transcription failed.",
        retryable: true,
        requestId,
      },
      { status: 500 }
    );
  }
}
