// Main hook export
export { useMurmubaraEngine } from './use-murmubara-engine';

// Type exports
export type {
  ProcessedChunk,
  RecordingState,
  UseMurmubaraEngineOptions,
  UseMurmubaraEngineReturn
} from './types';

// Constant exports for external use
export {
  MAX_CHUNKS_IN_MEMORY,
  CHUNKS_TO_KEEP_ON_OVERFLOW,
  DEFAULT_CHUNK_DURATION,
  DEFAULT_MP3_BITRATE,
  SUPPORTED_MIME_TYPES
} from './constants';