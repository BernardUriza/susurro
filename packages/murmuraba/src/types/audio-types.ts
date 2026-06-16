export type EngineState = 
  | 'uninitialized'
  | 'initializing'
  | 'loading-wasm'
  | 'creating-context' 
  | 'ready'
  | 'processing'
  | 'paused'
  | 'destroying'
  | 'destroyed'
  | 'error'
  | 'degraded';

export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';
export type NoiseReductionLevel = 'low' | 'medium' | 'high' | 'auto';
export type Algorithm = 'rnnoise' | 'spectral' | 'adaptive';
export type BufferSize = 256 | 512 | 1024 | 2048 | 4096;

export interface MurmubaraConfig {
  logLevel?: LogLevel;
  onLog?: (level: LogLevel, message: string, data?: any) => void;
  noiseReductionLevel?: NoiseReductionLevel;
  bufferSize?: BufferSize;
  algorithm?: Algorithm;
  autoCleanup?: boolean;
  cleanupDelay?: number;
  useWorker?: boolean;
  workerPath?: string;
  allowDegraded?: boolean;
  useAudioWorklet?: boolean;
  inputGain?: number; // Input gain multiplier, default 1.0, range 0.5-3.0
}

export interface StreamController {
  stream: MediaStream;
  processor: AudioProcessor;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  getState: () => EngineState;
}

export interface AudioProcessor {
  id: string;
  state: EngineState;
  inputNode?: AudioNode;
  outputNode?: AudioNode;
}

export interface ProcessingMetrics {
  noiseReductionLevel: number;
  processingLatency: number;
  inputLevel: number;
  outputLevel: number;
  timestamp: number;
  frameCount: number;
  droppedFrames: number;
  vadLevel?: number; // Voice Activity Detection level 0-1
  averageVad?: number; // Average VAD over recent frames
  isVoiceActive?: boolean; // Whether voice is currently detected
}

export interface ChunkMetrics {
  originalSize: number;
  processedSize: number;
  noiseRemoved: number;
  metrics: ProcessingMetrics;
  /** Duration in milliseconds */
  duration: number;
  /** Start time in milliseconds */
  startTime: number;
  /** End time in milliseconds */
  endTime: number;
  vadData?: Array<{ time: number; vad: number; }>;
  averageVad?: number;
}

// Enhanced chunk interface used in recording functionality
export interface ChunkData extends ChunkMetrics {
  id: string;
  index: number;
  processedAudioUrl?: string;
  originalAudioUrl?: string;
  isPlaying: boolean;
  isExpanded: boolean;
  isValid?: boolean;
  errorMessage?: string;
  currentlyPlayingType?: 'processed' | 'original' | null;
}

export interface ChunkConfig {
  chunkDuration: number;
  onChunkProcessed?: (chunk: ChunkMetrics) => void;
  overlap?: number;
}

export interface DiagnosticInfo {
  version: string;
  engineVersion: string;
  reactVersion: string;
  browserInfo?: {
    name: string;
    version: string;
    audioAPIsSupported: string[];
  };
  wasmLoaded: boolean;
  activeProcessors: number;
  memoryUsage: number;
  processingTime: number;
  engineState: EngineState;
  capabilities?: {
    hasWASM: boolean;
    hasAudioContext: boolean;
    hasWorklet: boolean;
    maxChannels: number;
  };
  errors?: Array<{ timestamp: number; error: string }>;
  initializationLog?: string[];
  performanceMetrics?: {
    wasmLoadTime: number;
    contextCreationTime: number;
    totalInitTime: number;
  };
  systemInfo?: {
    memory?: number;
  };
  // Real-time metrics for v2 Engine Diagnostics
  bufferUsage?: number;
  currentLatency?: number;
  frameRate?: number;
  activeStreams?: number;
  noiseReductionLevel?: number;
  audioQuality?: string;
}

export interface EngineEvents {
  initialized: () => void;
  'processing-start': () => void;
  'processing-end': () => void;
  destroyed: () => void;
  error: (error: MurmubaraError) => void;
  'state-change': (oldState: EngineState, newState: EngineState) => void;
  'metrics-update': (metrics: ProcessingMetrics) => void;
  'degraded-mode': () => void;
  'user-gesture-required': () => void;
  'audio-context-resumed': () => void;
  [key: string]: (...args: any[]) => void;
}

export class MurmubaraError extends Error {
  code: string;
  details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'MurmubaraError';
    this.code = code;
    this.details = details;
  }
}

export interface DiagnosticReport {
  timestamp: number;
  tests: Array<{
    name: string;
    passed: boolean;
    message: string;
    duration: number;
  }>;
  passed: number;
  failed: number;
  warnings: number;
}

export const ErrorCodes = {
  WASM_NOT_LOADED: 'WASM_NOT_LOADED',
  INVALID_STREAM: 'INVALID_STREAM',
  ENGINE_BUSY: 'ENGINE_BUSY',
  INITIALIZATION_FAILED: 'INITIALIZATION_FAILED',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  CLEANUP_FAILED: 'CLEANUP_FAILED',
  WORKER_ERROR: 'WORKER_ERROR',
  INVALID_CONFIG: 'INVALID_CONFIG',
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  ALREADY_INITIALIZED: 'ALREADY_INITIALIZED',
} as const;