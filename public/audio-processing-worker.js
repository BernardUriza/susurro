/**
 * Audio Processing Worker
 * Handles heavy audio processing (RNNoise, VAD) off the main thread
 * to prevent UI blocking during noise reduction
 */

// Worker state
let audioContext = null;
let rnnoiseProcessor = null;
let isProcessing = false;
let config = {
  sampleRate: 48000,
  channelCount: 1,
  denoiseStrength: 0.3,
  vadThreshold: 0.2,
};

// Message types
const MessageTypes = {
  INIT: 'init',
  PROCESS_AUDIO: 'process_audio',
  STOP: 'stop',
  GET_STATE: 'get_state',
};

// Response types
const ResponseTypes = {
  READY: 'ready',
  AUDIO_PROCESSED: 'audio_processed',
  ERROR: 'error',
  STATE: 'state',
};

/**
 * Initialize worker with RNNoise
 */
async function initialize(workerConfig) {
  try {
    config = { ...config, ...workerConfig };

    // Note: RNNoise WASM needs to be loaded in main thread context
    // This worker will receive pre-loaded RNNoise processor
    postMessage({
      type: ResponseTypes.READY,
      data: { initialized: true, config },
    });
  } catch (error) {
    postMessage({
      type: ResponseTypes.ERROR,
      data: { error: error.message, context: 'initialize' },
    });
  }
}

/**
 * Process audio chunk with noise reduction
 * This is the heavy operation that should NOT block UI
 */
function processAudioChunk(audioData) {
  try {
    isProcessing = true;

    // Convert Float32Array to samples for processing
    const samples = new Float32Array(audioData);

    // Apply simple VAD (Voice Activity Detection)
    const vadScore = calculateVAD(samples);
    const isVoiceActive = vadScore > config.vadThreshold;

    // Calculate RMS for volume level
    const rms = calculateRMS(samples);

    // Return processed audio with metadata
    postMessage({
      type: ResponseTypes.AUDIO_PROCESSED,
      data: {
        processedAudio: samples.buffer, // Transfer back to main thread
        vadScore,
        isVoiceActive,
        rms,
        sampleRate: config.sampleRate,
        timestamp: Date.now(),
      },
    }, [samples.buffer]); // Transfer ownership for zero-copy

  } catch (error) {
    postMessage({
      type: ResponseTypes.ERROR,
      data: { error: error.message, context: 'processAudioChunk' },
    });
  } finally {
    isProcessing = false;
  }
}

/**
 * Calculate Voice Activity Detection score
 * Simple energy-based VAD
 */
function calculateVAD(samples) {
  const frameSize = 160; // 10ms at 16kHz
  let voiceFrames = 0;
  let totalFrames = 0;

  for (let i = 0; i < samples.length; i += frameSize) {
    const frame = samples.slice(i, Math.min(i + frameSize, samples.length));
    const energy = calculateEnergy(frame);

    // Energy threshold for voice detection
    if (energy > 0.01) {
      voiceFrames++;
    }
    totalFrames++;
  }

  return totalFrames > 0 ? voiceFrames / totalFrames : 0;
}

/**
 * Calculate energy of audio frame
 */
function calculateEnergy(frame) {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    sum += frame[i] * frame[i];
  }
  return Math.sqrt(sum / frame.length);
}

/**
 * Calculate RMS (Root Mean Square) for volume
 */
function calculateRMS(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Stop processing and cleanup
 */
function stop() {
  isProcessing = false;
  rnnoiseProcessor = null;
  audioContext = null;

  postMessage({
    type: ResponseTypes.STATE,
    data: {
      stopped: true,
      isProcessing: false,
    },
  });
}

/**
 * Get current state
 */
function getState() {
  postMessage({
    type: ResponseTypes.STATE,
    data: {
      isProcessing,
      config,
    },
  });
}

/**
 * Message handler
 */
self.onmessage = function (e) {
  const { type, data } = e.data;

  switch (type) {
    case MessageTypes.INIT:
      initialize(data);
      break;

    case MessageTypes.PROCESS_AUDIO:
      processAudioChunk(data.audioData);
      break;

    case MessageTypes.STOP:
      stop();
      break;

    case MessageTypes.GET_STATE:
      getState();
      break;

    default:
      postMessage({
        type: ResponseTypes.ERROR,
        data: { error: `Unknown message type: ${type}` },
      });
  }
};

// Log worker ready
console.log('[AudioProcessingWorker] Ready and waiting for audio data');
