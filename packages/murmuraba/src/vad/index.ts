/**
 * VAD Module Exports
 */

export { murmubaraVAD } from './murmuraba-vad';
export { extractAudioMetadata } from './audio-metadata';

export type {
  VADResult,
  VADMetric,
  VoiceSegment,
  AudioMetadata,
  VADConfig
} from './types';

// Re-export for backward compatibility
export { DEFAULT_VAD_CONFIG } from './types';