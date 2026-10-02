/**
 * pcm-recorder-processor.js
 * High-performance AudioWorkletProcessor that samples microphone input,
 * downsamples to 16,000 Hz, 16-bit Mono Linear PCM, maintains a 250ms circular
 * pre-speech buffer to prevent initial consonant clipping, computes frame energy for VAD,
 * and attaches sequence numbers for zero-packet-loss streaming.
 */
class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.bufferSize = 2048; // ~128ms chunks at 16kHz
    this.buffer = new Int16Array(this.bufferSize);
    this.bufferIndex = 0;
    this.sequence = 0;

    // Rolling circular pre-speech buffer (~256ms = 4096 samples at 16kHz)
    this.preBufferSize = 4096;
    this.preBuffer = new Int16Array(this.preBufferSize);
    this.preBufferIndex = 0;
    this.preBufferFilled = false;

    this.port.onmessage = (event) => {
      const { command } = event.data || {};
      if (command === 'RESET_SEQUENCE') {
        this.sequence = 0;
      } else if (command === 'FLUSH_PREBUFFER') {
        this._flushPreBuffer();
      }
    };
  }

  _flushPreBuffer() {
    // Deliver the captured pre-speech audio prior to active speech stream
    if (!this.preBufferFilled && this.preBufferIndex === 0) return;
    const len = this.preBufferFilled ? this.preBufferSize : this.preBufferIndex;
    const ordered = new Int16Array(len);

    if (this.preBufferFilled) {
      const firstPart = this.preBuffer.subarray(this.preBufferIndex);
      const secondPart = this.preBuffer.subarray(0, this.preBufferIndex);
      ordered.set(firstPart, 0);
      ordered.set(secondPart, firstPart.length);
    } else {
      ordered.set(this.preBuffer.subarray(0, this.preBufferIndex), 0);
    }

    this.port.postMessage({
      type: 'prebuffer_chunk',
      sequence: this.sequence++,
      energy: this._calcRMS(ordered),
      pcm: ordered.buffer,
      timestamp: Date.now(),
    }, [ordered.buffer]);

    this.preBufferIndex = 0;
    this.preBufferFilled = false;
  }

  _calcRMS(int16Arr) {
    if (!int16Arr || int16Arr.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < int16Arr.length; i += 4) { // step by 4 for high performance
      const norm = int16Arr[i] / 32768;
      sum += norm * norm;
    }
    return Math.sqrt(sum / (int16Arr.length / 4));
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const inputChannel = input[0]; // Float32 mono channel
    const actualSampleRate = typeof sampleRate !== 'undefined' ? sampleRate : 48000;
    const ratio = actualSampleRate / this.targetSampleRate;

    for (let i = 0; i < inputChannel.length; i += ratio) {
      const index = Math.floor(i);
      if (index >= inputChannel.length) break;

      // Convert Float32 [-1.0, 1.0] to 16-bit Signed Integer [-32768, 32767]
      let s = Math.max(-1, Math.min(1, inputChannel[index]));
      const sample16 = s < 0 ? s * 0x8000 : s * 0x7fff;

      // 1. Write to rolling pre-buffer ring
      this.preBuffer[this.preBufferIndex++] = sample16;
      if (this.preBufferIndex >= this.preBufferSize) {
        this.preBufferIndex = 0;
        this.preBufferFilled = true;
      }

      // 2. Write to streaming buffer
      this.buffer[this.bufferIndex++] = sample16;

      if (this.bufferIndex >= this.bufferSize) {
        const chunk = this.buffer.slice(0, this.bufferSize);
        const energy = this._calcRMS(chunk);

        // Send rich structured message with ArrayBuffer transfer
        this.port.postMessage({
          type: 'pcm_chunk',
          sequence: this.sequence++,
          energy,
          pcm: chunk.buffer,
          timestamp: Date.now(),
        }, [chunk.buffer]);

        this.bufferIndex = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-recorder-processor', PCMRecorderProcessor);
