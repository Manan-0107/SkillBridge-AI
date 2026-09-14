/**
 * tests/apiAuthGate.test.ts
 *
 * Reproduces audit finding C3: unauthenticated callers could reach every
 * `/api/*` route, including the ones that spend money on third-party AI/email
 * keys and `/api/resume/save` (which trusted a body-supplied `userId`).
 *
 * Before `middleware.ts` existed this file could not import its subject — that
 * import failure IS the reproduction ("no gate exists"). After the fix the
 * assertions below prove the gate blocks anonymous access and rate-limits the
 * expensive routes.
 *
 * Run:  npx tsx tests/apiAuthGate.test.ts
 */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { takeToken, __resetRateLimiter } from "../lib/rateLimit";

const BASE = "http://localhost:3000";
function req(path: string, opts: { method?: string; session?: string; ip?: string } = {}) {
  const headers: Record<string, string> = { "x-forwarded-for": opts.ip ?? "203.0.113.7" };
  if (opts.session) headers.cookie = `cf_uid=${opts.session}`;
  return new NextRequest(new URL(path, BASE), { method: opts.method ?? "POST", headers });
}

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}\n       ${(err as Error).message}`);
  }
}
const passedThrough = (r: Response) => r.headers.get("x-middleware-next") === "1";

async function main() {
  // ── 1. Protected routes reject anonymous callers with 401 ────────────────
  const PROTECTED_POST = [
    "/api/resume/save",
    "/api/resume/analyze",
    "/api/resume/optimize",
    "/api/resume/parse",
    "/api/chat",
    "/api/speech/transcribe",
    "/api/speech/synthesize",
    "/api/audio/transcribe",
    "/api/audio/synthesize",
    "/api/jobs/alert",
  ];
  const PROTECTED_GET = ["/api/jobs", "/api/location", "/api/resources"];
  for (const path of PROTECTED_POST) {
    check(`401 anon POST → ${path}`, () => {
      __resetRateLimiter();
      assert.equal(middleware(req(path)).status, 401);
    });
  }
  for (const path of PROTECTED_GET) {
    check(`401 anon GET → ${path}`, () => {
      __resetRateLimiter();
      assert.equal(middleware(req(path, { method: "GET" })).status, 401);
    });
  }

  // ── 2. Identity subsystem + login-screen voice helper stay reachable ─────
  for (const path of ["/api/user", "/api/user/profile", "/api/user/preferences"]) {
    check(`open → ${path}`, () => {
      __resetRateLimiter();
      assert.ok(passedThrough(middleware(req(path, { method: "GET" }))));
    });
  }
  check(`open (throttled) → anon /api/assistant/chat`, () => {
    __resetRateLimiter();
    assert.ok(passedThrough(middleware(req("/api/assistant/chat"))));
  });

  // ── 3. A valid session cookie lets protected routes through ─────────────
  for (const path of ["/api/resume/save", "/api/resume/analyze", "/api/chat"]) {
    check(`session ok → ${path}`, () => {
      __resetRateLimiter();
      assert.ok(passedThrough(middleware(req(path, { session: "alex@example.com" }))));
    });
  }

  // ── 4. Token-bucket kicks in on the email route (capacity 3) ────────────
  check(`429 after burst → /api/jobs/alert`, () => {
    __resetRateLimiter();
    const statuses = Array.from({ length: 6 }, () =>
      middleware(req("/api/jobs/alert", { session: "spammer@example.com" })).status
    );
    assert.equal(
      statuses.filter((s) => s !== 429).length,
      3,
      `expected 3 allowed (bucket capacity), got ${statuses}`
    );
    assert.ok(statuses.includes(429), "expected a 429 once the bucket drains");
  });

  // ── 5. Anonymous AI helper is IP-throttled (capacity 5) ────────────────
  check(`429 after burst → anon /api/assistant/chat`, () => {
    __resetRateLimiter();
    const statuses = Array.from({ length: 8 }, () =>
      middleware(req("/api/assistant/chat", { ip: "198.51.100.9" })).status
    );
    assert.equal(statuses.filter((s) => s !== 429).length, 5, `expected 5 allowed, got ${statuses}`);
    assert.ok(statuses.includes(429), "expected a 429 once the bucket drains");
  });

  // ── 6. Rate limiter refills over time ─────────────────────────────────
  __resetRateLimiter();
  const rule = { capacity: 1, refillPerSec: 100 };
  const first = takeToken("k", rule).ok;
  const second = takeToken("k", rule).ok;
  await new Promise((r) => setTimeout(r, 40)); // 40ms * 100/s ≈ 4 tokens
  const third = takeToken("k", rule).ok;
  check("takeToken refills over time", () => {
    assert.equal(first, true, "first token available");
    assert.equal(second, false, "bucket empty after one take");
    assert.equal(third, true, "refilled after 40ms wait");
  });

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nall checks passed — anonymous access blocked, expensive routes throttled");
}

main();
