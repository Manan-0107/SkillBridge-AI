/**
 * accessible-voice-client.js
 * End-to-End Always-On Voice UI Client for Blind and Visually Impaired Users.
 *
 * Core Capabilities:
 *  - Automatic instant initialization on window.onload
 *  - Screen-reader friendly non-blocking autoplay unlock fallback
 *  - Low-latency AudioWorklet PCM streaming (16kHz 16-bit Mono)
 *  - Real-time scheduled streaming audio playback of TTS PCM chunks (<20ms jitter buffer)
 *  - Barge-in cancellation on user utterance
 *  - Direct synchronization with CareerForge AuthGate form inputs
 */

class AccessibleVoiceClient {
  constructor(options = {}) {
    // Port 8081 is default for the voice-stream-server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    const port = options.port || 8081;
    this.wsUrl = options.wsUrl || `${protocol}//${host}:${port}/voice-stream`;

    this.ws = null;
    this.audioCtx = null;
    this.micStream = null;
    this.workletNode = null;

    // Playback scheduling state
    this.nextStartTime = 0;
    this.activeSourceNodes = new Set();
    this.isAssistantSpeaking = false;
    this.userInterrupted = false;

    // Accessibility state
    this.ariaLiveElement = this._getOrCreateAriaLiveRegion();
    this.status = 'idle'; // idle | connecting | listening | speaking | handoff | completed
  }

  /**
   * Initializes the client on window load.
   */
  async initOnLoad() {
    this._updateStatus('connecting', 'Connecting to always-on voice assistant...');
    this._announceToScreenReader('Connecting to always-on voice assistant.');

    // 1. Establish persistent bi-directional WebSocket connection
    this._connectWebSocket();

    // 2. Prepare Web Audio Context
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('[VUI] Web Audio API not supported in this browser.');
      return;
    }

    this.audioCtx = new AudioContextClass({ sampleRate: 16000 });

