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

  // Recording Configuration - UNIFIED ARCHITECTURE
  // All chunks are MINIMUM 20 seconds, cut only at first VAD=0 after 20 sec
  RECORDING: {
    // UNIFIED: Single chunk duration for entire app
    DEFAULT_CHUNK_DURATION_MS: 20000, // 20 seconds MINIMUM
    MIN_CHUNK_DURATION_MS: 20000, // Hard minimum - no shorter chunks
    MAX_CHUNK_DURATION_MS: 60000, // Maximum if no VAD=0 found (1 minute)

    // VAD-based smart cutting
    VAD_CUT_THRESHOLD: 0.0, // Only cut when VAD=0 (complete silence)
    VAD_EVAL_START_MS: 20000, // Start looking for VAD=0 after 20 seconds
  },

  // Legacy presets removed - using single unified chunk duration
  // All components use RECORDING.DEFAULT_CHUNK_DURATION_MS (20 seconds)

  // Engine Configuration Presets
  ENGINE_PRESETS: {
    // Low latency, real-time
    LOW_LATENCY: {
      bufferSize: 1024 as 256 | 512 | 1024 | 2048 | 4096,
      denoiseStrength: 0.3,
      noiseReductionLevel: 'low' as const,
      algorithm: 'rnnoise' as const,
    },
    // Balanced quality and performance
    BALANCED: {
      bufferSize: 2048 as 256 | 512 | 1024 | 2048 | 4096,
      denoiseStrength: 0.5,
      noiseReductionLevel: 'medium' as const,
      algorithm: 'rnnoise' as const,
    },
    // Maximum quality
    HIGH_QUALITY: {
      bufferSize: 4096 as 256 | 512 | 1024 | 2048 | 4096,
      denoiseStrength: 0.7,
      noiseReductionLevel: 'high' as const,
      algorithm: 'rnnoise' as const,
    },
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
    FALLBACK: ['whisper-tiny', 'Xenova/whisper-base', 'Xenova/whisper-small'],
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
