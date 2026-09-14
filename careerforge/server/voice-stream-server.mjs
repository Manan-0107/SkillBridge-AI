/**
 * voice-stream-server.mjs
 * End-to-End Real-Time Streaming Voice Assistant Backend
 *
 * Architecture:
 *  - Persistent bi-directional WebSocket hub
 *  - Google Cloud Speech-to-Text V2 / Sarvam STT with interim results
 *  - Agentic State Machine (LangChain / Structured Output) with Redis & Memory Fallback
 *  - ElevenLabs WebSocket Streaming TTS (Turbo v2.5) with token-by-token pipe
 *  - Exact final handoff interception and affirmative intent matching
 */

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from careerforge/.env.local or root .env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = parseInt(process.env.VOICE_STREAM_PORT || '8081', 10);
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel / Neutral clear persona
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// ─── Redis with In-Memory Fallback ───────────────────────────────────────────
let redisClient = null;
const memoryStore = new Map();

try {
  const { default: Redis } = await import('ioredis');
  const r = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // don't spam if redis is not present
    lazyConnect: true,
    enableOfflineQueue: false,
  });
  r.on('error', () => {
    // Suppress connection errors when redis is absent
  });
  await r.connect().catch(() => {
    console.log('[State Machine] Redis not detected. Using high-speed in-memory store.');
  });
  if (r.status === 'ready') {
    redisClient = r;
    console.log('[State Machine] Connected to Redis.');
  }
} catch {
  console.log('[State Machine] Using in-memory state store.');
}

async function getSession(sessionId) {
  if (redisClient && redisClient.status === 'ready') {
    const raw = await redisClient.get(sessionId);
    return raw ? JSON.parse(raw) : createEmptySession();
  }
  return memoryStore.get(sessionId) || createEmptySession();
}

async function saveSession(sessionId, data) {
  if (redisClient && redisClient.status === 'ready') {
    await redisClient.set(sessionId, JSON.stringify(data), 'EX', 3600);
  } else {
    memoryStore.set(sessionId, data);
  }
}

function createEmptySession() {
  return {
    fullName: null,
    email: null,
    password: null,
    handoffReady: false,
    completed: false,
    history: [],
  };
}

// Process-wide unhandled rejection guard for external auth libraries
process.on('unhandledRejection', (reason) => {
  const msg = String(reason?.message || reason);
  if (msg.includes('credentials') || msg.includes('NO_ADC_FOUND')) {
    console.log('[STT] Google Cloud Credentials not set. Client speech recognition active.');
  } else {
    console.warn('[Server Unhandled Rejection]:', reason);
  }
});

// ─── Google Cloud Speech Client (Active when credentials provided) ───────────
let GoogleSpeechClient = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    const speechPkg = await import('@google-cloud/speech');
    if (speechPkg?.SpeechClient) {
      GoogleSpeechClient = new speechPkg.SpeechClient();
      console.log('[STT] Google Cloud Speech client initialized with ADC.');
    }
  } catch (e) {
    console.log('[STT] Google Cloud Speech client skipped:', e.message);
  }
} else {
  console.log('[STT] GOOGLE_APPLICATION_CREDENTIALS not specified. Client STT pipeline active.');
}

// ─── Affirmative Intent Pattern ──────────────────────────────────────────────
const AFFIRMATIVE_REGEX = /\b(yes|sure|go ahead|create it|proceed|yep|yeah|absolutely|do it|create|confirm|okay|ok)\b/i;

// ─── HTTP & WebSocket Server ─────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'active', service: 'CareerForge Voice Accessibility Hub' }));
});

const wss = new WebSocketServer({ server, path: '/voice-stream' });

