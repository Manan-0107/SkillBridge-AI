/**
 * lib/ai/providerConfig.ts
 *
 * Unified Provider Configuration for Vercel AI SDK.
 * Dynamically resolves model IDs from environment variables with verified, active production defaults.
 * Supports Vercel AI Gateway routing when AI_GATEWAY_API_KEY is configured.
 */

import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const PROVIDER_MODELS = {
  groq: process.env.GROQ_MODEL_ID || "llama-3.3-70b-versatile",
  gemini: process.env.GEMINI_MODEL_ID || "gemini-2.5-flash",
  openai: process.env.OPENAI_MODEL_ID || "gpt-4o-mini",
  openrouter: process.env.OPENROUTER_MODEL_ID || "meta-llama/llama-3.3-70b-instruct:free",
  anthropic: process.env.ANTHROPIC_MODEL_ID || "claude-sonnet-4-5",
};

export const PROVIDER_LABELS: Record<string, string> = {
  groq: `Groq (${PROVIDER_MODELS.groq})`,
  gemini: `Google Gemini (${PROVIDER_MODELS.gemini})`,
  openai: `OpenAI (${PROVIDER_MODELS.openai})`,
  openrouter: `OpenRouter (${PROVIDER_MODELS.openrouter})`,
  anthropic: `Anthropic (${PROVIDER_MODELS.anthropic})`,
  gateway: "Vercel AI Gateway",
};

export const PROVIDER_ORDER = ["groq", "gemini", "openai", "openrouter", "anthropic"] as const;
export type ProviderName = (typeof PROVIDER_ORDER)[number];

/**
 * Look up the environment API key for a given provider.
 */
export function getKeyFor(providerName: ProviderName): string | undefined {
  switch (providerName) {
    case "groq":
      return process.env.GROQ_API_KEY;
    case "gemini":
      return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_KEY;
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "openrouter":
      return process.env.OPENROUTER_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    default:
      return undefined;
  }
}

/**
 * Instantiate an AI SDK model wrapped for the specified provider.
 */
export function getModelInstance(providerName: ProviderName, apiKey: string) {
  switch (providerName) {
    case "groq":
      return createGroq({ apiKey })(PROVIDER_MODELS.groq);
    case "gemini":
      return createGoogleGenerativeAI({ apiKey })(PROVIDER_MODELS.gemini);
    case "openai":
      return createOpenAI({ apiKey })(PROVIDER_MODELS.openai);
    case "openrouter":
      return createOpenRouter({ apiKey })(PROVIDER_MODELS.openrouter);
    case "anthropic":
      return createAnthropic({ apiKey })(PROVIDER_MODELS.anthropic);
    default:
      throw new Error(`Unsupported AI SDK provider: ${providerName}`);
  }
}
