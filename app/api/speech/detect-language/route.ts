/**
 * POST /api/speech/detect-language
 *
 * Backend Language Identification Endpoint:
 * Determines the spoken language of incoming audio using Azure LID, Google alternative languages, or text heuristics.
 *
 * Safe request parsing: JSON and FormData are strictly segregated.
 * Payload size limits (64KB text, 10MB audio).
 * Sanitized provider errors.
 */

import { NextRequest, NextResponse } from "next/server";
import { AzureSpeechProvider } from "@/lib/speech/providers/azureSpeechProvider";
import { GoogleSpeechProvider } from "@/lib/speech/providers/googleSpeechProvider";
import { detectLanguageFromText, getSupportedLanguage } from "@/lib/speech/languages";
import crypto from "crypto";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 64 * 1024; // 64 KB
const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10 MB

const azureProvider = new AzureSpeechProvider();
const googleProvider = new GoogleSpeechProvider();

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
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

      if (!body?.text || typeof body.text !== "string" || !body.text.trim()) {
        return NextResponse.json(
          {
            code: "BAD_REQUEST",
            message: "Text string is required for JSON language detection.",
            retryable: false,
            requestId,
          },
          { status: 400 }
        );
      }

      if (body.text.length > MAX_TEXT_LENGTH) {
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

      const detected = detectLanguageFromText(body.text);
      const langObj = getSupportedLanguage(detected);
      return NextResponse.json({
        language: langObj.code,
        name: langObj.name,
        confidence: 0.96,
        provider: "text_heuristics",
      });
    }

    // Handle multipart/form-data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        {
          code: "BAD_REQUEST",
          message: "Failed to parse form data.",
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
          message: "Audio file is required.",
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
          message: `Audio file exceeds maximum limit (${MAX_AUDIO_SIZE / (1024 * 1024)} MB).`,
          retryable: false,
          requestId,
        },
        { status: 413 }
      );
    }

    const audioBlob = new Blob([await file.arrayBuffer()], { type: file.type || "audio/webm" });

    // 1. Try Azure Language Detection
    if (azureProvider.isAvailable()) {
      try {
        const res = await azureProvider.detectLanguage(audioBlob);
        return NextResponse.json({
          language: res.language,
          confidence: res.confidence,
          provider: "azure",
        });
      } catch (err) {
        console.warn(`[/api/speech/detect-language] Azure error (${requestId}):`, err);
      }
    }

    // 2. Try Google Language Detection
    if (googleProvider.isAvailable()) {
      try {
        const res = await googleProvider.detectLanguage(audioBlob);
        return NextResponse.json({
          language: res.language,
          confidence: res.confidence,
          provider: "google",
        });
      } catch (err) {
        console.warn(`[/api/speech/detect-language] Google error (${requestId}):`, err);
      }
    }

    return NextResponse.json({
      language: "en",
      confidence: 0.7,
      provider: "web_fallback",
    });
  } catch (err) {
    console.error(`[/api/speech/detect-language] Error (${requestId}):`, err);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "Failed to detect language.",
        retryable: true,
        requestId,
      },
      { status: 500 }
    );
  }
}
