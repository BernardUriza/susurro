/**
 * Audio Processing Constants
 * Centralized configuration for all audio-related magic numbers
 */

export const AUDIO_CONFIG = {
  // Sample rates
  SAMPLE_RATE: 44100,
  ALTERNATIVE_SAMPLE_RATE: 48000,

  // VAD Configuration
  VAD: {
    FRAME_SAMPLES: 1536, // 32ms at 48kHz
    POSITIVE_THRESHOLD: 0.6,
    NEGATIVE_THRESHOLD: 0.4,
    MIN_SPEECH_DURATION_MS: 250,
    PRE_SPEECH_PAD_FRAMES: 1,
    POST_SPEECH_PAD_FRAMES: 1,
  },

  // Recording Configuration
  RECORDING: {
    DEFAULT_CHUNK_DURATION_MS: 8000,
    STREAMING_CHUNK_DURATION_MS: 3000,
    MIN_CHUNK_DURATION_MS: 1000,
    MAX_CHUNK_DURATION_MS: 30000,
  },

  // Timeouts
  TIMEOUTS: {
    MODEL_DOWNLOAD_MS: 180000, // 3 minutes
    TRANSCRIPTION_MS: 120000, // 2 minutes
    CHUNK_EMISSION_MS: 2000,
    ENGINE_RESET_DELAY_MS: 100,
    DEPENDENCY_PRELOAD_MS: 2000,
  },

  // Buffer sizes
  BUFFERS: {
    AUDIO_WORKLET_SIZE: 128,
    PROCESSING_BUFFER_SIZE: 4096,
    MAX_AUDIO_CHUNKS: 50,
  },

  // Thresholds
  THRESHOLDS: {
    MIN_AUDIO_LEVEL: 0.01,
    SILENCE_THRESHOLD: 0.02,
    NOISE_GATE: 0.001,
  },

  // WebGPU/Performance
  PERFORMANCE: {
    WEBGPU_PREFERRED: true,
    QUANTIZATION_BITS: 4,
    MAX_CONCURRENT_WORKERS: 4,
  },
} as const;

export const WHISPER_CONFIG = {
  // Model configurations
  MODELS: {
    DISTIL_LARGE_V3: 'Xenova/distil-whisper/distil-large-v3',
    FALLBACK: ['whisper-tiny', 'Xenova/whisper-base.en', 'Xenova/whisper-small.en'],
  },

  // Processing
  CHUNK_LENGTH_S: 30,
  STRIDE_LENGTH_S: 5,

  // Cache
  CACHE_DIR: 'transformers-cache',
  USE_BROWSER_CACHE: true,
} as const;

export const ERROR_MESSAGES = {
  ENGINE_INIT_FAILED: 'Failed to initialize audio engine',
  TRANSCRIPTION_FAILED: 'Transcription failed',
  VAD_ANALYSIS_FAILED: 'VAD analysis failed',
  RECORDING_FAILED: 'Failed to start recording',
  STREAM_ACCESS_DENIED: 'Microphone access denied',
  MODEL_LOAD_FAILED: 'Failed to load Whisper model',
  AUDIO_CONTEXT_FAILED: 'Failed to create audio context',
} as const;