    // 3. Handle browser autoplay policy restrictions smoothly
    if (this.audioCtx.state === 'suspended') {
      const unlockAudio = async () => {
        try {
          await this.audioCtx.resume();
          await this._startMicPipeline();
        } catch (err) {
          console.error('[VUI] Error resuming audio context:', err);
        } finally {
          window.removeEventListener('keydown', unlockAudio);
          window.removeEventListener('pointerdown', unlockAudio);
        }
      };

      window.addEventListener('keydown', unlockAudio, { once: true });
      window.addEventListener('pointerdown', unlockAudio, { once: true });
      this._announceToScreenReader('Press any key or tap anywhere to enable voice onboarding.');
      this._updateStatus('connecting', 'Press any key or tap anywhere to start voice onboarding.');
    } else {
      await this._startMicPipeline();
    }
  }

  _connectWebSocket() {
    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('[VUI] WebSocket stream established.');
        this._updateStatus('listening', 'Voice assistant connected. Listening...');
        // Handshake: request immediate welcome greeting
        this.ws.send(JSON.stringify({ type: 'CLIENT_READY' }));
      };

      this.ws.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          try {
            const message = JSON.parse(event.data);
            this._handleControlMessage(message);
          } catch (e) {
            console.error('[VUI] JSON parse error:', e);
          }
        } else if (event.data instanceof ArrayBuffer) {
          // Streaming TTS PCM chunk received from backend
          await this._enqueueAudioChunk(event.data);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[VUI] WebSocket error:', err);
      };

      this.ws.onclose = () => {
        console.log('[VUI] WebSocket stream closed. Reconnecting in 1.5s...');
        this._updateStatus('connecting', 'Reconnecting to voice assistant...');
        setTimeout(() => this._connectWebSocket(), 1500);
      };
    } catch (err) {
      console.error('[VUI] WebSocket initialization failed:', err);
    }
  }

  async _startMicPipeline() {
    if (this.micStream) return; // already active

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      await this.audioCtx.audioWorklet.addModule('/pcm-recorder-processor.js');
      const micSource = this.audioCtx.createMediaStreamSource(this.micStream);
      this.workletNode = new AudioWorkletNode(this.audioCtx, 'pcm-recorder-processor');

      this.workletNode.port.onmessage = (event) => {
        const pcmInt16Buffer = event.data; // Int16Array
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(pcmInt16Buffer.buffer);
        }
      };

      micSource.connect(this.workletNode);
      this._updateStatus('listening', 'Always-on microphone active.');
      console.log('[VUI] Raw 16kHz PCM microphone stream active.');

      // Native SpeechRecognition backup for local environments
      const SpeechRecClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecClass) {
        try {
          const rec = new SpeechRecClass();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'en-US';

          rec.onresult = (e) => {
            let interim = '';
            let final = '';
            for (let i = e.resultIndex; i < e.results.length; ++i) {
              if (e.results[i].isFinal) {
                final += e.results[i][0].transcript;
              } else {
                interim += e.results[i][0].transcript;
              }
            }
            if (this.isAssistantSpeaking && (final || interim)) {
              this.interruptPlayback();
            }
            if (final && this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'USER_SPEECH_FINAL', transcript: final.trim() }));
            }
          };

          rec.onerror = () => {};
          rec.onend = () => {
            if (this.status !== 'idle' && this.status !== 'completed') {
              try {
                rec.start();
              } catch (_) {}
            }
          };

          rec.start();
        } catch (_) {}
      }
    } catch (err) {
      console.warn('[VUI] Microphone access denied or unavailable:', err);
      this._announceToScreenReader('Microphone access is needed for hands-free voice onboarding.');
      this._updateStatus('idle', 'Microphone access denied. Please grant permission.');
    }
  }

  /**
   * Continuous zero-latency PCM audio scheduler.
   * Plays streaming audio chunks gaplessly without waiting for full sentences.
   */
  async _enqueueAudioChunk(arrayBuffer) {
    if (this.userInterrupted || !this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    // Convert raw 16-bit Linear PCM to Float32 [-1.0, 1.0]
    const int16 = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const audioBuffer = this.audioCtx.createBuffer(1, float32.length, 16000);
    audioBuffer.copyToChannel(float32, 0);

    const source = this.audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioCtx.destination);

    const currentTime = this.audioCtx.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime + 0.02; // 20ms lead-in buffer
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;

    this.activeSourceNodes.add(source);
    this.isAssistantSpeaking = true;
    this._updateStatus('speaking', 'Assistant speaking...');

    source.onended = () => {
      this.activeSourceNodes.delete(source);
      if (this.activeSourceNodes.size === 0) {
        this.isAssistantSpeaking = false;
        this._updateStatus('listening', 'Listening for your response...');
      }
    };
  }

  /**
   * Barge-in interruption handler.
   * Immediately halts active audio playback when the user begins speaking.
   */
  interruptPlayback() {
    if (this.isAssistantSpeaking) {
      for (const node of this.activeSourceNodes) {
        try {
          node.stop(0);
        } catch (_) {}
      }
      this.activeSourceNodes.clear();
      this.nextStartTime = 0;
      this.isAssistantSpeaking = false;

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'INTERRUPT' }));
      }
      console.log('[VUI] Assistant speech interrupted by user barge-in.');
      this._updateStatus('listening', 'Listening...');
    }
  }

  _handleControlMessage(msg) {
    switch (msg.type) {
      case 'TRANSCRIPTION_INTERIM':
        if (msg.transcript) {
          // If assistant is currently speaking and user speaks, trigger immediate barge-in
          if (this.isAssistantSpeaking && msg.isSpeaking) {
            this.interruptPlayback();
          }
          this._dispatchCustomEvent('careerforge:vui-transcript', {
            transcript: msg.transcript,
            isFinal: false,
          });
        }
        break;

      case 'TRANSCRIPTION_FINAL':
        this._dispatchCustomEvent('careerforge:vui-transcript', {
          transcript: msg.transcript,
          isFinal: true,
        });
        break;

      case 'FIELD_UPDATED':
        this._updateDomField(msg.field, msg.value);
        this._dispatchCustomEvent('careerforge:auth-value', {
          field: msg.field,
          value: msg.value,
        });
        break;

      case 'AGENT_SPEAKING':
        this._announceToScreenReader(msg.text);
        this._dispatchCustomEvent('careerforge:vui-message', { text: msg.text });
        break;

      case 'AGENT_SPEAKING_FALLBACK':
        this._announceToScreenReader(msg.text);
        this._dispatchCustomEvent('careerforge:vui-message', { text: msg.text });
        if ('speechSynthesis' in window) {
          try {
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(msg.text);
            utter.rate = 0.95;
            this.isAssistantSpeaking = true;
            this._updateStatus('speaking', 'Assistant speaking...');
            utter.onend = () => {
              this.isAssistantSpeaking = false;
              this._updateStatus('listening', 'Listening for your response...');
            };
            window.speechSynthesis.speak(utter);
          } catch (_) {}
        }
        break;

      case 'HANDOFF_STATE':
        this._updateStatus('handoff', msg.text || 'All details gathered. Ready for confirmation.');
        break;

      case 'ONBOARDING_COMPLETE':
        this._updateStatus('completed', 'Account details confirmed! Launching workspace...');
        this._announceToScreenReader('Account creation confirmed. Logging you in now.');
        this._dispatchCustomEvent('careerforge:auth-complete', {
          payload: msg.payload,
        });
        break;
    }
  }

  _updateDomField(field, value) {
    const inputMap = {
      fullName: '#auth-name-input, input[name="name"]',
      email: '#auth-email-input, input[name="email"]',
      password: '#auth-password-input, input[name="password"]',
    };

    const selector = inputMap[field] || `input[name="${field}"]`;
    const input = document.querySelector(selector);
    if (input) {
      input.value = value;
      // Trigger React synthetic input listeners
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      this._announceToScreenReader(`${field} recorded as ${value}`);
    }
  }

  _updateStatus(state, message) {
    this.status = state;
    this._dispatchCustomEvent('careerforge:vui-status', { state, message });
  }

  _dispatchCustomEvent(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  _getOrCreateAriaLiveRegion() {
    let el = document.getElementById('vui-aria-announcer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'vui-aria-announcer';
      el.setAttribute('aria-live', 'assertive');
      el.setAttribute('aria-atomic', 'true');
      el.className = 'sr-only';
      el.style.cssText = 'position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;';
      if (document.body) {
        document.body.appendChild(el);
      } else {
        window.addEventListener('DOMContentLoaded', () => document.body.appendChild(el));
      }
    }
    return el;
  }

  _announceToScreenReader(text) {
    if (this.ariaLiveElement) {
      this.ariaLiveElement.textContent = text;
    }
  }
}

// Global initialization
if (typeof window !== 'undefined') {
  const initClient = () => {
    if (!window.vuiClient) {
      window.vuiClient = new AccessibleVoiceClient();
      window.vuiClient.initOnLoad();
    }
  };

  if (document.readyState === 'complete') {
    initClient();
  } else {
    window.addEventListener('load', initClient);
  }
}
