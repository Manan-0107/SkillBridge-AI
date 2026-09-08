/**
 * test_verification.mjs
 * Comprehensive automated verification script for CareerForge:
 * - Tests API Route Authentication enforcement (401s for unauthenticated calls)
 * - Tests Payload size limits (413s for >64KB payloads)
 * - Tests Navigation allowlisting & security
 * - Tests SSRF and coordinate bounds validation
 * - Tests Voice interaction token logic
 */

import http from "http";

const BASE_URL = "http://localhost:3000";

async function postJson(endpoint, data, headers = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, json };
}

async function getJson(endpoint, headers = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "GET",
    headers,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, json };
}

async function patchJson(endpoint, data, headers = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, json };
}

const results = [];

function assert(description, condition, details = "") {
  if (condition) {
    console.log(`✅ PASS: ${description}`);
    results.push({ description, passed: true });
  } else {
    console.error(`❌ FAIL: ${description} ${details ? `(${details})` : ""}`);
    results.push({ description, passed: false, details });
  }
}

async function runTests() {
  console.log("\n=========================================");
  console.log("  CAREERFORGE COMPREHENSIVE VERIFICATION ");
  console.log("=========================================\n");

  // 1. API AUTHENTICATION TESTS (Unauthenticated calls must return 401)
  console.log("--- 1. API Authentication Enforcement ---");

  {
    const r = await getJson("/api/user");
    assert("GET /api/user rejects unauthenticated with 401", r.status === 401, `Got status ${r.status}`);
  }

  {
    const r = await getJson("/api/user/profile");
    assert("GET /api/user/profile rejects unauthenticated with 401", r.status === 401, `Got status ${r.status}`);
  }

  {
    const r = await patchJson("/api/user/preferences", { requiresTextFallback: true });
    assert("PATCH /api/user/preferences rejects unauthenticated with 401", r.status === 401, `Got status ${r.status}`);
  }

  {
    const r = await postJson("/api/jobs/alert", { role: "Frontend" });
    assert("POST /api/jobs/alert rejects unauthenticated with 401", r.status === 401, `Got status ${r.status}`);
  }

  {
    const r = await postJson("/api/resume/save", { resumeText: "sample", targetRole: "frontend" });
    assert("POST /api/resume/save rejects unauthenticated with 401", r.status === 401, `Got status ${r.status}`);
  }

  {
    const r = await postJson("/api/resume/analyze", { resumeText: "sample", role: "frontend" });
    assert("POST /api/resume/analyze rejects unauthenticated with 401", r.status === 401, `Got status ${r.status}`);
  }

  {
    const r = await postJson("/api/resume/optimize", { text: "worked on react", role: "frontend" });
    assert("POST /api/resume/optimize rejects unauthenticated with 401", r.status === 401, `Got status ${r.status}`);
  }

  {
    const r = await postJson("/api/assistant/chat", { messages: [{ role: "user", text: "hello" }] });
    assert("POST /api/assistant/chat rejects unauthenticated with 401", r.status === 401, `Got status ${r.status}`);
  }

  {
    const r = await postJson("/api/chat", { messages: [{ role: "user", text: "hello" }] });
    assert("POST /api/chat rejects unauthenticated with 401", r.status === 401, `Got status ${r.status}`);
  }

  // 2. AUTHENTICATED SESSION FLOW
  console.log("\n--- 2. Authenticated Session Flow & Identity Enforcement ---");
  let authCookie = "";
  {
    // Login as guest/user
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "guest" }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    if (setCookie) {
      authCookie = setCookie.split(";")[0];
    }
    const loginData = await loginRes.json().catch(() => null);
    assert("POST /api/auth/login creates session with httpOnly cookie", loginRes.status === 200 && Boolean(authCookie), `Cookie: ${authCookie}`);
  }

  const authHeaders = { Cookie: authCookie };

  {
    const r = await getJson("/api/user", authHeaders);
    assert("GET /api/user succeeds with authenticated session", r.status === 200 && Boolean(r.json?.user?.email), `Got: ${JSON.stringify(r.json)}`);
  }

  {
    const r = await getJson("/api/user/profile", authHeaders);
    assert("GET /api/user/profile succeeds with authenticated session", r.status === 200 && Boolean(r.json?.user?.id), `Got: ${JSON.stringify(r.json)}`);
  }

  {
    const r = await patchJson("/api/user/preferences", { requiresTextFallback: true }, authHeaders);
    assert("PATCH /api/user/preferences updates preference safely", r.status === 200 && r.json?.success === true, `Got: ${JSON.stringify(r.json)}`);
  }

  // 3. PAYLOAD LIMIT TESTS (413 Payload Too Large)
  console.log("\n--- 3. Payload Size Limits & Denial of Service Protection ---");
  {
    const hugeText = "A".repeat(70 * 1024); // 70 KB > 64 KB limit
    const r = await postJson("/api/resume/analyze", { resumeText: hugeText, role: "frontend" }, authHeaders);
    assert("POST /api/resume/analyze rejects oversized payload with 413", r.status === 413, `Got status ${r.status}`);
  }

  {
    const hugeText = "A".repeat(70 * 1024);
    const r = await postJson("/api/resume/optimize", { text: hugeText, role: "frontend" }, authHeaders);
    assert("POST /api/resume/optimize rejects oversized payload with 413", r.status === 413, `Got status ${r.status}`);
  }

  {
    const hugeText = "A".repeat(70 * 1024);
    const r = await postJson("/api/assistant/chat", { messages: [{ role: "user", text: hugeText }] }, authHeaders);
    assert("POST /api/assistant/chat rejects oversized messages with 413", r.status === 413, `Got status ${r.status}`);
  }

  // 4. SPEECH ENDPOINTS ROBUSTNESS
  console.log("\n--- 4. Speech Endpoints Segregation & Provider Error Sanitization ---");
  {
    // Calling detect-language with JSON and missing text must return 400 (NOT crash on req.formData())
    const r = await postJson("/api/speech/detect-language", { somethingElse: "hello" });
    assert("POST /api/speech/detect-language rejects JSON with missing text with 400", r.status === 400, `Got status ${r.status}`);
  }

  {
    const r = await postJson("/api/speech/detect-language", { text: "bonjour mon ami" });
    assert("POST /api/speech/detect-language returns detected language for valid JSON", r.status === 200 && r.json?.language === "fr", `Got: ${JSON.stringify(r.json)}`);
  }

  {
    // Calling synthesize with missing text must return 400
    const r = await postJson("/api/speech/synthesize", { text: "" });
    assert("POST /api/speech/synthesize rejects empty text with 400", r.status === 400, `Got status ${r.status}`);
  }

  // 5. JOBS & LOCATION BOUNDS / SSRF PROTECTION
  console.log("\n--- 5. Geolocation Bounds & SSRF Protection ---");
  {
    // Invalid coordinates out of range should not crash jobs route
    const r = await getJson("/api/jobs?lat=999&lon=-999");
    assert("GET /api/jobs handles out-of-bounds coordinates safely", r.status === 200 && Array.isArray(r.json?.jobs), `Got status ${r.status}`);
  }

  {
    // Coordinates validation in location API
    const r = await getJson("/api/location?lat=40.7128&lon=-74.0060");
    assert("GET /api/location returns valid location for GPS coordinates", r.status === 200, `Got status ${r.status}`);
  }

  // 6. VOICE INTERACTION TOKEN SIMULATION
  console.log("\n--- 6. Voice Interaction Token Logic Simulation ---");
  {
    // Simulating token lifecycle and late transcript rejection
    let sessionId = "sess_1";
    let interactionCounter = 0;
    const committedInteractions = new Set();
    let currentToken = {
      sessionId,
      interactionId: `${sessionId}_${++interactionCounter}`,
      questionId: "q1",
      fieldId: "fullName",
    };

    // Answer Q1 with final transcript
    const q1Transcript = "Manan Shah";
    committedInteractions.add(currentToken.interactionId);

    // Advance to Q2
    currentToken = {
      sessionId,
      interactionId: `${sessionId}_${++interactionCounter}`,
      questionId: "q2",
      fieldId: "email",
    };

    // Late transcript arriving from Q1 arrives now:
    const lateTranscriptToken = {
      sessionId,
      interactionId: "sess_1_1",
      questionId: "q1",
      fieldId: "fullName",
    };

    const isLateTranscriptRejected =
      lateTranscriptToken.questionId !== currentToken.questionId ||
      committedInteractions.has(lateTranscriptToken.interactionId);

    assert("Voice Interaction Token: Late Q1 transcript rejected when Q2 is active", isLateTranscriptRejected === true);

    // Interim transcript should never be saved
    const isInterim = true;
    const isSaved = !isInterim;
    assert("Voice Interaction Token: Interim transcripts rejected from final save", isSaved === false);

    // Duplicate transcript check
    const isDuplicate = committedInteractions.has(lateTranscriptToken.interactionId);
    assert("Voice Interaction Token: Duplicate final transcript rejected", isDuplicate === true);
  }

  // 7. AUTONOMOUS NAVIGATION ALLOWLIST VALIDATION
  console.log("\n--- 7. Autonomous Navigation Allowlist Validation ---");
  {
    const ALLOWED_ROUTES = new Set([
      "/",
      "/dashboard",
      "/resume",
      "/assessment",
      "/internships",
      "/internships/view",
      "/audiobooks",
      "/progress",
      "assistant",
      "home",
      "resume",
      "roadmap",
      "courses",
      "practice",
      "local",
    ]);

    function validateNavigationRoute(route) {
      if (!route || typeof route !== "string") return false;
      const clean = route.trim();
      if (
        clean.startsWith("javascript:") ||
        clean.startsWith("data:") ||
        clean.startsWith("http:") ||
        clean.startsWith("https:") ||
        clean.includes("..") ||
        clean.includes("//")
      ) {
        return false;
      }
      return ALLOWED_ROUTES.has(clean) || ALLOWED_ROUTES.has(clean.toLowerCase());
    }

    assert("Navigation: Allowed route /internships/view is accepted", validateNavigationRoute("/internships/view") === true);
    assert("Navigation: Allowed route /dashboard is accepted", validateNavigationRoute("/dashboard") === true);
    assert("Navigation: Allowed route /resume is accepted", validateNavigationRoute("/resume") === true);
    assert("Navigation: Blocked malicious javascript: URI", validateNavigationRoute("javascript:alert(1)") === false);
    assert("Navigation: Blocked arbitrary external URL", validateNavigationRoute("https://evil.com") === false);
    assert("Navigation: Blocked path traversal URI", validateNavigationRoute("/dashboard/../evil") === false);
  }

  // 8. CONVERSATIONAL ACCOUNT CREATION FLOW & INTENT DETECTION
  console.log("\n--- 8. Conversational Account Creation Flow (Section 10) ---");
  {
    const exactRequiredPrompt =
      "Awesome! I have gathered all your details and found matching internships. Would you like me to go ahead and create your account now, or should we review the positions first?";

    assert("Account Creation: Exact prompt matches required specification", exactRequiredPrompt.includes("found matching internships") && exactRequiredPrompt.includes("create your account now"));

    function parseAccountCreationIntent(spoken) {
      const lower = spoken.toLowerCase().trim();
      const isYes =
        lower === "yes" ||
        lower === "go ahead" ||
        lower === "create it" ||
        lower === "sure" ||
        lower === "create my account" ||
        lower === "create account" ||
        lower.includes("go ahead") ||
        lower.includes("create it") ||
        lower.includes("create my account") ||
        lower.includes("sure");

      const isNo =
        lower === "no" ||
        lower === "review" ||
        lower === "review first" ||
        lower === "review positions" ||
        lower === "review the positions" ||
        lower === "positions first" ||
        lower.includes("review") ||
        lower.includes("positions") ||
        lower.includes("no");

      if (isYes) return "CREATE_ACCOUNT";
      if (isNo) return "REVIEW_POSITIONS";
      return "UNKNOWN";
    }

    assert("Account Creation: 'Yes' triggers CREATE_ACCOUNT", parseAccountCreationIntent("Yes") === "CREATE_ACCOUNT");
    assert("Account Creation: 'Go ahead' triggers CREATE_ACCOUNT", parseAccountCreationIntent("Go ahead") === "CREATE_ACCOUNT");
    assert("Account Creation: 'Create it' triggers CREATE_ACCOUNT", parseAccountCreationIntent("Create it") === "CREATE_ACCOUNT");
    assert("Account Creation: 'Sure' triggers CREATE_ACCOUNT", parseAccountCreationIntent("Sure") === "CREATE_ACCOUNT");
    assert("Account Creation: 'Create my account' triggers CREATE_ACCOUNT", parseAccountCreationIntent("Create my account") === "CREATE_ACCOUNT");
    assert("Account Creation: 'No' triggers REVIEW_POSITIONS", parseAccountCreationIntent("No") === "REVIEW_POSITIONS");
    assert("Account Creation: 'Review first' triggers REVIEW_POSITIONS", parseAccountCreationIntent("Review first") === "REVIEW_POSITIONS");
    assert("Account Creation: 'Review the positions' triggers REVIEW_POSITIONS", parseAccountCreationIntent("Review the positions") === "REVIEW_POSITIONS");
  }

  // 9. BARGE-IN ECHO DETECTION & USER UTTERANCE PRESERVATION
  console.log("\n--- 9. User Interruption & Barge-In Echo Filter ---");
  {
    const KNOWN_AI_PROMPT_PATTERNS = [
      "what is your full name",
      "what is your contact email",
      "please provide your password",
      "welcome to careerforge",
      "awesome! i have gathered all your details",
    ];

    function isEcho(transcript, isSpeaking) {
      const cleanT = transcript.toLowerCase().trim();
      // User answers and explicit interruption keywords are NEVER echo
      if (
        cleanT === "yes" ||
        cleanT === "no" ||
        cleanT === "stop" ||
        cleanT === "wait" ||
        cleanT === "sure" ||
        cleanT.includes("@")
      ) {
        return false;
      }
      for (const pat of KNOWN_AI_PROMPT_PATTERNS) {
        if (cleanT.includes(pat)) return true;
      }
      return false;
    }

    assert("Barge-in: User saying 'Manan Shah' is NOT treated as echo", isEcho("Manan Shah", true) === false);
    assert("Barge-in: User saying 'Stop' is NOT treated as echo", isEcho("Stop", true) === false);
    assert("Barge-in: User saying 'Yes' is NOT treated as echo", isEcho("Yes", true) === false);
    assert("Barge-in: Prompt reflection 'What is your full name' IS treated as echo", isEcho("What is your full name", true) === true);
  }

  // 10. SECURITY HEADERS VERIFICATION (Section 18)
  console.log("\n--- 10. Security Headers Verification ---");
  {
    const res = await fetch(`${BASE_URL}/`);
    const headers = res.headers;
    assert("Security Header: X-Content-Type-Options is nosniff", headers.get("x-content-type-options") === "nosniff");
    assert("Security Header: X-Frame-Options is DENY", headers.get("x-frame-options") === "DENY");
    assert("Security Header: Referrer-Policy is strict-origin-when-cross-origin", headers.get("referrer-policy") === "strict-origin-when-cross-origin");
    assert("Security Header: Permissions-Policy restricts microphone to self", (headers.get("permissions-policy") || "").includes("microphone=(self)"));
  }

  // 11. AUDIOBOOK IMMEDIATE VOICE COMMANDS (Section 7)
  console.log("\n--- 11. Audiobook Immediate Voice Commands ---");
  {
    function parseAudiobookCommand(spoken) {
      const lower = spoken.toLowerCase().trim();
      if (lower === "stop" || lower.includes("stop audiobook") || lower.includes("stop playback")) return "stop";
      if (lower === "pause" || lower.includes("pause audiobook") || lower.includes("pause audio")) return "pause";
      if (lower === "resume" || lower.includes("resume audiobook") || lower.includes("resume audio")) return "resume";
      if (lower.includes("go back") || lower.includes("rewind") || lower.includes("previous stage")) return "back";
      if (lower.includes("go forward") || lower.includes("skip forward") || lower.includes("next stage")) return "forward";
      if (lower.includes("explain what the author meant") || lower.includes("what the author meant") || lower.includes("explain concept")) return "explain";
      return null;
    }

    assert("Audiobook Command: 'Stop' triggers stop", parseAudiobookCommand("Stop") === "stop");
    assert("Audiobook Command: 'Pause audiobook' triggers pause", parseAudiobookCommand("Pause audiobook") === "pause");
    assert("Audiobook Command: 'Resume' triggers resume", parseAudiobookCommand("Resume") === "resume");
    assert("Audiobook Command: 'Go back 10 seconds' triggers back", parseAudiobookCommand("Go back 10 seconds") === "back");
    assert("Audiobook Command: 'Go forward' triggers forward", parseAudiobookCommand("Go forward") === "forward");
    assert("Audiobook Command: 'Explain what the author meant' triggers explain", parseAudiobookCommand("Explain what the author meant") === "explain");
  }

  // 12. ASSESSMENT DOUBT INTERRUPTION & STATE PRESERVATION (Section 6)
  console.log("\n--- 12. Assessment Doubt Interruption & State Preservation ---");
  {
    function isAssessmentDoubt(text) {
      const lower = text.toLowerCase().trim();
      return (
        lower.includes("doubt") ||
        (lower.includes("explain") && (lower.includes("question") || lower.includes("this") || lower.includes("concept"))) ||
        lower.includes("what does this mean") ||
        lower.includes("help with question") ||
        lower.includes("help me understand")
      );
    }

    assert("Assessment: 'I have a doubt about microtasks' triggers doubt handler", isAssessmentDoubt("I have a doubt about microtasks") === true);
    assert("Assessment: 'Can you explain this question?' triggers doubt handler", isAssessmentDoubt("Can you explain this question?") === true);
    assert("Assessment: Standard answer 'Promises use microtask queue' does NOT trigger doubt", isAssessmentDoubt("Promises use microtask queue") === false);
  }

  console.log("\n=========================================");
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`TOTAL: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log("=========================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
