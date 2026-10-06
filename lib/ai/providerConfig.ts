/**
 * lib/ai/providerConfig.ts
 *
 * Unified Canonical Provider Configuration for UBIX Assistant.
 *
 * Architecture & Security Guarantees:
 * - Canonical AI Provider: OpenAI (gpt-4o-mini / gpt-4o)
 * - Environment Variable: OPENAI_API_KEY (Server-only secret, never leaked)
 * - Deterministic Provider Selection via AI_PROVIDER (defaults to 'openai')
 * - Honest Failure Semantics: If no API key is configured, NEVER fabricate responses
 * - Upstream error classification (Rate Limited, Timeout, Auth Error, Unavailable)
 * - Full Mock AI Provider mode for hermetic unit and integration testing without keys
 */

import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const CANONICAL_PROVIDER = "openai" as const;

export const PROVIDER_MODELS = {
  groq: process.env.GROQ_MODEL_ID || "llama-3.3-70b-versatile",
  gemini: process.env.GEMINI_MODEL || process.env.GEMINI_MODEL_ID || "gemini-3.5-flash-lite",
  openai: process.env.OPENAI_MODEL_ID || "gpt-4o-mini",
  openrouter: process.env.OPENROUTER_MODEL_ID || "meta-llama/llama-3.3-70b-instruct:free",
  anthropic: process.env.ANTHROPIC_MODEL_ID || "claude-sonnet-4-5",
};

export const CANONICAL_MODEL = PROVIDER_MODELS.openai;

export const PROVIDER_LABELS: Record<string, string> = {
  groq: `Groq (${PROVIDER_MODELS.groq})`,
  gemini: `Google Gemini (${PROVIDER_MODELS.gemini})`,
  openai: `OpenAI (${PROVIDER_MODELS.openai})`,
  openrouter: `OpenRouter (${PROVIDER_MODELS.openrouter})`,
  anthropic: `Anthropic (${PROVIDER_MODELS.anthropic})`,
  gateway: "Vercel AI Gateway",
  mock: "Mock Test Provider",
};

export const PROVIDER_ORDER = ["openai", "gemini", "groq", "openrouter", "anthropic"] as const;
export type ProviderName = (typeof PROVIDER_ORDER)[number];

export interface ResolvedProviderInfo {
  provider: ProviderName | "mock";
  apiKey: string | null;
  modelId: string;
  isConfigured: boolean;
  isMock: boolean;
}

/**
 * Look up the environment API key for a given provider.
 * All keys are strictly server-side and never prefixed with NEXT_PUBLIC_.
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
 * Resolves the active AI provider deterministically based on configuration.
 * Canonical provider is 'openai' unless explicitly overridden by AI_PROVIDER.
 * Automatically activates mock mode when UBIX_MOCK_AI=true for hermetic tests.
 */
export function getCanonicalProvider(): ResolvedProviderInfo {
  // Support deterministic mock ONLY in non-production test environment
  if (
    (process.env.UBIX_MOCK_AI === "true" || (process.env.NODE_ENV as string) === "test-mock") &&
    process.env.NODE_ENV !== "production"
  ) {
    return {
      provider: "mock",
      apiKey: "mock-key-for-testing-only",
      modelId: "mock-model",
      isConfigured: true,
      isMock: true,
    };
  }

  // 1. Determine requested provider (defaults to canonical 'openai')
  const rawRequested = (process.env.AI_PROVIDER || CANONICAL_PROVIDER).toLowerCase().trim() as ProviderName;
  const targetProvider: ProviderName = PROVIDER_ORDER.includes(rawRequested) ? rawRequested : CANONICAL_PROVIDER;

  // 2. Check for configured API key
  const key = getKeyFor(targetProvider);
  const isConfigured = Boolean(key && key.trim().length >= 8);

  return {
    provider: targetProvider,
    apiKey: isConfigured ? key!.trim() : null,
    modelId: PROVIDER_MODELS[targetProvider] || PROVIDER_MODELS.openai,
    isConfigured,
    isMock: false,
  };
}

/**
 * Returns safe provider health/status metadata.
 * NEVER exposes API keys, tokens, or authorization headers.
 */
export function getProviderStatus(): {
  provider: string;
  configured: boolean;
  status: "ready" | "not_configured";
  model: string;
} {
  const info = getCanonicalProvider();
  return {
    provider: info.provider,
    configured: info.isConfigured,
    status: info.isConfigured ? "ready" : "not_configured",
    model: info.modelId,
  };
}

/**
 * Maps upstream provider errors into safe, structured API error descriptors.
 */
export function mapProviderError(err: any): {
  code: string;
  statusCode: number;
  message: string;
} {
  const msg = String(err?.message || err || "").toLowerCase();
  const status = err?.status || err?.statusCode || 500;

  if (err?.name === "AbortError" || msg.includes("timeout") || msg.includes("timed out")) {
    return {
      code: "AI_PROVIDER_TIMEOUT",
      statusCode: 504,
      message: "The AI assistant request timed out while communicating with the upstream provider.",
    };
  }

  if (status === 429 || msg.includes("rate limit") || msg.includes("quota")) {
    return {
      code: "AI_PROVIDER_RATE_LIMITED",
      statusCode: 429,
      message: "AI provider rate limit exceeded. Please wait a moment before trying again.",
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    msg.includes("invalid api key") ||
    msg.includes("unauthorized") ||
    msg.includes("authentication") ||
    msg.includes("incorrect api key")
  ) {
    return {
      code: "AI_PROVIDER_AUTH_ERROR",
      statusCode: 502,
      message: "AI provider authentication failed on the server. Please verify your API key.",
    };
  }

  if (
    msg.includes("malformed") ||
    msg.includes("syntaxerror") ||
    msg.includes("invalid json") ||
    msg.includes("unexpected token") ||
    msg.includes("validation error")
  ) {
    return {
      code: "AI_PROVIDER_MALFORMED_RESPONSE",
      statusCode: 502,
      message: "Received an invalid or malformed response from the upstream AI provider.",
    };
  }

  if (
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("connection closed")
  ) {
    return {
      code: "AI_PROVIDER_NETWORK_ERROR",
      statusCode: 502,
      message: "Failed to establish a network connection to the AI provider.",
    };
  }

  return {
    code: "AI_PROVIDER_UNAVAILABLE",
    statusCode: 503,
    message: "The AI assistant is temporarily unavailable. Please try again shortly.",
  };
}

/**
 * Instantiate an AI SDK model wrapped for the specified provider.
 * For OpenAI, explicitly invokes the current Responses API (v1/responses).
 */
export function getModelInstance(providerName: ProviderName, apiKey: string) {
  switch (providerName) {
    case "groq":
      return createGroq({ apiKey })(PROVIDER_MODELS.groq);
    case "gemini":
      return createGoogleGenerativeAI({ apiKey })(PROVIDER_MODELS.gemini);
    case "openai": {
      const client = createOpenAI({ apiKey });
      return typeof client.responses === "function"
        ? client.responses(PROVIDER_MODELS.openai)
        : client(PROVIDER_MODELS.openai);
    }
    case "openrouter":
      return createOpenRouter({ apiKey })(PROVIDER_MODELS.openrouter);
    case "anthropic":
      return createAnthropic({ apiKey })(PROVIDER_MODELS.anthropic);
    default:
      throw new Error(`Unsupported AI SDK provider: ${providerName}`);
  }
}
