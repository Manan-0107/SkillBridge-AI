import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('GEMINI_API_KEY=')) {
      process.env.GEMINI_API_KEY = trimmed.slice('GEMINI_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
    }
    if (trimmed.startsWith('SESSION_SECRET=')) {
      process.env.SESSION_SECRET = trimmed.slice('SESSION_SECRET='.length).trim().replace(/^["']|["']$/g, '');
    }
  }
}

// Clear mock
delete process.env.UBIX_MOCK_AI;

import { getCanonicalProvider, getProviderStatus, mapProviderError } from '../../lib/ai/providerConfig.ts';
import { POST } from '../../app/api/assistant/chat/route.ts';
import { createSignedSessionToken } from '../../lib/security/session.ts';

const info = getCanonicalProvider();
console.log('Provider Info:', info);
assert.equal(info.provider, 'gemini');
assert.equal(info.modelId, 'gemini-3.5-flash-lite');
assert.equal(info.isConfigured, true);
assert.equal(info.isMock, false);

const status = getProviderStatus();
console.log('Provider Status:', status);
assert.equal(status.provider, 'gemini');
assert.equal(status.model, 'gemini-3.5-flash-lite');
assert.equal(status.status, 'ready');

const testAuthCookie = 'cf_session=' + createSignedSessionToken({
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'test@ubix.internal',
  name: 'Manan',
  role: 'authenticated',
});

async function callChat(promptText) {
  console.log(`\nCalling POST /api/assistant/chat: "${promptText}" ...`);
  const req = new Request('http://localhost:3000/api/assistant/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: testAuthCookie,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', text: promptText }],
    }),
  });

  const start = Date.now();
  const res = await POST(req);
  console.log(`HTTP Status: ${res.status} (in ${Date.now() - start}ms)`);
  const data = await res.json();
  console.log('Engine:', data.engine);
  console.log('Reply snippet:', data.reply?.slice(0, 140));
  if (data.toolCall) console.log('Tool Call:', data.toolCall);
  assert.equal(res.status, 200);
  assert.equal(data.isFallback, false);
  assert(!data.reply.includes('UBIX_MOCK'));
  assert(data.reply.length > 20);
  return data;
}

async function run() {
  // 1. General question
  const r1 = await callChat('What is recursion? Explain it simply.');
  assert(r1.reply.toLowerCase().includes('function') || r1.reply.toLowerCase().includes('itself'));

  // 2. Career question
  const r2 = await callChat('What should I work on today?');
  assert(r2.reply.length > 50);

  // 3. Technical question
  const r3 = await callChat('Explain SQL joins.');
  assert(r3.reply.toLowerCase().includes('join') || r3.reply.toLowerCase().includes('table'));

  // 4. Action/Tool invocation
  const r4 = await callChat('Open my roadmap');
  assert(r4.toolCall?.tool === 'openRoadmap' || r4.feature === 'roadmap');

  // 5. Missing key handling
  console.log('\nTesting missing GEMINI_API_KEY handling...');
  const realKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const unconfigReq = new Request('http://localhost:3000/api/assistant/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: testAuthCookie,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', text: 'Hello' }],
      }),
    });
    const unconfigRes = await POST(unconfigReq);
    assert.equal(unconfigRes.status, 503, 'Missing key must yield 503');
    const unconfigData = await unconfigRes.json();
    assert.equal(unconfigData.error?.code, 'AI_PROVIDER_NOT_CONFIGURED');
    console.log('✓ Missing key yielded HTTP 503 AI_PROVIDER_NOT_CONFIGURED');
  } finally {
    process.env.GEMINI_API_KEY = realKey;
  }

  // 6. Malformed response handling
  const mappedMalformed = mapProviderError(new SyntaxError('Unexpected token < in JSON at position 0'));
  assert.equal(mappedMalformed.statusCode, 502);
  assert.equal(mappedMalformed.code, 'AI_PROVIDER_MALFORMED_RESPONSE');
  console.log('✓ Malformed response mapped to HTTP 502 AI_PROVIDER_MALFORMED_RESPONSE');

  // 7. Secret leak check
  const allJson = JSON.stringify([r1, r2, r3, r4]);
  assert(!allJson.includes(realKey), 'Gemini API key must not leak');
  assert(!allJson.includes('Bearer '), 'No Bearer tokens leaked');
  console.log('✓ Zero secret leakage verified across all responses');

  console.log('\n=== ALL CANONICAL GEMINI ASSISTANT TESTS PASSED WITH 200 OK! ===');
}

run().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
