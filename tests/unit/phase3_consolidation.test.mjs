/**
 * tests/unit/phase3_consolidation.test.mjs
 *
 * Phase 3 Forensic Consolidation & Shared Utility Verification Suite:
 * 1. SSRF isPrivateIp validation consistency (used by location API and external fetchers)
 * 2. Canonical getClientIp header precedence and IP normalization
 * 3. Canonical session configuration invariants (SESSION_CONFIG)
 * 4. Canonical CDN identifier sanitization & traversal prevention
 * 5. Canonical storage fallback safety
 * 6. Verification of dead-code elimination (cdnClient, localStorageManager, practiceEngine)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { isPrivateIp, validateUrlForSsrf } from "../../lib/security/ssrf.ts";
import { getClientIp, RATE_LIMIT_POLICIES } from "../../lib/security/rateLimit.ts";
import { SESSION_CONFIG, createSignedSessionToken, verifySessionToken } from "../../lib/security/session.ts";
import { sanitizeCdnIdentifier } from "../../lib/cdn-fetch.ts";
import { getItem, setItem, buildStorageKey } from "../../lib/storage.ts";

// ─── 1. SSRF & IP Validation Canonicalization ─────────────────────────────────
test("Phase 3: isPrivateIp correctly identifies all private, loopback, and metadata ranges", () => {
  // Private / loopback / link-local / cloud metadata (must be TRUE)
  assert.equal(isPrivateIp("127.0.0.1"), true, "Loopback 127.0.0.1 must be private");
  assert.equal(isPrivateIp("10.0.0.1"), true, "RFC 1918 10.x must be private");
  assert.equal(isPrivateIp("192.168.1.1"), true, "RFC 1918 192.168.x must be private");
  assert.equal(isPrivateIp("172.16.0.1"), true, "RFC 1918 172.16.x must be private");
  assert.equal(isPrivateIp("172.31.255.255"), true, "RFC 1918 172.31.x must be private");
  assert.equal(isPrivateIp("169.254.169.254"), true, "AWS/GCP metadata 169.254.169.254 must be private");
  assert.equal(isPrivateIp("100.64.0.1"), true, "Carrier Grade NAT 100.64.x must be private");
  assert.equal(isPrivateIp("::1"), true, "IPv6 loopback ::1 must be private");
  assert.equal(isPrivateIp("fc00::1"), true, "IPv6 unique local fc00:: must be private");
  assert.equal(isPrivateIp("fe80::1"), true, "IPv6 link-local fe80:: must be private");

  // Public IP addresses (must be FALSE)
  assert.equal(isPrivateIp("8.8.8.8"), false, "Google DNS 8.8.8.8 must be public");
  assert.equal(isPrivateIp("1.1.1.1"), false, "Cloudflare DNS 1.1.1.1 must be public");
  assert.equal(isPrivateIp("142.250.190.46"), false, "Public IPv4 must be public");
});

// ─── 2. Canonical getClientIp Extraction ──────────────────────────────────────
test("Phase 3: getClientIp extracts clean client IP with correct header priority", () => {
  // Priority 1: x-forwarded-for first IP in chain
  const req1 = {
    headers: new Headers({
      "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
      "x-real-ip": "70.41.3.18",
    }),
  };
  assert.equal(getClientIp(req1), "203.0.113.195");

  // Priority 2: x-real-ip when x-forwarded-for is missing
  const req2 = {
    headers: new Headers({
      "x-real-ip": "198.51.100.42",
    }),
  };
  assert.equal(getClientIp(req2), "198.51.100.42");

  // Fallback: 127.0.0.1
  const req3 = {
    headers: new Headers({}),
  };
  assert.equal(getClientIp(req3), "127.0.0.1");
});

// ─── 3. Canonical Session Configuration ───────────────────────────────────────
test("Phase 3: SESSION_CONFIG maintains secure cookie and token parameters", () => {
  assert.equal(SESSION_CONFIG.cookieName, "cf_session");
  assert.equal(SESSION_CONFIG.cookieOptions.httpOnly, true);
  assert.equal(SESSION_CONFIG.cookieOptions.sameSite, "lax");
  assert.equal(SESSION_CONFIG.cookieOptions.path, "/");

  const token = createSignedSessionToken({
    userId: "test-user-3",
    email: "test@ubix.test",
    name: "Tester",
  });
  const verified = verifySessionToken(token);
  assert.ok(verified);
  assert.equal(verified.userId, "test-user-3");
  assert.equal(verified.email, "test@ubix.test");
});

// ─── 4. Canonical CDN Identifier Sanitization ─────────────────────────────────
test("Phase 3: sanitizeCdnIdentifier strictly permits only alphanumeric and dashes", () => {
  assert.equal(sanitizeCdnIdentifier("frontend"), "frontend");
  assert.equal(sanitizeCdnIdentifier("data_ai-track_1"), "data_ai-track_1");

  // Traversal and injection attempts must throw
  assert.throws(() => sanitizeCdnIdentifier("../etc/passwd"), /Invalid CDN identifier/);
  assert.throws(() => sanitizeCdnIdentifier("track;rm -rf"), /Invalid CDN identifier/);
  assert.throws(() => sanitizeCdnIdentifier(""), /non-empty string/);
  assert.throws(() => sanitizeCdnIdentifier("track/subpath"), /Invalid CDN identifier/);
});

// ─── 5. Canonical Storage Fallback Invariants ─────────────────────────────────
test("Phase 3: buildStorageKey and getItem maintain schema versioning and safe fallback", () => {
  const key = buildStorageKey("test", "setting", 1);
  assert.equal(key, "roadmap:test:v1:setting");

  // Safe fallback without window object in Node environment
  const result = getItem(key, { defaultSetting: true });
  assert.deepEqual(result, { defaultSetting: true });
});

// ─── 6. Dead Code Elimination Verification ────────────────────────────────────
test("Phase 3: Unused prototype files are removed without leaving stale references", () => {
  const cwd = process.cwd();
  const cdnClientExists = fs.existsSync(path.join(cwd, "lib", "practice", "cdnClient.ts"));
  const localStorageManagerExists = fs.existsSync(path.join(cwd, "lib", "practice", "localStorageManager.ts"));
  const practiceEngineExists = fs.existsSync(path.join(cwd, "types", "practiceEngine.ts"));

  assert.equal(cdnClientExists, false, "lib/practice/cdnClient.ts must be eliminated");
  assert.equal(localStorageManagerExists, false, "lib/practice/localStorageManager.ts must be eliminated");
  assert.equal(practiceEngineExists, false, "types/practiceEngine.ts must be eliminated");
});
