class AudioProcessorWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isProcessing = false;
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    
    // Audio analysis parameters
    this.rmsThreshold = 0.01;
    this.silenceThreshold = 0.005;
    this.silenceDuration = 0;
    this.maxSilenceDuration = 0.5; // 500ms of silence
    
    this.port.onmessage = (event) => {
      if (event.data.type === 'start') {
        this.isProcessing = true;
        console.log('[AudioWorklet] Started processing');
      } else if (event.data.type === 'stop') {
        this.isProcessing = false;
        console.log('[AudioWorklet] Stopped processing');
      } else if (event.data.type === 'config') {
        const { rmsThreshold, silenceThreshold, maxSilenceDuration } = event.data;
        if (rmsThreshold) this.rmsThreshold = rmsThreshold;
        if (silenceThreshold) this.silenceThreshold = silenceThreshold;
        if (maxSilenceDuration) this.maxSilenceDuration = maxSilenceDuration;
      }
    };
  }

  calculateRMS(samples) {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (!this.isProcessing || !input.length) {
      return true;
    }
    
    const inputChannel = input[0];
    const outputChannel = output[0];
    
    // Copy input to output
    outputChannel.set(inputChannel);
    
    // Calculate RMS for voice activity detection
    const rms = this.calculateRMS(inputChannel);
    
    // Detect silence
    if (rms < this.silenceThreshold) {
      this.silenceDuration += inputChannel.length / sampleRate;
    } else {
      this.silenceDuration = 0;
    }
    
    // Add samples to buffer
    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.bufferIndex++] = inputChannel[i];
      
      // When buffer is full, send it to main thread
      if (this.bufferIndex >= this.bufferSize) {
        this.port.postMessage({
          type: 'audio-chunk',
          data: this.buffer.slice(),
          rms: rms,
          timestamp: currentTime,
          isSilent: this.silenceDuration > this.maxSilenceDuration
        });
        
        this.bufferIndex = 0;
      }
    }
    
    // Send periodic updates
    if (currentFrame % 4800 === 0) { // ~100ms at 48kHz
      this.port.postMessage({
        type: 'status',
        rms: rms,
        silenceDuration: this.silenceDuration,
        isActive: rms > this.rmsThreshold
      });
    }
    
    return true;
  }
}

registerProcessor('audio-processor-worklet', AudioProcessorWorklet);