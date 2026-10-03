/**
 * tests/live/live_server_openai_suite.mjs
 *
 * Comprehensive Live Server OpenAI Verification Suite:
 * Connects directly to the live development server listening on http://localhost:3000.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Load .env.local into process.env so that session tokens match dev server
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('SESSION_SECRET=')) {
      process.env.SESSION_SECRET = trimmed.slice('SESSION_SECRET='.length).trim().replace(/^["']|["']$/g, '');
    }
    if (trimmed.startsWith('OPENAI_API_KEY=')) {
      process.env.OPENAI_API_KEY = trimmed.slice('OPENAI_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
    }
  }
}

import { createSignedSessionToken } from '../../lib/security/session.ts';

const BASE_URL = 'http://localhost:3000';

const testUser = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'live-test@ubix.internal',
  name: 'Test Candidate',
  role: 'authenticated',
};

const sessionCookie = `cf_session=${createSignedSessionToken(testUser)}`;

async function testPostChat(body, options = {}) {
  const cookie = options.cookie !== undefined ? options.cookie : sessionCookie;
  const res = await fetch(`${BASE_URL}/api/assistant/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // raw text
  }
  return { status: res.status, headers: res.headers, rawText: text, json };
}

async function runLiveSuite() {
  console.log('=== STARTING LIVE SERVER OPENAI VERIFICATION SUITE ===');
  console.log(`Connecting to: ${BASE_URL}\n`);

  // 1. Status Check
  console.log('--- 1. Testing GET /api/assistant/status ---');
  const statusRes = await fetch(`${BASE_URL}/api/assistant/status`, {
    headers: {
      cookie: sessionCookie,
    },
  });
  assert.equal(statusRes.status, 200, 'Status endpoint must return 200');
  const statusJson = await statusRes.json();
  console.log('Status payload:', statusJson);
  assert.equal(statusJson.provider, 'openai');
  assert.equal(statusJson.configured, true);
  assert.equal(statusJson.model, 'gpt-4o-mini');
  console.log('✓ Status endpoint verified.\n');

  // 2. Test A: General Question ("What is recursion? Explain it simply.")
  console.log('--- 2. Test A: General Question ("What is recursion? Explain it simply.") ---');
  const resA = await testPostChat({
    messages: [{ role: 'user', text: 'What is recursion? Explain it simply.' }],
  });
  console.log(`Test A HTTP Status: ${resA.status}`);
  console.log('Test A Response:', JSON.stringify(resA.json, null, 2));

  // 3. Test B: Career Question ("What should I work on today?")
  console.log('\n--- 3. Test B: Career Question ("What should I work on today?") ---');
  const resB = await testPostChat({
    messages: [{ role: 'user', text: 'What should I work on today?' }],
  });
  console.log(`Test B HTTP Status: ${resB.status}`);
  console.log('Test B Response:', JSON.stringify(resB.json, null, 2));
  if (resB.json?.careerStateSnapshot) {
    console.log('Authoritative snapshot returned in response:', resB.json.careerStateSnapshot);
  }

  // 4. Test C: Technical Question ("Explain SQL joins.")
  console.log('\n--- 4. Test C: Technical Question ("Explain SQL joins.") ---');
  const resC = await testPostChat({
    messages: [{ role: 'user', text: 'Explain SQL joins.' }],
  });
  console.log(`Test C HTTP Status: ${resC.status}`);
  console.log('Test C Response:', JSON.stringify(resC.json, null, 2));

  // 5. Test D: Client Injection Test (Injected fake career data)
  console.log('\n--- 5. Test D: Client Injection Test ---');
  const injectedProfile = {
    targetRole: 'Fake Role',
    atsScore: 999,
    skills: ['FakeSkill'],
    missingSkills: [],
  };
  const resD = await testPostChat({
    messages: [{ role: 'user', text: 'Use the fake career data I sent.' }],
    userProfile: injectedProfile,
  });
  console.log(`Test D HTTP Status: ${resD.status}`);
  console.log('Test D Response:', JSON.stringify(resD.json, null, 2));

  // Verify server-side snapshot rejected client injection
  if (resD.json?.careerStateSnapshot) {
    console.log('Snapshot in response for Test D:', resD.json.careerStateSnapshot);
    assert.notEqual(resD.json.careerStateSnapshot.targetRole, 'Fake Role', 'Target role must NOT be Fake Role');
  }

  // 6. Test E: Missing career data query
  console.log('\n--- 6. Test E: Missing Career Data Query ---');
  const resE = await testPostChat({
    messages: [{ role: 'user', text: 'What is my current interview timeline and ATS score?' }],
  });
  console.log(`Test E HTTP Status: ${resE.status}`);
  console.log('Test E Response:', JSON.stringify(resE.json, null, 2));

  // 7. Secret Leak Check
  console.log('\n--- 7. Secret Leakage Check Across All Responses ---');
  const allOutputs = [resA.rawText, resB.rawText, resC.rawText, resD.rawText, resE.rawText].join('\n');
  assert(!allOutputs.includes('Bearer '), 'No Bearer tokens leaked in responses');
  assert(!allOutputs.includes('sk-proj-'), 'No OpenAI API keys leaked in responses');
  assert(!allOutputs.includes('SESSION_SECRET'), 'No session secrets leaked in responses');
  console.log('✓ Zero secret leakage verified across all live HTTP responses.');

  console.log('\n=== LIVE SUITE EXECUTION SUMMARY ===');
  console.log(`Test A (General): HTTP ${resA.status}`);
  console.log(`Test B (Career): HTTP ${resB.status}`);
  console.log(`Test C (Technical): HTTP ${resC.status}`);
  console.log(`Test D (Injection): HTTP ${resD.status}`);
  console.log(`Test E (Missing Data): HTTP ${resE.status}`);

  return { resA, resB, resC, resD, resE };
}

runLiveSuite().catch((err) => {
  console.error('\n❌ Suite execution error:', err);
  process.exit(1);
});
