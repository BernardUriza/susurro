export { useSusurro } from './hooks/useSusurro';
// All audio functionality consolidated into single useSusurro hook
// useWhisperDirect is internal - accessed through useSusurro
// REMOVED: Singleton pattern eliminated in Murmuraba v3
// export { murmurabaManager } from './lib/murmuraba-singleton';
export * from './lib/types';
export * from './lib/ui-interfaces';
export * from './lib/whisper-types';
export * from './lib/murmuraba-types';
// Advanced conversational evolution
export { ChunkMiddlewarePipeline } from './lib/chunk-middleware';
export * from './lib/chunk-middleware';
// Phase 3: Latency monitoring and optimization
export { latencyMonitor } from './lib/latency-monitor';
export * from './lib/latency-monitor';

// Export the global engine manager for external control
export { audioEngineManager } from './lib/engine-manager';

export type { UseSusurroOptions, UseSusurroReturn } from './hooks/useSusurro';
