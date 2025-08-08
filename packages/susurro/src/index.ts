// Main hook - now ENFORCED through context pattern to prevent multiple instances
export { useSusurro } from './hooks/use-susurro-enforced';

// Internal use only - components should use WhisperProvider
export { useSusurro as useSusurroInternal } from './hooks/use-susurro';

// NEW: Proper engine management
export { useAudioEngineManager } from './hooks/use-audio-engine-manager';
export { getAudioEngineManager } from './lib/audio-engine-manager';

// DEPRECATED: Old engine hook - kept for compatibility
export { useAudioEngine } from './hooks/use-audio-engine';

// All audio functionality consolidated into single useSusurro hook
export * from './lib/types';
export * from './lib/ui-interfaces';
// whisper-types removed as part of dead code cleanup
export * from './lib/murmuraba-types';
// Advanced conversational evolution
export { ChunkMiddlewarePipeline } from './lib/chunk-middleware';
export * from './lib/chunk-middleware';
// Phase 3: Latency monitoring and optimization - Hook-based exports
export { LatencyMonitor } from './lib/latency-monitor';
export { useLatencyMonitor } from './hooks/use-latency-monitor';
export * from './lib/latency-monitor';

// Hook-based cache management
export { useModelCache } from './hooks/use-model-cache';

// VAD is now handled internally through murmuraba

// Murmuraba VAD - Fallback voice activity detection
export * from './lib/murmuraba-types';

// REMOVED: Singleton patterns eliminated - replaced with hook-based architecture
// REMOVED: export { audioEngineManager } from './lib/engine-manager';
// REMOVED: export { latencyMonitor } from './lib/latency-monitor';
// REMOVED: export { cacheManager } from './lib/cache-manager';

export type { UseSusurroOptions, UseSusurroReturn } from './hooks/use-susurro';

// Constants and utilities
export * from './lib/audio-constants';
export * from './lib/error-utils';
