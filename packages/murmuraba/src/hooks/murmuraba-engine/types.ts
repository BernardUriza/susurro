import {
  MurmubaraConfig,
  ChunkMetrics,
  ChunkData,
  EngineState,
  ProcessingMetrics,
  DiagnosticInfo,
  StreamController
} from '../../types';

// ProcessedChunk is now an alias for ChunkData for consistent typing
export type ProcessedChunk = ChunkData;

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  chunks: ChunkData[];
  playingChunks: { [key: string]: boolean };
  expandedChunk: string | null;
}

export interface UseMurmubaraEngineOptions extends MurmubaraConfig {
  autoInitialize?: boolean;
  defaultChunkDuration?: number;
  fallbackToManual?: boolean;
  onInitError?: (error: Error) => void;
  react19Mode?: boolean;
}

export interface UseMurmubaraEngineReturn {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  engineState: EngineState;
  metrics: ProcessingMetrics | null;
  diagnostics: DiagnosticInfo | null;
  
  // Recording State
  recordingState: RecordingState;
  currentStream: MediaStream | null;
  streamController: StreamController | null;
  
  // Actions
  initialize: () => Promise<void>;
  reinitialize: () => Promise<void>;
  destroy: (force?: boolean) => Promise<void>;
  processStream: (stream: MediaStream) => Promise<StreamController>;
  processStreamChunked: (
    stream: MediaStream,
    config: {
      chunkDuration: number;
      onChunkProcessed?: (chunk: ChunkMetrics) => void;
    }
  ) => Promise<StreamController>;
  processFile: (arrayBuffer: ArrayBuffer) => Promise<ArrayBuffer>;
  
  // Recording Actions
  startRecording: (chunkDuration?: number) => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearRecordings: () => void;
  
  // Audio Playback Actions
  toggleChunkPlayback: (chunkId: string, audioType: 'processed' | 'original') => Promise<void>;
  toggleChunkExpansion: (chunkId: string) => void;
  
  // Export Actions
  exportChunkAsWav: (chunkId: string, audioType: 'processed' | 'original') => Promise<Blob>;
  exportChunkAsMp3: (chunkId: string, audioType: 'processed' | 'original', bitrate?: number) => Promise<Blob>;
  downloadChunk: (chunkId: string, format: 'webm' | 'wav' | 'mp3', audioType: 'processed' | 'original') => Promise<void>;
  downloadAllChunksAsZip: (audioType?: 'processed' | 'original' | 'both') => Promise<void>;
  
  // Gain Control
  inputGain: number;
  setInputGain: (gain: number) => void;
  getInputGain: () => number;
  
  // AGC Control
  agcEnabled: boolean;
  setAgcEnabled: (enabled: boolean) => Promise<void>;
  getAgcEnabled: () => boolean;
  
  // Utility
  getDiagnostics: () => DiagnosticInfo | null;
  resetError: () => void;
  formatTime: (seconds: number) => string;
  getAverageNoiseReduction: () => number;
}