/**
 * lib/observability/redaction.ts
 *
 * Centralized Privacy & Sensitive Data Redaction Engine for UBIX.
 *
 * Invariant: Never logs secrets, passwords, authentication tokens, API keys, or raw PII.
 * Invariant: Never leaks full resume documents, raw audio, or user conversation transcripts.
 */

// Keys whose values must always be completely redacted
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /credential/i,
  /cookie/i,
  /session/i,
  /cf_session/i,
  /cf_uid/i,
  /jwt/i,
  /private[_-]?key/i,
  /resumepath/i,
  /rawresumetext/i,
  /resumetext/i,
  /filebuffer/i,
  /audiobuffer/i,
  /audio_base64/i,
  /email/i,
  /phone/i,
  /disability/i,
  /medical/i,
  /ssn/i,
  /national_id/i,
];

// String pattern matchers for values that contain credentials or sensitive PII
const SENSITIVE_VALUE_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  // OpenAI API Key
  { regex: /sk-[a-zA-Z0-9_-]{20,}/g, replacement: "[REDACTED_OPENAI_KEY]" },
  // Groq API Key
  { regex: /gsk_[a-zA-Z0-9_-]{20,}/g, replacement: "[REDACTED_GROQ_KEY]" },
  // Google / Gemini API Key
  { regex: /AIza[0-9A-Za-z-_]{35}/g, replacement: "[REDACTED_GEMINI_KEY]" },
  // Bearer Token
  { regex: /Bearer\s+[a-zA-Z0-9_\-\.=]+/gi, replacement: "Bearer [REDACTED_TOKEN]" },
  // Email address
  { regex: /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, replacement: "[REDACTED_EMAIL]" },
  // US / International Phone numbers
  { regex: /(?:\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}/g, replacement: "[REDACTED_PHONE]" },
  // Base64 Data URI
  { regex: /data:[a-zA-Z0-9]+\/[a-zA-Z0-9-+.]+;base64,[a-zA-Z0-9+/=]{50,}/g, replacement: "[REDACTED_DATA_URI]" },
];

/**
 * Checks if an object key name implies sensitive content.
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((p) => p.test(key));
}

/**
 * Redacts sensitive patterns in a string value.
 */
export function redactString(str: string): string {
  if (!str || typeof str !== "string") return "";

  // If string looks like a large base64 payload (> 500 chars with no spaces), truncate/redact
  if (str.length > 500 && !str.includes(" ") && !str.includes("\n")) {
    return `[TRUNCATED_BINARY_DATA: ${str.length} bytes]`;
  }

  let sanitized = str;
  for (const { regex, replacement } of SENSITIVE_VALUE_PATTERNS) {
    sanitized = sanitized.replace(regex, replacement);
  }

  return sanitized;
}

/**
 * Deeply redacts any arbitrary object, array, or primitive value, preventing secrets from leaking.
 * Uses a WeakSet to handle circular references safely.
 */
export function safeRedact<T = unknown>(input: T, seen = new WeakSet<object>()): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === "string") {
    return redactString(input) as unknown as T;
  }

  if (typeof input === "number" || typeof input === "boolean" || typeof input === "bigint") {
    return input;
  }

  if (typeof input === "function") {
    return "[Function]" as unknown as T;
  }

  if (typeof input === "object") {
    if (seen.has(input)) {
      return "[Circular]" as unknown as T;
    }
    seen.add(input);

    if (input instanceof Error) {
      return {
        name: input.name,
        message: redactString(input.message),
        stack: input.stack ? redactString(input.stack) : undefined,
        ...(input as any),
      } as unknown as T;
    }

    if (Array.isArray(input)) {
      return input.map((item) => safeRedact(item, seen)) as unknown as T;
    }

    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (isSensitiveKey(key)) {
        output[key] = "[REDACTED]";
      } else if (typeof value === "string") {
        output[key] = redactString(value);
      } else if (typeof value === "object" && value !== null) {
        output[key] = safeRedact(value, seen);
      } else {
        output[key] = value;
      }
    }
    return output as unknown as T;
  }

  return input;
}
