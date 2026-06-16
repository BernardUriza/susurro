/**
 * Murmuraba v1.5.0
 * Real-time audio noise reduction with comprehensive UI component library
 */

// Core exports
export { MurmubaraEngine } from './core/murmuraba-engine';
export { EventEmitter } from './core/event-emitter';
export { StateManager } from './core/state-manager';
export { Logger } from './core/logger';

// Manager exports
export { WorkerManager } from './managers/worker-manager';
export { MetricsManager } from './managers/metrics-manager';

// Engine exports
export { AudioWorkletEngine } from './engines/audio-worklet-engine';
export { RNNoiseEngine } from './engines/rnnoise-engine';
export type { AudioEngine } from './engines/types';

// Type exports
export * from './types';

// Re-export API functions
export {
  initializeAudioEngine,
  getEngine,
  processStream,
  processStreamChunked,
  destroyEngine,
  getEngineStatus,
  getDiagnostics,
  onMetricsUpdate,
  processFile
} from './api';

// Export enhanced processing functions
export { 
  processFileWithMetrics,
  type ProcessingMetrics,
  type ProcessFileWithMetricsResult
} from './api/process-file-with-metrics';

// Export version
export const VERSION = '3.0.0';
export const MURMURABA_VERSION = VERSION;

// Re-export error codes
export { ErrorCodes } from './types';

// UI Component exports - Professional Audio Interface Components
export { AudioPlayer } from './components/audio-player/audio-player';
export { AdvancedMetricsPanel } from './components/advanced-metrics-panel/advanced-metrics-panel';
export { ChunkProcessingResults } from './components/chunk-processing-results/chunk-processing-results';
export type { IChunkProcessingResultsProps } from './components/chunk-processing-results/chunk-processing-results';
export { SimpleWaveformAnalyzer } from './components/simple-waveform-analyzer/simple-waveform-analyzer';

// Audio Visualization Components
export { WaveformAnalyzer } from './components/waveform-analyzer/waveform-analyzer';
export { SyncedWaveforms } from './components/synced-waveforms/synced-waveforms';

// Utility Components
export { ErrorBoundary, withErrorBoundary } from './components/error-boundary/error-boundary';
export { 
  BuildInfo, 
  BuildInfoBadge, 
  BuildInfoBlock, 
  BuildInfoInline,
  getPackageVersion,
  formatBuildDate 
} from './components/build-info/build-info';

// Hook exports at the end to avoid circular dependency
export { useMurmubaraEngine } from './hooks/use-murmubara-engine';
export { useAudioEngine } from './hooks/use-audio-engine';

// Audio converter utility export
export { AudioConverter, getAudioConverter } from './utils/audio-converter';

// VAD exports
export { murmubaraVAD, extractAudioMetadata } from './vad';
export type { 
  VADResult, 
  VADMetric, 
  VoiceSegment, 
  AudioMetadata,
  VADConfig 
} from './vad';

// Export types from the hook
export type { 
  ProcessedChunk, 
  RecordingState, 
  UseMurmubaraEngineOptions, 
  UseMurmubaraEngineReturn 
} from './hooks/use-murmubara-engine';

// Import for default export
import { useMurmubaraEngine } from './hooks/use-murmubara-engine';
import { useAudioEngine } from './hooks/use-audio-engine';
import { MurmubaraEngine } from './core/murmuraba-engine';

// Default export for easier usage
const murmurabaExports = {
  // Core functionality
  useMurmubaraEngine,
  useAudioEngine,
  MurmubaraEngine
};

export default murmurabaExports;