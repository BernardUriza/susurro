export { useSusurro } from './hooks/use-susurro';
// All audio functionality consolidated into single useSusurro hook
// useWhisperDirect is internal - accessed through useSusurro
export * from './lib/types';
export * from './lib/ui-interfaces';
export * from './lib/whisper-types';
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

// REMOVED: Singleton patterns eliminated - replaced with hook-based architecture
// REMOVED: export { audioEngineManager } from './lib/engine-manager';
// REMOVED: export { latencyMonitor } from './lib/latency-monitor';
// REMOVED: export { cacheManager } from './lib/cache-manager';

export type { UseSusurroOptions, UseSusurroReturn } from './hooks/use-susurro';
