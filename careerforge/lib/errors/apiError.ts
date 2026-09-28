/**
 * lib/errors/apiError.ts
 * Standardized API Error Handling for CareerForge.
 *
 * Implements:
 * - Uniform error response schema: { success: false, error: { code, message, requestId, details? } }
 * - Safe sanitization (no credentials, secret keys, SQL queries, or raw stack traces exposed in production)
 * - HTTP status code mapping
 */

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA"
  | "UNPROCESSABLE_ENTITY"
  | "RATE_LIMITED"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_RATE_LIMITED"
  | "AI_VALIDATION_ERROR"
  | "PROVIDER_TIMEOUT"
  | "UPSTREAM_PROVIDER_ERROR"
  | "DATABASE_ERROR"
  | "INTERNAL_ERROR";

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    details?: unknown;
    retryable?: boolean;
  };
}

export const HTTP_STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA: 415,
  UNPROCESSABLE_ENTITY: 422,
  RATE_LIMITED: 429,
  AI_PROVIDER_UNAVAILABLE: 503,
  AI_RATE_LIMITED: 429,
  AI_VALIDATION_ERROR: 502,
  PROVIDER_TIMEOUT: 504,
  UPSTREAM_PROVIDER_ERROR: 502,
  DATABASE_ERROR: 500,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly details?: unknown;

  constructor(
    code: ApiErrorCode,
    message: string,
    options?: {
      statusCode?: number;
      retryable?: boolean;
      details?: unknown;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = options?.statusCode ?? HTTP_STATUS_BY_CODE[code] ?? 500;
    this.retryable = options?.retryable ?? (this.statusCode === 429 || this.statusCode >= 502);
    this.details = options?.details;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Creates a standardized JSON error response.
 */
export function createApiErrorResponse(
  code: ApiErrorCode,
  message: string,
  requestId: string,
  options?: {
    statusCode?: number;
    retryable?: boolean;
    details?: unknown;
  }
): Response {
  const status = options?.statusCode ?? HTTP_STATUS_BY_CODE[code] ?? 500;
  const isRetryable = options?.retryable ?? (status === 429 || status === 502 || status === 503 || status === 504);

  const body: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      requestId,
      ...(options?.details ? { details: options.details } : {}),
      retryable: isRetryable,
    },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Sanitizes any unknown exception into a safe standardized API error response.
 */
export function handleApiError(
  error: unknown,
  requestId: string,
  fallbackMessage = "An unexpected error occurred while processing your request."
): Response {
  if (error instanceof AppError) {
    return createApiErrorResponse(error.code, error.message, requestId, {
      statusCode: error.statusCode,
      retryable: error.retryable,
      details: error.details,
    });
  }

  const isDev = process.env.NODE_ENV === "development";
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Avoid exposing database connection strings, passwords, or API keys
  const safeMessage =
    isDev && !errorMessage.includes("key") && !errorMessage.includes("password")
      ? errorMessage
      : fallbackMessage;

  return createApiErrorResponse("INTERNAL_ERROR", safeMessage, requestId, {
    statusCode: 500,
    retryable: false,
  });
}
