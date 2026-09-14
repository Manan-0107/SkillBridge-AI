/**
 * audio-vad-processor.js
 * High-Performance Web AudioWorkletProcessor
 *
 * Real-time Features:
 * 1. Resamples native browser audio (44.1kHz/48kHz) to 16,000Hz linear PCM
 * 2. Converts Float32 to 16-bit Signed Integer (Int16Array linear PCM)
 * 3. Real-time Root-Mean-Square (RMS) amplitude calculation for accessibility visualizer
 * 4. Energy-based Voice Activity Detection (VAD) with speech start & silence hang-over detection
 */

class AudioVADProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.sourceSampleRate = sampleRate; // Global sampleRate in AudioWorkletGlobalScope
    this.resampleRatio = this.sourceSampleRate / this.targetSampleRate;

    // VAD thresholds & state
    this.energyThreshold = 0.02; // Threshold for active speech
    this.silenceHangoverFrames = Math.round((0.85 * this.sourceSampleRate) / 128); // ~850ms of silence
    this.isSpeaking = false;
    this.hasSpoken = false;
    this.silenceCounter = 0;
    this.resamplePhase = 0;

    this.pcmBuffer = new Int16Array(1024);
    this.pcmBufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // Mono input channel
    const inputLength = channelData.length;

    // 1. Calculate RMS energy for visual amplitude and VAD
    let sumSquares = 0;
    for (let i = 0; i < inputLength; i++) {
      const sample = channelData[i];
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / inputLength);

    // Send visual amplitude update to main thread (normalized 0 to 1)
    const normalizedAmplitude = Math.min(1, rms * 4.5);
    this.port.postMessage({
      type: "AMPLITUDE",
      level: normalizedAmplitude,
    });

    // 2. VAD State Machine
    if (rms > this.energyThreshold) {
      this.silenceCounter = 0;
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.hasSpoken = true;
        this.port.postMessage({ type: "VAD_SPEECH_START" });
      }
    } else {
      if (this.isSpeaking) {
        this.silenceCounter++;
        if (this.silenceCounter >= this.silenceHangoverFrames) {
          this.isSpeaking = false;
          this.port.postMessage({
            type: "VAD_SPEECH_END",
            durationFrames: this.silenceCounter,
          });
        }
      }
    }

    // 3. Resample to 16,000Hz mono PCM & Emit Chunks
    while (this.resamplePhase < inputLength) {
      const sampleIndex = Math.floor(this.resamplePhase);
      const floatSample = channelData[sampleIndex];

      // Clamp and convert Float32 [-1.0, 1.0] to 16-bit PCM [-32768, 32767]
      const clamped = Math.max(-1, Math.min(1, floatSample));
      const int16Sample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

      this.pcmBuffer[this.pcmBufferIndex++] = int16Sample;

      if (this.pcmBufferIndex >= this.pcmBuffer.length) {
        // Transfer copy of 16kHz PCM chunk to main thread
        const chunkToSend = new Int16Array(this.pcmBuffer);
        this.port.postMessage(
          {
            type: "PCM_CHUNK",
            buffer: chunkToSend.buffer,
            isSpeaking: this.isSpeaking,
          },
          [chunkToSend.buffer]
        );
        this.pcmBufferIndex = 0;
      }

      this.resamplePhase += this.resampleRatio;
    }

    this.resamplePhase -= inputLength;
    return true;
  }
}

registerProcessor("audio-vad-processor", AudioVADProcessor);
