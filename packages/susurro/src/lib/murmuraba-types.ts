export interface MurmurabaConfig {
  enableAGC?: boolean;
  enableNoiseSuppression?: boolean;
  enableEchoCancellation?: boolean;
  enableVAD?: boolean;
}

export interface MurmurabaMetrics {
  vad?: number;
  energy?: number;
  pitch?: number;
  snr?: number;
  timestamp?: number;
}

export interface MurmurabaChunk {
  audioBuffer: AudioBuffer;
  blob?: Blob;
  startTime: number;
  endTime: number;
  vadScore?: number;
}

export interface MurmurabaResult {
  processedBuffer?: ArrayBuffer | Blob | AudioBuffer;
  processedAudio?: ArrayBuffer | Blob | AudioBuffer;
  vadScores?: number[];
  metrics?: MurmurabaMetrics[];
  averageVad?: number;
  chunks?: MurmurabaChunk[];
}

export interface MurmurabaInstance {
  isInitialized: boolean;
  initializeAudioEngine(config?: MurmurabaConfig): Promise<void>;
  destroyEngine?(): Promise<void>;
  processFile(buffer: ArrayBuffer, options?: Record<string, unknown>): Promise<MurmurabaResult | ArrayBuffer>;
  processFileWithMetrics?(
    buffer: ArrayBuffer,
    onFrameProcessed?: (metrics: MurmurabaMetrics) => void
  ): Promise<MurmurabaResult>;
  processStreamChunked?(
    stream: ReadableStream<Uint8Array>,
    options: {
      chunkDuration?: number;
      onChunkProcessed?: (chunk: MurmurabaChunk) => void;
    }
  ): Promise<MurmurabaChunk[]>;
  analyzeVAD?(buffer: ArrayBuffer): Promise<{
    metrics?: MurmurabaMetrics[];
    averageVad?: number;
    average?: number;
    scores?: number[];
  }>;
}
