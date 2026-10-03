import assert from "node:assert/strict";

async function testV3() {
  console.log("=== Testing CareerForge v3 Fixes ===");

  // 1. Test Chat API with "hello elevyn"
  console.log("\n1. Testing Chat API with 'hello elevyn'...");
  const chatRes = await fetch("http://127.0.0.1:8000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", text: "hello elevyn" }],
      voiceMode: false,
    }),
  });

  assert.equal(chatRes.status, 200, "Chat API returned 200 OK");
  const chatData = await chatRes.json();
  console.log("Reply:", chatData.reply);
  console.log("Engine:", chatData.engine);

  assert(
    !chatData.reply.includes("That is an insightful question"),
    "Must NOT contain robotic 'That is an insightful question' boilerplate"
  );
  assert(
    !chatData.reply.includes("sterile definition"),
    "Must NOT contain robotic 'sterile definition' boilerplate"
  );
  assert(
    chatData.reply.toLowerCase().includes("elevenlabs") || chatData.reply.toLowerCase().includes("hello"),
    "Must contain natural greeting or ElevenLabs reference"
  );
  console.log("✓ 'hello elevyn' chat test PASSED!");

  // 2. Test Voice Dialogue Confirmation Loop
  console.log("\n2. Testing Alexa Confirmation Loop...");
  const sessionId = "test_session_" + Date.now();

  // Turn 1: user dictates name
  const turn1 = await fetch("http://127.0.0.1:8000/api/voice/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      text: "my name is Alex Rivera",
    }),
  });
  const data1 = await turn1.json();
  console.log("Turn 1 (dictate name):", data1.replyText);
  assert.equal(data1.intent, "confirmation", "Intent must be 'confirmation'");
  assert(data1.replyText.includes("I heard: 'Alex Rivera'"), "Must echo back name in confirmation prompt");
  assert(data1.requiresFollowup, "Must require followup confirmation");

  // Turn 2: user says "yes" to confirm
  const turn2 = await fetch("http://127.0.0.1:8000/api/voice/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      text: "yes",
    }),
  });
  const data2 = await turn2.json();
  console.log("Turn 2 (say yes):", data2.replyText);
  assert.equal(data2.intent, "form_input", "Intent must be 'form_input'");
  assert.equal(data2.slots?.name, "Alex Rivera", "Slot 'name' must be committed");
  console.log("✓ Alexa confirmation loop PASSED!");

  // 3. Test Navigation Routing Table
  console.log("\n3. Testing Navigation Table...");
  const navTests = [
    { text: "go to roadmap", expectedTarget: "roadmap/frontend" },
    { text: "backend roadmap", expectedTarget: "roadmap/backend" },
    { text: "open practice hub", expectedTarget: "practice" },
    { text: "open resume suite", expectedTarget: "resume" },
    { text: "nearby jobs", expectedTarget: "local" },
    { text: "go home", expectedTarget: "assistant" },
  ];

  for (const t of navTests) {
    const res = await fetch("http://127.0.0.1:8000/api/voice/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "nav_sess_" + Date.now(),
        text: t.text,
      }),
    });
    const d = await res.json();
    console.log(`Nav '${t.text}' -> target: ${d.target} (reply: ${d.replyText})`);
    assert.equal(d.intent, "navigation");
    assert.equal(d.target, t.expectedTarget);
  }
  console.log("✓ Navigation fast-path table PASSED!");

  console.log("\nALL V3 TESTS PASSED PERFECTLY!");
}

testV3().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
