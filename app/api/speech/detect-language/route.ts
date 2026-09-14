/**
 * POST /api/speech/detect-language
 *
 * Backend Language Identification Endpoint:
 * Determines the spoken language of incoming audio using Azure LID, Google alternative languages, or text heuristics.
 */

import { NextRequest, NextResponse } from "next/server";
import { AzureSpeechProvider } from "@/lib/speech/providers/azureSpeechProvider";
import { GoogleSpeechProvider } from "@/lib/speech/providers/googleSpeechProvider";
import { detectLanguageFromText, getSupportedLanguage } from "@/lib/speech/languages";

export const runtime = "nodejs";

const azureProvider = new AzureSpeechProvider();
const googleProvider = new GoogleSpeechProvider();

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body.text) {
        const detected = detectLanguageFromText(body.text);
        const langObj = getSupportedLanguage(detected);
        return NextResponse.json({
          language: langObj.code,
          name: langObj.name,
          confidence: 0.96,
          provider: "text_heuristics",
        });
      }
    }

    const formData = await req.formData();
    const file = (formData.get("audio") || formData.get("file")) as File | null;

    if (!file) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
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
        console.warn("[/api/speech/detect-language] Azure error:", err);
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
        console.warn("[/api/speech/detect-language] Google error:", err);
      }
    }

    return NextResponse.json({
      language: "en",
      confidence: 0.7,
      provider: "web_fallback",
    });
  } catch (err: any) {
    console.error("[/api/speech/detect-language] Error:", err);
    return NextResponse.json({ error: err?.message || "Detection failed" }, { status: 500 });
  }
}
