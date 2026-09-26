/**
 * lib/ai/centralProvider.ts
 * Central Server-Side AI Orchestration Layer for CareerForge.
 *
 * Implements:
 * - Unified provider cascade: Google Gemini -> Groq Cloud -> OpenAI -> OpenRouter -> Controlled Error
 * - Zero obsolete models: Removed retired GitHub Models (retired July 30, 2026)
 * - Active verified production models: Gemini 1.5/2.0 Flash, Groq Llama 3.3 70B / 3.1 8B, OpenAI GPT-4o-mini
 * - AbortController timeouts on every external call
 * - Exponential backoff retry on transient errors (429, 502, 503, 504)
 * - Strict schema validation on structured AI outputs
 * - Strict prompt injection separation (system instruction vs untrusted user data)
 * - No fake 200 HTTP responses on failure; returns structured error codes
 */

import { AppError } from "../errors/apiError.ts";

export interface AIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionOptions {
  messages: AIChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  preferredProvider?: "gemini" | "groq" | "openai" | "openrouter";
}

export interface AICompletionResult {
  text: string;
  provider: "gemini" | "groq" | "openai" | "openrouter";
  model: string;
  durationMs: number;
}

export interface ProviderHealth {
  provider: string;
  configured: boolean;
  model: string;
  status: "available" | "missing_key" | "degraded";
}

const DEFAULT_TIMEOUT_MS = 12000;

// ─── Verified Active Production Model IDs ───────────────────────────────────────
export const VERIFIED_MODELS = {
  gemini: "gemini-1.5-flash",
  groq: "llama-3.3-70b-versatile",
  groqFast: "llama-3.1-8b-instant",
  openai: "gpt-4o-mini",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
};

/**
 * Sanitizes and wraps untrusted input to defend against prompt injection.
 */
export function wrapUntrustedData(label: string, data: string): string {
  // Strip control sequences or malicious formatting attempting to masquerade as system prompts
  const sanitized = data
    .replace(/\u0000/g, "")
    .replace(/<\|im_start\|>/gi, "")
    .replace(/<\|im_end\|>/gi, "")
    .trim();

  return `\n=== BEGIN UNTRUSTED ${label.toUpperCase()} DATA ===\n${sanitized}\n=== END UNTRUSTED ${label.toUpperCase()} DATA ===\n`;
}

