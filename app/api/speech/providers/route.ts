/**
 * GET /api/speech/providers
 *
 * Provider Health & Status Discovery Endpoint:
 * Returns availability, configured keys, and active multi-language capabilities.
 */

import { NextResponse } from "next/server";
import { AzureSpeechProvider } from "@/lib/speech/providers/azureSpeechProvider";
import { GoogleSpeechProvider } from "@/lib/speech/providers/googleSpeechProvider";
import { LANGUAGE_LIST } from "@/lib/speech/languages";
import { SpeechConfig } from "@/lib/speech/types";

export const runtime = "nodejs";

const azure = new AzureSpeechProvider();
const google = new GoogleSpeechProvider();

export async function GET() {
  const defaultProvider = (process.env.SPEECH_DEFAULT_PROVIDER as any) || "auto";
  const azureAvailable = azure.isAvailable();
  const googleAvailable = google.isAvailable();

  const config: SpeechConfig = {
    defaultProvider,
    enableWebSpeech: true,
    enableAzure: azureAvailable,
    enableGoogle: googleAvailable,
    supportedLanguages: LANGUAGE_LIST.map((l) => l.code),
    fallbackEnabled: true,
  };

  return NextResponse.json({
    status: "ok",
    config,
    providers: {
      web: {
        name: "Web Speech API",
        available: true,
        type: "client",
        cost: "Free (Unlimited)",
        priority: 1,
      },
      azure: {
        name: "Microsoft Azure AI Speech",
        available: azureAvailable,
        type: "server",
        priority: 2,
        region: process.env.AZURE_SPEECH_REGION || "eastus",
      },
      google: {
        name: "Google Cloud Speech",
        available: googleAvailable,
        type: "server",
        priority: 3,
      },
    },
    languages: LANGUAGE_LIST.map((l) => ({
      code: l.code,
      name: l.name,
      nativeName: l.nativeName,
      flag: l.flag,
    })),
  });
}