wss.on('connection', (clientWs) => {
  const sessionId = `vui_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  console.log(`[VUI] Client session opened: ${sessionId}`);

  let activeInteractionId = null;
  let activeQuestionId = null;
  let activeFieldId = null;
  let lastAudioSequence = -1;
  const committedTranscripts = new Set();

  let elevenLabsWs = null;
  let googleRecognizeStream = null;
  let isCleaningUp = false;

  // 1. ElevenLabs Streaming WebSocket (/stream-input)
  const initElevenLabsStream = () => {
    if (!ELEVENLABS_API_KEY) {
      return null;
    }

    try {
      const url = `wss://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream-input?model_id=eleven_turbo_v2_5&output_format=pcm_16000`;
      elevenLabsWs = new WebSocket(url);

      elevenLabsWs.on('open', () => {
        // Send initial BOS (Beginning of Stream) payload
        elevenLabsWs.send(
          JSON.stringify({
            text: ' ',
            voice_settings: { stability: 0.5, similarity_boost: 0.8 },
            generation_config: { chunk_length_schedule: [50] },
            xi_api_key: ELEVENLABS_API_KEY,
          })
        );
      });

      elevenLabsWs.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio) {
            // Base64 PCM chunk -> Buffer -> Forward to Browser
            const audioBuffer = Buffer.from(parsed.audio, 'base64');
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(audioBuffer);
            }
          }
        } catch (_) {}
      });

      elevenLabsWs.on('error', (err) => {
        console.warn('[ElevenLabs WS error]:', err.message);
      });
    } catch (err) {
      console.warn('[ElevenLabs init error]:', err);
    }
  };

  initElevenLabsStream();

  // Helper to send text to TTS and announce to screen reader
  const speakText = (text) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: 'AGENT_SPEAKING', text, interactionId: activeInteractionId }));
    }

    if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
      elevenLabsWs.send(
        JSON.stringify({
          text: text + ' ',
          try_trigger_generation: true,
          flush: true,
        })
      );
    } else {
      // Fallback: notify client so browser speech synthesis can speak if ElevenLabs key is unconfigured
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: 'AGENT_SPEAKING_FALLBACK', text, interactionId: activeInteractionId }));
      }
    }
  };

  // 2. Google Cloud Speech Streaming V2 Setup
  const initGoogleSpeechStream = () => {
    if (!GoogleSpeechClient) return;

    try {
      googleRecognizeStream = GoogleSpeechClient.streamingRecognize({
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'en-US',
          model: 'chirp_3',
          enableAutomaticPunctuation: true,
        },
        interimResults: true,
      })
        .on('data', async (data) => {
          const result = data.results[0];
          if (!result || !result.alternatives[0]) return;

          const transcript = result.alternatives[0].transcript.trim();
          const isFinal = result.isFinal;
          const currentInteractionId = activeInteractionId || sessionId;

          if (!isFinal && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'STT_INTERIM',
                sessionId,
                interactionId: currentInteractionId,
                text: transcript,
                transcript,
                isSpeaking: transcript.length > 0,
                timestamp: Date.now(),
              })
            );
          }

          if (isFinal && transcript) {
            const transcriptId = `stt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'STT_FINAL',
                  sessionId,
                  interactionId: currentInteractionId,
                  transcriptId,
                  text: transcript,
                  transcript,
                  timestamp: Date.now(),
                })
              );
            }
            await processTranscript(transcript);
          }
        })
        .on('error', (err) => {
          console.warn('[Google STT stream notice]:', err.message);
          googleRecognizeStream = null;
          if (err.message?.includes('credentials')) {
            console.log('[Google STT] Google Cloud credentials not configured locally. Native client STT will forward transcripts.');
          }
        });
    } catch (e) {
      console.warn('[STT Init Exception]:', e.message);
      googleRecognizeStream = null;
    }
  };

  initGoogleSpeechStream();

  // 3. Conversational State Machine & Dialogue Manager Integration
  const processTranscript = async (userText) => {
    console.log(`[VUI] User transcript: "${userText}"`);

    // ── Try Python AI Brain Dialogue Manager first ────────────────────────────
    try {
      const pythonPort = process.env.PYTHON_AI_PORT || '8000';
      const intentUrl = `http://127.0.0.1:${pythonPort}/api/voice/intent`;
      const response = await fetch(intentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userText,
          sessionId,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[VUI] Dialogue Manager resolved:`, data.intent, `Follow-up:`, data.requiresFollowup);

        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: 'DIALOGUE_INTENT',
              sessionId,
              intent: data.intent,
              action: data.action,
              target: data.target,
              replyText: data.replyText,
              requiresFollowup: data.requiresFollowup,
              expectedSlot: data.expectedSlot,
              slots: data.slots,
              timestamp: Date.now(),
            })
          );
        }

        speakText(data.replyText);
        return;
      }
    } catch (e) {
      console.warn(`[VUI] Python dialogue manager fallback: ${e.message}`);
    }

    // ── Fallback to Local State Machine ───────────────────────────────────────
    const session = await getSession(sessionId);

    // Check if already in the Final Handoff Confirmation State
    if (session.handoffReady && !session.completed) {
      if (AFFIRMATIVE_REGEX.test(userText.trim())) {
        session.completed = true;
        await saveSession(sessionId, session);

        speakText('Creating your account right now. You are all set! Welcome aboard.');

        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: 'ONBOARDING_COMPLETE',
              payload: {
                fullName: session.fullName,
                email: session.email,
                password: session.password,
              },
            })
          );
        }
        return;
      }
    }

    // Entity Extraction & Next-Question Formulation
    const extracted = extractFieldsLocally(userText, session);
    const updates = {};

    if (extracted.fullName && !session.fullName) {
      updates.fullName = extracted.fullName;
      clientWs.send(
        JSON.stringify({
          type: 'FIELD_UPDATED',
          field: 'fullName',
          value: extracted.fullName,
        })
      );
    }

    if (extracted.email && !session.email) {
      updates.email = extracted.email;
      clientWs.send(
        JSON.stringify({
          type: 'FIELD_UPDATED',
          field: 'email',
          value: extracted.email,
        })
      );
    }

    if (extracted.password && !session.password) {
      updates.password = extracted.password;
      clientWs.send(
        JSON.stringify({
          type: 'FIELD_UPDATED',
          field: 'password',
          value: extracted.password,
        })
      );
    }

    const updatedSession = { ...session, ...updates };
    await saveSession(sessionId, updatedSession);

    const isComplete = updatedSession.fullName && updatedSession.email && updatedSession.password;

    if (isComplete && !updatedSession.handoffReady) {
      updatedSession.handoffReady = true;
      await saveSession(sessionId, updatedSession);

      const handoffMessage =
        'Awesome! I have gathered all your details and found matching internships. Would you like me to go ahead and create your account now, or should we review the positions first?';

      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'HANDOFF_STATE',
            text: handoffMessage,
          })
        );
      }
      speakText(handoffMessage);
    } else {
      let nextReply = '';
      if (!updatedSession.fullName) {
        nextReply = updates.email || updates.password
          ? `Got it! What is your full name?`
          : `What is your full name?`;
      } else if (!updatedSession.email) {
        nextReply = `Nice to meet you, ${updatedSession.fullName}. What email address should we use for your account?`;
      } else if (!updatedSession.password) {
        nextReply = `Got your email! Lastly, what password would you like to set?`;
      }
      speakText(nextReply);
    }
  };

  // 4. Inbound Client Message Routing
  clientWs.on('message', async (message, isBinary) => {
    let isJson = false;
    let json = null;
    try {
      const str = message.toString('utf8');
      if (str.trim().startsWith('{')) {
        json = JSON.parse(str);
        isJson = true;
      }
    } catch (_) {}

    if (isJson && json) {
      console.log(`[VUI] Control event from client:`, json.type);
      if (json.type === 'SESSION_START') {
        console.log(`[VUI] Session registered: ${json.sessionId}`);
      } else if (json.type === 'INTERACTION_START') {
        activeInteractionId = json.interactionId;
        activeQuestionId = json.questionId || null;
        activeFieldId = json.fieldId || null;
        lastAudioSequence = -1;
        console.log(`[VUI] Interaction started: ${activeInteractionId} (Question: ${activeQuestionId}, Field: ${activeFieldId})`);
      } else if (json.type === 'COMMIT_ANSWER') {
        const { interactionId, fieldId, text, transcriptId } = json;
        if (!committedTranscripts.has(transcriptId)) {
          committedTranscripts.add(transcriptId);
          const session = await getSession(sessionId);
          if (fieldId === 'fullName' || fieldId === 'name') session.fullName = text;
          if (fieldId === 'email') session.email = text;
          if (fieldId === 'password') session.password = text;
          await saveSession(sessionId, session);

          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: 'COMMIT_CONFIRMATION',
                sessionId,
                interactionId,
                success: true,
                fieldId,
                timestamp: Date.now(),
              })
            );
          }
        }
      } else if (json.type === 'INTERACTION_CANCEL') {
        console.log(`[VUI] Interaction cancelled: ${json.interactionId} Reason: ${json.reason}`);
        if (activeInteractionId === json.interactionId) {
          activeInteractionId = null;
        }
      } else if (json.type === 'CLIENT_READY') {
        // Speak the initial greeting upon window load
        speakText('Welcome. I am your always-on assistant. How can I help you onboard today?');
      } else if (json.type === 'USER_SPEECH_FINAL') {
        // Direct transcript from client when native speech recognition is active
        if (json.transcript) {
          processTranscript(json.transcript);
        }
      } else if (json.type === 'INTERRUPT') {
        // User barge-in: close ElevenLabs generation stream and reopen clean
        if (elevenLabsWs) {
          try {
            elevenLabsWs.close();
          } catch (_) {}
          initElevenLabsStream();
        }
      }
    } else {
      // Raw 16kHz PCM audio chunk from client microphone
      if (googleRecognizeStream && !googleRecognizeStream.destroyed) {
        googleRecognizeStream.write(message);
      }
    }
  });

  clientWs.on('close', () => {
    isCleaningUp = true;
    console.log(`[VUI] Client session closed: ${sessionId}`);
    if (googleRecognizeStream) {
      try {
        googleRecognizeStream.end();
      } catch (_) {}
    }
    if (elevenLabsWs) {
      try {
        elevenLabsWs.close();
      } catch (_) {}
    }
    memoryStore.delete(sessionId);
  });
});

/**
 * Robust extraction utility that identifies name, email, and password
 * from conversational utterances even without external network dependencies.
 */
function extractFieldsLocally(text, session) {
  const result = {};
  const clean = text.trim();

  // 1. Email pattern matching
  const emailRegex = /([a-zA-Z0-9._%+-]+(?:\s*(?:at|@)\s*)[a-zA-Z0-9.-]+(?:\s*(?:dot|\.)\s*)[a-zA-Z]{2,})/i;
  const emailMatch = clean.match(emailRegex);
  if (emailMatch && !session.email) {
    let emailStr = emailMatch[0]
      .toLowerCase()
      .replace(/\s*at\s*/g, '@')
      .replace(/\s*dot\s*/g, '.')
      .replace(/\s+/g, '');
    if (emailStr.includes('@') && emailStr.includes('.')) {
      result.email = emailStr;
    }
  }

  // 2. Full Name patterns (e.g. "My name is John Doe", "I am Jane Smith", or standalone name)
  if (!session.fullName) {
    const nameIntro = clean.match(/(?:my name is|i am|i'm|call me)\s+([a-zA-Z\s]{2,30})/i);
    if (nameIntro && nameIntro[1]) {
      result.fullName = nameIntro[1].trim();
    } else if (!session.fullName && !clean.includes('@') && clean.split(' ').length >= 2 && clean.split(' ').length <= 4) {
      // If utterance is short and looks like a first & last name
      if (!/(yes|no|create|password|email|sure)/i.test(clean)) {
        result.fullName = clean;
      }
    }
  }

  // 3. Password patterns (e.g. "Password is secret123", "Set password to pass123")
  if (!session.password) {
    const passMatch = clean.match(/(?:password\s*(?:is|to)?\s*)([a-zA-Z0-9!@#$%^&*]{6,30})/i);
    if (passMatch && passMatch[1]) {
      result.password = passMatch[1].trim();
    } else if (session.fullName && session.email && clean.length >= 6 && !clean.includes(' ')) {
      // If name & email already gathered, single word token is taken as password
      result.password = clean;
    }
  }

  return result;
}

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` CareerForge Always-On Voice Streaming Server`);
  console.log(` Running on: http://localhost:${PORT}`);
  console.log(` WebSocket:  ws://localhost:${PORT}/voice-stream`);
  console.log(`====================================================`);
});
