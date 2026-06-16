/**
 * Medical-grade recording constants for hospital use
 * These values are optimized for long medical consultations
 */

// Memory management for long recordings
export const MAX_CHUNKS_IN_MEMORY = 100; // ~13 minutes at 8s chunks
export const CHUNKS_TO_KEEP_ON_OVERFLOW = 90; // Keep most recent chunks when limit reached

// Recording quality settings
export const MIN_VALID_BLOB_SIZE = 100; // 100 bytes minimum for valid audio
export const DEFAULT_CHUNK_DURATION = 20; // seconds - optimal for long recordings
export const RECORDING_UPDATE_INTERVAL = 100; // ms

// Audio export settings
export const DEFAULT_MP3_BITRATE = 128; // kbps
export const SUPPORTED_MIME_TYPES = {
  WEBM: 'audio/webm',
  MP3: 'audio/mp3',
  WAV: 'audio/wav'
} as const;

// Medical logging prefixes
export const LOG_PREFIX = {
  LIFECYCLE: '[LIFECYCLE]',
  CONCAT_STREAM: '[CONCAT-STREAM]',
  MEDICAL_MEMORY: '[MEDICAL-MEMORY]',
  ERROR: '[ERROR]',
  EXPORT: '[EXPORT]',
  RECORDING: '[RECORDING]'
} as const;