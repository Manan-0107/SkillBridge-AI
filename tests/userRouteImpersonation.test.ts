/**
 * tests/userRouteImpersonation.test.ts
 *
 * Reproduces audit finding C1: `/api/user` trusted `user.email` from the request
 * body to set the `cf_uid` cookie and to fetch user state, so any unauthenticated
 * caller could impersonate any account.
 *
 * Part 1 (always) — the signed-cookie primitive that replaces the bare email.
 *   Before the fix `lib/session.ts` did not exist, so this file's import failed:
 *   that is the reproduction ("no unforgeable session mechanism exists").
 *
 * Part 2 (when TEST_BASE_URL points at a running server) — the HTTP exploit:
 *   an anonymous PUT can no longer mint a cookie, and a forged `cf_uid` can no
 *   longer fetch state.
 *
 * Run:  npx tsx tests/userRouteImpersonation.test.ts
 *   or: TEST_BASE_URL=http://localhost:3123 npx tsx tests/userRouteImpersonation.test.ts
 */
import assert from "node:assert/strict";
import { signSessionCookie, verifySessionCookie } from "../lib/session";

let failures = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`  ok   ${name}`))
    .catch((err) => {
      failures += 1;
      console.error(`  FAIL ${name}\n       ${(err as Error).message}`);
    });
}

async function main() {
  // ── Part 1: the signed session token cannot be forged ────────────────────
  await check("valid token round-trips to its email", () => {
    const tok = signSessionCookie({ email: "alex@example.com" });
    assert.deepEqual(verifySessionCookie(tok), { email: "alex@example.com" });
  });

  await check("a bare email (the old cf_uid value) is rejected", () => {
    // This is exactly what the exploit set: Cookie: cf_uid=victim@example.com
    assert.equal(verifySessionCookie("victim@example.com"), null);
  });

  await check("a tampered payload is rejected", () => {
    const tok = signSessionCookie({ email: "alex@example.com" });
    const [body, sig] = tok.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ email: "victim@example.com", iat: Date.now() })).toString(
      "base64url"
    );
    assert.equal(verifySessionCookie(`${forgedBody}.${sig}`), null, "swapped payload kept old signature");
    assert.equal(verifySessionCookie(`${body}.${sig}x`), null, "mangled signature");
    assert.equal(verifySessionCookie(`${body}.${Buffer.from("garbage").toString("base64url")}`), null);
  });

  await check("empty / malformed tokens are rejected", () => {
    for (const t of [undefined, null, "", "no-dot", ".", "a.", ".b"]) {
      assert.equal(verifySessionCookie(t as string | undefined), null, `accepted ${JSON.stringify(t)}`);
    }
  });

  await check("a stale token is rejected", () => {
    const body = Buffer.from(
      JSON.stringify({ email: "alex@example.com", iat: Date.now() - 40 * 24 * 60 * 60 * 1000 })
    ).toString("base64url");
    // Re-sign so ONLY the age is wrong, not the signature.
    const crypto = require("node:crypto");
    const sig = crypto
      .createHmac("sha256", process.env.SESSION_SECRET || "dev-insecure-careerforge-session-secret-change-me")
      .update(body)
      .digest("base64url");
    assert.equal(verifySessionCookie(`${body}.${sig}`), null);
  });

  // ── Part 2: HTTP exploit against a running server ───────────────────────
  const base = process.env.TEST_BASE_URL;
  if (!base) {
    console.log("\n  (skipping HTTP checks — set TEST_BASE_URL to a running server to run them)");
  } else {
    await check(`anon PUT /api/user cannot mint a session cookie`, async () => {
      const res = await fetch(`${base}/api/user`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user: { email: "victim@example.com" }, state: { hacked: true } }),
      });
      assert.ok([401, 403].includes(res.status), `expected 401/403, got ${res.status}`);
      assert.equal(res.headers.get("set-cookie"), null, "a Set-Cookie header was returned to an anon caller");
    });

    await check(`forged cf_uid cannot fetch another account's state`, async () => {
      const res = await fetch(`${base}/api/user`, {
        headers: { cookie: "cf_uid=victim@example.com" },
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.deepEqual(json, { user: null, state: null }, `leaked: ${JSON.stringify(json)}`);
    });

    await check(`no cookie → anonymous`, async () => {
      const json = await (await fetch(`${base}/api/user`)).json();
      assert.deepEqual(json, { user: null, state: null });
    });
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nall checks passed — impersonation via body/forged-cookie is blocked");
}

main();