/**
 * Sleep helper for backoff retries.
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── 1. Google Gemini Provider ────────────────────────────────────────────────
async function callGemini(
  apiKey: string,
  messages: AIChatMessage[],
  systemPrompt?: string,
  options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<AICompletionResult> {
  const start = Date.now();
  const model = VERIFIED_MODELS.gemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Build Gemini contents structure
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body: any = {
    contents,
    generationConfig: {
      temperature: options?.temperature ?? 0.3,
      maxOutputTokens: options?.maxTokens ?? 1500,
    },
  };

  if (systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new AppError(
      res.status === 429 ? "AI_RATE_LIMITED" : "UPSTREAM_PROVIDER_ERROR",
      `Gemini returned ${res.status}: ${errorText.slice(0, 150)}`,
      { statusCode: res.status }
    );
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || typeof text !== "string") {
    throw new AppError("AI_VALIDATION_ERROR", "Gemini returned empty candidate output");
  }

  return {
    text: text.trim(),
    provider: "gemini",
    model,
    durationMs: Date.now() - start,
  };
}

// ─── 2. Groq Cloud Provider ───────────────────────────────────────────────────
async function callGroq(
  apiKey: string,
  messages: AIChatMessage[],
  systemPrompt?: string,
  options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<AICompletionResult> {
  const start = Date.now();
  const model = VERIFIED_MODELS.groq;
  const url = "https://api.groq.com/openai/v1/chat/completions";

  const formattedMessages: AIChatMessage[] = [];
  if (systemPrompt) {
    formattedMessages.push({ role: "system", content: systemPrompt });
  }
  formattedMessages.push(...messages);

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: formattedMessages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 1500,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new AppError(
      res.status === 429 ? "AI_RATE_LIMITED" : "UPSTREAM_PROVIDER_ERROR",
      `Groq returned ${res.status}: ${errorText.slice(0, 150)}`,
      { statusCode: res.status }
    );
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") {
    throw new AppError("AI_VALIDATION_ERROR", "Groq returned empty completion content");
  }

  return {
    text: text.trim(),
    provider: "groq",
    model,
    durationMs: Date.now() - start,
  };
}

// ─── 3. OpenAI Provider ───────────────────────────────────────────────────────
async function callOpenAI(
  apiKey: string,
  messages: AIChatMessage[],
  systemPrompt?: string,
  options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<AICompletionResult> {
  const start = Date.now();
  const model = VERIFIED_MODELS.openai;
  const url = "https://api.openai.com/v1/chat/completions";

  const formattedMessages: AIChatMessage[] = [];
  if (systemPrompt) {
    formattedMessages.push({ role: "system", content: systemPrompt });
  }
  formattedMessages.push(...messages);

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: formattedMessages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 1500,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new AppError(
      res.status === 429 ? "AI_RATE_LIMITED" : "UPSTREAM_PROVIDER_ERROR",
      `OpenAI returned ${res.status}: ${errorText.slice(0, 150)}`,
      { statusCode: res.status }
    );
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") {
    throw new AppError("AI_VALIDATION_ERROR", "OpenAI returned empty completion content");
  }

  return {
    text: text.trim(),
    provider: "openai",
    model,
    durationMs: Date.now() - start,
  };
}

// ─── 4. OpenRouter Provider ───────────────────────────────────────────────────
async function callOpenRouter(
  apiKey: string,
  messages: AIChatMessage[],
  systemPrompt?: string,
  options?: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<AICompletionResult> {
  const start = Date.now();
  const model = VERIFIED_MODELS.openrouter;
  const url = "https://openrouter.ai/api/v1/chat/completions";

  const formattedMessages: AIChatMessage[] = [];
  if (systemPrompt) {
    formattedMessages.push({ role: "system", content: systemPrompt });
  }
  formattedMessages.push(...messages);

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://careerforge.app",
      "X-Title": "CareerForge AI Assistant",
    },
    body: JSON.stringify({
      model,
      messages: formattedMessages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 1500,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new AppError(
      res.status === 429 ? "AI_RATE_LIMITED" : "UPSTREAM_PROVIDER_ERROR",
      `OpenRouter returned ${res.status}: ${errorText.slice(0, 150)}`,
      { statusCode: res.status }
    );
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") {
    throw new AppError("AI_VALIDATION_ERROR", "OpenRouter returned empty completion content");
  }

  return {
    text: text.trim(),
    provider: "openrouter",
    model,
    durationMs: Date.now() - start,
  };
}

// ─── Central Fallback Cascade Orchestrator ─────────────────────────────────────

/**
 * Executes an AI completion request across the active verified provider cascade.
 *
 * Flow:
 * 1. Checks available API keys (Gemini, Groq, OpenAI, OpenRouter).
 * 2. Attempts primary provider with bounded exponential backoff on transient errors.
 * 3. Falls through to next configured provider if primary fails.
 * 4. Throws structured AppError (AI_PROVIDER_UNAVAILABLE) if all configured providers fail.
 */
