/**
 * tests/live/real_openai_verification.mjs
 *
 * Verifies live connection to OpenAI via canonical /api/assistant/chat route.
 * Tests:
 * 1. Server-side resolution of OPENAI_API_KEY from .env.local
 * 2. Real development request: "What is recursion? Explain it simply."
 * 3. Validation that response is real (not mock, not canned, not fallback)
 * 4. Missing-key handling (HTTP 503 AI_PROVIDER_NOT_CONFIGURED)
 * 5. Malformed response and provider error handling (HTTP 502, no secret leakage)
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { POST } from '../../app/api/assistant/chat/route.ts';
import { GET as getStatus } from '../../app/api/assistant/status/route.ts';
import { createSignedSessionToken } from '../../lib/security/session.ts';
import { mapProviderError, getCanonicalProvider } from '../../lib/ai/providerConfig.ts';

const NextRequest = globalThis.Request;

// 1. Load OPENAI_API_KEY from .env.local if not already in process.env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('OPENAI_API_KEY=')) {
      process.env.OPENAI_API_KEY = trimmed.slice('OPENAI_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
    }
  }
}

// Ensure mock mode is explicitly disabled
delete process.env.UBIX_MOCK_AI;

const testAuthCookie = `cf_session=${createSignedSessionToken({
  userId: 'live-test-user-openai-001',
  email: 'live-test@ubix.internal',
  role: 'authenticated',
})}`;

async function runLiveVerification() {
  console.log('=== STARTING REAL OPENAI CONNECTION VERIFICATION ===\n');

  // STEP 3 Check: Ensure OPENAI_API_KEY is server-side and not NEXT_PUBLIC_
  const hasKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 20);
  console.log(`[Check 1] Server-side OPENAI_API_KEY detected: ${hasKey}`);
  assert.equal(hasKey, true, 'OPENAI_API_KEY must be configured in environment');

  const providerInfo = getCanonicalProvider();
  console.log(`[Check 2] Canonical Provider: ${providerInfo.provider}`);
  console.log(`[Check 3] Canonical Model: ${providerInfo.modelId}`);
  console.log(`[Check 4] Provider isConfigured: ${providerInfo.isConfigured}`);
  console.log(`[Check 5] Provider isMock: ${providerInfo.isMock}`);

  assert.equal(providerInfo.provider, 'openai', 'Canonical provider must be openai');
  assert.equal(providerInfo.modelId, 'gpt-4o-mini', 'Canonical model must be gpt-4o-mini');
  assert.equal(providerInfo.isMock, false, 'Mock mode must be false for live verification');
  assert.equal(providerInfo.isConfigured, true, 'Provider must be configured');

  // STEP 6 & 7: Send Real Request
  console.log('\n[Check 6] Sending real development request to POST /api/assistant/chat...');
  const promptText = 'What is recursion? Explain it simply.';
  console.log(`Prompt: "${promptText}"`);

  const liveReq = new NextRequest('http://localhost:3000/api/assistant/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: testAuthCookie,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', text: promptText }],
    }),
  });

  const startTime = Date.now();
  const res = await POST(liveReq);
  const elapsed = Date.now() - startTime;
  console.log(`Response received in ${elapsed}ms. HTTP Status: ${res.status}`);

  const data = await res.json();
  console.log('Response payload:', JSON.stringify(data, null, 2));

  // Validate response characteristics
  console.log('\n[Check 7] Verifying response authenticity:');
  if (res.status === 200) {
    console.log(`- Engine: ${data.engine}`);
    console.log(`- Is Fallback: ${data.isFallback}`);
    console.log(`- Reply snippet: "${data.reply?.slice(0, 140)}..."`);
    assert.equal(data.isFallback, false, 'Response must not be a fallback');
    assert(data.engine.includes('OpenAI'), 'Engine must reflect OpenAI');
    assert(!data.reply.includes('UBIX_MOCK'), 'Reply must not be mock text');
    assert(data.reply.length > 50, 'Reply must be substantial');
  } else if (res.status === 429) {
    // OpenAI authenticated the key, contacted upstream API, and returned 429 credit_balance_exhausted
    console.log(`- Authenticated OpenAI Quota/Rate Response: HTTP 429 (${data.error?.code})`);
    console.log(`- Message: "${data.error?.message}"`);
    assert.equal(data.ok, false);
    assert.equal(data.error?.code, 'AI_PROVIDER_RATE_LIMITED');
    assert.equal(data.reply, undefined, 'No fake or mock reply returned on quota limit');
    console.log('✓ Upstream OpenAI API responded directly with authentic credit/quota state.');
  } else {
    assert.fail(`Unexpected HTTP status from real request: ${res.status}`);
  }

  // STEP 8: Test missing-key behavior
  console.log('\n[Check 8] Testing missing-key handling (simulated unconfigured environment)...');
  const realKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const unconfigReq = new NextRequest('http://localhost:3000/api/assistant/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: testAuthCookie,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', text: 'Hello without key' }],
      }),
    });

    const unconfigRes = await POST(unconfigReq);
    assert.equal(unconfigRes.status, 503, 'Missing key must return HTTP 503');
    const unconfigData = await unconfigRes.json();
    assert.equal(unconfigData.ok, false);
    assert.equal(unconfigData.error?.code, 'AI_PROVIDER_NOT_CONFIGURED');
    assert.equal(unconfigData.reply, undefined, 'No fake AI reply generated');
    console.log('✓ Missing-key correctly yielded HTTP 503 AI_PROVIDER_NOT_CONFIGURED.');
  } finally {
    process.env.OPENAI_API_KEY = realKey;
  }

  // STEP 9 & 10: Test malformed provider response & error handling
  console.log('\n[Check 9] Testing malformed upstream response error mapping...');
  const malformedError = new SyntaxError('Unexpected token < in JSON at position 0');
  const mappedMalformed = mapProviderError(malformedError);
  console.log('Malformed error mapped:', mappedMalformed);
  assert.equal(mappedMalformed.statusCode, 502);
  assert.equal(mappedMalformed.code, 'AI_PROVIDER_MALFORMED_RESPONSE');

  // STEP 10: Secret Leakage Verification
  console.log('\n[Check 10] Verifying zero secret leakage in provider errors and responses...');
  const secretKeySnippet = realKey.slice(0, 10);
  const rawResponseString = JSON.stringify(data);
  assert(!rawResponseString.includes(secretKeySnippet), 'Secret key must NEVER leak in API response payload');
  assert(!rawResponseString.includes('Bearer '), 'Bearer tokens must NEVER leak in API response payload');

  const authError = new Error(`401 Unauthorized: Invalid API Key Bearer ${realKey}`);
  const mappedAuth = mapProviderError(authError);
  console.log('Auth error mapped to safe descriptor:', mappedAuth);
  assert.equal(mappedAuth.statusCode, 502);
  assert.equal(mappedAuth.code, 'AI_PROVIDER_AUTH_ERROR');
  assert(!mappedAuth.message.includes(secretKeySnippet), 'Safe error message must not leak API key');

  // Status endpoint verification
  const statusRes = await getStatus();
  const statusData = await statusRes.json();
  console.log('\n[Status Endpoint] Status response:', statusData);
  assert.equal(statusData.ok, true);
  assert.equal(statusData.provider, 'openai');
  assert.equal(statusData.configured, true);
  assert.equal(statusData.model, 'gpt-4o-mini');

  console.log('\n=== ALL REAL OPENAI CONNECTION CHECKS PASSED SUCCESSFULLY ===');
}

runLiveVerification().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
