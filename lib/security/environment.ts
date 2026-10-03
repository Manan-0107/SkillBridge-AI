/**
 * lib/security/environment.ts
 *
 * Authoritative Environment Classification Helper for UBIX.
 *
 * Security Invariants:
 * - Staging and Preview MUST NOT silently receive local development bypasses.
 * - Staging, Preview, and Production MUST fail closed on missing secrets and distributed infrastructure.
 * - In-memory rate limiting and dev fallback salts are ONLY permitted in local development and test.
 */

export type EnvironmentName = "production" | "staging" | "preview" | "test" | "development";

/**
 * Returns true if running in any deployment tier (production, staging, or preview).
 * In these tiers, fail-closed security, distributed Redis, and real secrets are mandatory.
 */
export function isProductionEnvironment(): boolean {
  const nodeEnv = process.env.NODE_ENV as string | undefined;
  const vercelEnv = process.env.VERCEL_ENV as string | undefined;

  return (
    nodeEnv === "production" ||
    vercelEnv === "production" ||
    nodeEnv === "staging" ||
    vercelEnv === "staging" ||
    vercelEnv === "preview"
  );
}

/**
 * Returns true only in hermetic local development or automated test environments.
 */
export function isLocalDevOrTest(): boolean {
  return !isProductionEnvironment();
}

/**
 * Resolves the canonical environment tier name.
 */
export function getEnvironmentName(): EnvironmentName {
  const nodeEnv = process.env.NODE_ENV as string | undefined;
  const vercelEnv = process.env.VERCEL_ENV as string | undefined;

  if (vercelEnv === "staging" || nodeEnv === "staging") return "staging";
  if (vercelEnv === "preview") return "preview";
  if (vercelEnv === "production") return "production";
  if (nodeEnv === "test") return "test";
  if (nodeEnv === "production") return "production";
  return "development";
}
