import { ProcessedChunk } from './types';

/**
 * Interface for URL management operations
 */
export interface IURLManager {
  createObjectUrl(blob: Blob): string;
  revokeUrl(url: string): void;
  revokeAllUrls(): void;
  getActiveUrlCount(): number;
}

/**
 * Interface for chunk management operations
 */
export interface IChunkManager {
  findChunk(chunks: ProcessedChunk[], chunkId: string): ProcessedChunk | undefined;
  toggleChunkPlayback(chunks: ProcessedChunk[], chunkId: string, isPlaying: boolean): ProcessedChunk[];
  toggleChunkExpansion(chunks: ProcessedChunk[], chunkId: string): ProcessedChunk[];
  getAverageNoiseReduction(chunks: ProcessedChunk[]): number;
  clearChunks(chunks: ProcessedChunk[]): void;
  revokeChunkUrls(chunks: ProcessedChunk[]): void;
}

/**
 * Interface for recording management operations
 */
export interface IRecordingManager {
  startCycle(
    processedStream: MediaStream,
    originalStream: MediaStream,
    chunkDuration: number,
    onChunkProcessed: (chunk: ProcessedChunk) => void
  ): Promise<void>;
  stopRecording(): void;
  pauseRecording(): void;
  resumeRecording(): void;
  isRecording(): boolean;
  isPaused(): boolean;
}

/**
 * Interface for audio export operations
 */
export interface IAudioExporter {
  setAudioConverter(converter: any): void;
  exportChunkAsWav(chunk: ProcessedChunk, audioType: 'processed' | 'original'): Promise<Blob>;
  exportChunkAsMp3(chunk: ProcessedChunk, audioType: 'processed' | 'original', bitrate?: number): Promise<Blob>;
  downloadChunk(chunk: ProcessedChunk, format: 'webm' | 'wav' | 'mp3', audioType: 'processed' | 'original'): Promise<void>;
}

/**
 * Interface for playback management operations
 */
export interface IPlaybackManager {
  toggleChunkPlayback(
    chunk: ProcessedChunk,
    audioType: 'processed' | 'original',
    onStateChange: (chunkId: string, isPlaying: boolean) => void
  ): Promise<void>;
  cleanup(): void;
  stopAll(): void;
}