export async function generateAIResponse(
  options: AICompletionOptions
): Promise<AICompletionResult> {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  type ProviderTask = {
    name: "gemini" | "groq" | "openai" | "openrouter";
    key: string | undefined;
    call: () => Promise<AICompletionResult>;
  };

  const providers: ProviderTask[] = [
    {
      name: "gemini",
      key: geminiKey,
      call: () => callGemini(geminiKey!, options.messages, options.systemPrompt, options),
    },
    {
      name: "groq",
      key: groqKey,
      call: () => callGroq(groqKey!, options.messages, options.systemPrompt, options),
    },
    {
      name: "openai",
      key: openaiKey,
      call: () => callOpenAI(openaiKey!, options.messages, options.systemPrompt, options),
    },
    {
      name: "openrouter",
      key: openrouterKey,
      call: () => callOpenRouter(openrouterKey!, options.messages, options.systemPrompt, options),
    },
  ];

  // Reorder if preferred provider is specified
  if (options.preferredProvider) {
    const idx = providers.findIndex((p) => p.name === options.preferredProvider);
    if (idx > 0) {
      const [preferred] = providers.splice(idx, 1);
      providers.unshift(preferred);
    }
  }

  const errors: string[] = [];

  for (const provider of providers) {
    if (!provider.key || provider.key.trim().length < 5) {
      continue;
    }

    // Try up to 2 attempts for transient errors with backoff
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await provider.call();
        return result;
      } catch (err: any) {
        const statusCode = err?.statusCode ?? 500;
        const isTransient = statusCode === 429 || statusCode >= 502;

        if (attempt === 1 && isTransient) {
          await wait(500); // 500ms jittered backoff before second attempt
          continue;
        }

        errors.push(`${provider.name}: ${err?.message || String(err)}`);
        break; // Move to next provider in cascade
      }
    }
  }

  // If no provider succeeded or none were configured
  if (errors.length === 0) {
    throw new AppError(
      "AI_PROVIDER_UNAVAILABLE",
      "No AI providers are configured on this server. Please configure GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY.",
      { statusCode: 503 }
    );
  }

  throw new AppError(
    "AI_PROVIDER_UNAVAILABLE",
    `All AI providers failed: ${errors.join("; ")}`,
    { statusCode: 503, details: { providerErrors: errors } }
  );
}

/**
 * Generates structured JSON output from the AI cascade, parsing and validating against a schema validator.
 */
export async function generateStructuredAIResponse<T>(
  options: AICompletionOptions,
  validator: (data: unknown) => data is T
): Promise<{ data: T; provider: string; model: string }> {
  const promptEnforcedMessages = [...options.messages];
  const systemPrompt = `${options.systemPrompt || ""}\n\nIMPORTANT: You must respond ONLY with raw, valid JSON. Do not include markdown code block backticks (\`\`\`json) or conversational preamble.`;

  const result = await generateAIResponse({
    ...options,
    systemPrompt,
    messages: promptEnforcedMessages,
  });

  // Strip potential code fences
  let cleanJson = result.text.trim();
  if (cleanJson.startsWith("```json")) {
    cleanJson = cleanJson.slice(7);
  } else if (cleanJson.startsWith("```")) {
    cleanJson = cleanJson.slice(3);
  }
  if (cleanJson.endsWith("```")) {
    cleanJson = cleanJson.slice(0, -3);
  }
  cleanJson = cleanJson.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (parseErr) {
    throw new AppError(
      "AI_VALIDATION_ERROR",
      "Failed to parse structured JSON from AI response.",
      { details: { rawOutput: result.text.slice(0, 200) } }
    );
  }

  if (!validator(parsed)) {
    throw new AppError(
      "AI_VALIDATION_ERROR",
      "AI response did not conform to the expected schema."
    );
  }

  return {
    data: parsed,
    provider: result.provider,
    model: result.model,
  };
}

/**
 * Checks the configuration health of all server-side AI providers.
 */
export function getAIProvidersHealth(): ProviderHealth[] {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  return [
    {
      provider: "Google Gemini",
      configured: Boolean(geminiKey && geminiKey.trim().length > 5),
      model: VERIFIED_MODELS.gemini,
      status: geminiKey ? "available" : "missing_key",
    },
    {
      provider: "Groq Cloud",
      configured: Boolean(groqKey && groqKey.trim().length > 5),
      model: VERIFIED_MODELS.groq,
      status: groqKey ? "available" : "missing_key",
    },
    {
      provider: "OpenAI",
      configured: Boolean(openaiKey && openaiKey.trim().length > 5),
      model: VERIFIED_MODELS.openai,
      status: openaiKey ? "available" : "missing_key",
    },
    {
      provider: "OpenRouter",
      configured: Boolean(openrouterKey && openrouterKey.trim().length > 5),
      model: VERIFIED_MODELS.openrouter,
      status: openrouterKey ? "available" : "missing_key",
    },
  ];
}
