import { useCallback, useEffect, useRef, useState } from 'react';
// Use main thread implementation to avoid CORS issues with workers
import { useWhisper } from './use-whisper';
import { useMurmubaraEngine } from 'murmuraba';
import type {
  AudioChunk,
  ProcessingStatus,
  TranscriptionResult,
  SusurroChunk,
  UseSusurroOptions as BaseUseSusurroOptions,
  // NEW REFACTORED TYPES
  CompleteAudioResult,
  StreamingSusurroChunk,
  RecordingConfig,
  AudioMetadata,
} from '../lib/types';

// Import dynamic loaders from centralized location
import { loadMurmubaraProcessing } from '../lib/dynamic-loaders';

// Conversational Evolution - Advanced chunk middleware
import { ChunkMiddlewarePipeline } from '../lib/chunk-middleware';

// Phase 3: Latency optimization and measurement - Hook-based approach
import { useLatencyMonitor } from './use-latency-monitor';
import type { LatencyMetrics, LatencyReport } from '../lib/latency-monitor';

// Debug mode for development - removed unused variable

// Helper function to convert URL to Blob - Used in chunk processing
const urlToBlob = async (url: string): Promise<Blob> => {
  try {
    const response = await fetch(url);
    return await response.blob();
  } catch {
    return new Blob();
  }
};

// Use the enhanced interface from types.ts
export interface UseSusurroOptions extends BaseUseSusurroOptions {
  onWhisperProgressLog?: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
  initialModel?: 'tiny' | 'base' | 'medium';
}

export interface UseSusurroReturn {
  isRecording: boolean;
  isProcessing: boolean;
  transcriptions: TranscriptionResult[];
  audioChunks: AudioChunk[];
  processingStatus: ProcessingStatus;
  averageVad: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearTranscriptions: () => void;
  // REMOVED: processAudioFile deprecated in Murmuraba v3
  // Whisper-related properties
  whisperReady: boolean;
  whisperProgress: number;
  whisperError: Error | string | null;
  transcribeWithWhisper: (blob: Blob) => Promise<TranscriptionResult | null>;
  // Built-in export functions (Murmuraba v3)
  exportChunkAsWav: (chunkId: string) => Promise<Blob>;
  // Conversational features
  conversationalChunks: SusurroChunk[];
  clearConversationalChunks: () => void;
  // Advanced middleware control
  middlewarePipeline: ChunkMiddlewarePipeline;
  // Phase 3: Latency monitoring and optimization
  latencyReport: LatencyReport;
  latencyStatus: {
    isHealthy: boolean;
    currentLatency: number;
    trend: 'improving' | 'degrading' | 'stable';
  };

  // NEW REFACTORED METHODS - useSusurro consolidation
  // Audio engine management
  initializeAudioEngine: () => Promise<void>;
  resetAudioEngine: () => Promise<void>;
  isEngineInitialized: boolean;
  engineError: string | null;
  isInitializingEngine: boolean;

  // MAIN METHOD FOR FILES - Everything in one
  processAndTranscribeFile: (file: File) => Promise<CompleteAudioResult>;

  // STREAMING RECORDING with callback pattern
  startStreamingRecording: (
    onChunk: (chunk: StreamingSusurroChunk) => void,
    config?: RecordingConfig
  ) => Promise<void>;
  stopStreamingRecording: () => Promise<StreamingSusurroChunk[]>;

  // Auxiliary methods
  convertBlobToBuffer: (blob: Blob) => Promise<ArrayBuffer>;
  analyzeVAD: (buffer: ArrayBuffer) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  // NEW: Expose MediaStream for waveform visualization
  currentStream: MediaStream | null;
}

export function useSusurro(options: UseSusurroOptions = {}): UseSusurroReturn {
  const {
    chunkDurationMs = 8000,
    whisperConfig = {},
    conversational,
    onWhisperProgressLog,
  } = options;

  // Direct useMurmubaraEngine hook integration (Murmuraba v3 pattern)
  const {
    recordingState,
    startRecording: startMurmurabaRecording,
    stopRecording: stopMurmurabaRecording,
    pauseRecording: pauseMurmurabaRecording,
    resumeRecording: resumeMurmurabaRecording,
    isInitialized: murmubaraInitialized,
    initialize: initializeMurmuraba,
    error: murmubaraError,
    isLoading: murmubaraLoading,
  } = useMurmubaraEngine({
    autoInitialize: false, // Manual initialization for better control
  });

  const exportChunkAsWav = useCallback(async () => {
    // Placeholder - WAV export requires murmuraba engine integration
    return Promise.resolve(new Blob());
  }, []);

  const clearRecordings = useCallback(() => {
    // Clear recording state - integration with murmuraba pending
    setAudioChunks([]);
    setTranscriptions([]);
  }, []);

  // State management
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([]);
  const [averageVad, setAverageVad] = useState(0);
  const [transcriptions, setTranscriptions] = useState<TranscriptionResult[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    currentChunk: 0,
    totalChunks: 0,
    stage: 'idle',
  });

  // Conversational state management
  const [conversationalChunks, setConversationalChunks] = useState<SusurroChunk[]>([]);
  const [processedAudioUrls, setProcessedAudioUrls] = useState<Map<string, string>>(new Map());
  const [chunkTranscriptions, setChunkTranscriptions] = useState<Map<string, string>>(new Map());
  const [chunkProcessingTimes, setChunkProcessingTimes] = useState<Map<string, number>>(new Map());

  // NEW REFACTORED STATE - Audio engine and file processing
  const [isEngineInitialized, setIsEngineInitialized] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [isInitializingEngine, setIsInitializingEngine] = useState(false);
  const [currentStreamingChunks, setCurrentStreamingChunks] = useState<StreamingSusurroChunk[]>([]);
  const [isStreamingRecording, setIsStreamingRecording] = useState(false);

  // Phase 3: Latency monitoring - Modern hook-based approach
  const {
    latencyReport,
    latencyStatus,
    recordMetrics: recordLatencyMetrics,
  } = useLatencyMonitor(300); // 300ms target

  // NEW: MediaStream state for waveform visualization
  const [currentMediaStream, setCurrentMediaStream] = useState<MediaStream | null>(null);

  // Guard against multiple auto-initializations
  const hasAutoInitializedRef = useRef(false);

  // Advanced middleware pipeline for chunk processing
  const [middlewarePipeline] = useState(
    () =>
      new ChunkMiddlewarePipeline({
        processingStage: 'pre-emit',
        metadata: { sessionId: `session-${Date.now()}` },
      })
  );

  // Refs - Minimal refs for conversational features only
  const startTimeRef = useRef<number>(0);
  const chunkEmissionTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // NEW REFS for streaming recording
  const streamingCallbackRef = useRef<((chunk: StreamingSusurroChunk) => void) | null>(null);
  const streamingSessionRef = useRef<{ stop: () => Promise<void> } | null>(null);

  // Using simple Whisper implementation following HuggingFace tutorial
  const {
    isReady: whisperReady,
    progress: whisperProgress,
    error: whisperError,
    transcribe: transcribeWhisperDirect,
  } = useWhisper({
    language: whisperConfig?.language || 'es',
    model: options.initialModel ? `whisper-${options.initialModel}` : 'whisper-tiny',
  });

  // Log progress updates - track previous value to avoid duplicate logs
  const previousProgressRef = useRef<number>(0);
  useEffect(() => {
    if (
      onWhisperProgressLog &&
      whisperProgress > 0 &&
      whisperProgress !== previousProgressRef.current
    ) {
      // Only log "ready" message once when transitioning to 100%
      if (whisperProgress === 100 && previousProgressRef.current < 100) {
        onWhisperProgressLog('Whisper model ready', 'success');
      } else if (whisperProgress < 100) {
        onWhisperProgressLog(`Loading Whisper model... ${whisperProgress}%`, 'info');
      }

      previousProgressRef.current = whisperProgress;
    }
  }, [whisperProgress, onWhisperProgressLog]);

  // Log errors
  useEffect(() => {
    if (onWhisperProgressLog && whisperError) {
      onWhisperProgressLog(
        typeof whisperError === 'string'
          ? whisperError
          : (whisperError as Error)?.message || 'Unknown error',
        'error'
      );
    }
  }, [whisperError, onWhisperProgressLog]);

  // Track transcription state separately (for compatibility)
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Wrap transcribe method to set state
  const transcribeWhisper = useCallback(
    async (audioData: Float32Array | Blob) => {
      setIsTranscribing(true);
      try {
        const result = await transcribeWhisperDirect(audioData);
        return result;
      } finally {
        setIsTranscribing(false);
      }
    },
    [transcribeWhisperDirect]
  );

  // NEW REFACTORED METHODS - Core functionality

  // Audio engine initialization - Fully integrated with useMurmubaraEngine
  const initializeAudioEngine = useCallback(async () => {
    // Check if already initialized or initializing
    if (murmubaraInitialized || isEngineInitialized) {
      // eslint-disable-next-line no-console
      return;
    }

    if (isInitializingEngine || murmubaraLoading) {
      // eslint-disable-next-line no-console
      return;
    }

    try {
      setIsInitializingEngine(true);
      setEngineError(null);

      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        throw new Error('Audio engine can only be initialized in browser environment');
      }

      // Check global murmuraba state and destroy if needed
      try {
        const { getEngineStatus, destroyEngine } = await import('murmuraba');
        const status = getEngineStatus?.();
        if (status && status !== 'uninitialized') {
          // eslint-disable-next-line no-console
          if (destroyEngine) {
            await destroyEngine();
          }
        }
      } catch (err) {
        // Ignore - murmuraba might not be loaded yet
      }

      // Use the murmuraba hook's initialize method
      await initializeMurmuraba();

      // Audio engine initialized successfully
      setIsEngineInitialized(true);
      setEngineError(null);
      // eslint-disable-next-line no-console
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Engine initialization failed';
      // eslint-disable-next-line no-console
      setEngineError(errorMsg);
      setIsEngineInitialized(false);
      throw error;
    } finally {
      setIsInitializingEngine(false);
    }
  }, [
    initializeMurmuraba,
    murmubaraInitialized,
    isEngineInitialized,
    isInitializingEngine,
    murmubaraLoading,
  ]);

  // Simplified VAD analysis using only murmuraba
  const analyzeVAD = useCallback(async (buffer: ArrayBuffer) => {
    try {
      const { murmubaraVAD } = await loadMurmubaraProcessing();
      const result = await murmubaraVAD(buffer);
      return {
        averageVad: result.average || 0,
        vadScores: result.scores || [],
        metrics: result.metrics || [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        voiceSegments: (result.voiceSegments || []).map((segment: any) => ({
          startTime: segment.startTime || 0,
          endTime: segment.endTime || 0,
          vadScore: segment.vadScore || 0,
          confidence: segment.confidence || 0,
        })),
      };
    } catch (error) {
      // Return empty result instead of throwing
      return {
        averageVad: 0,
        vadScores: [],
        metrics: [],
        voiceSegments: [],
      };
    }
  }, []);

  // Convert blob to ArrayBuffer
  const convertBlobToBuffer = useCallback(async (blob: Blob): Promise<ArrayBuffer> => {
    return await blob.arrayBuffer();
  }, []);

  // processAndTranscribeFile method will be defined after transcribeWithWhisper

  // Helper function to calculate audio duration using real metadata extraction
  const calculateDuration = useCallback(async (buffer: ArrayBuffer): Promise<number> => {
    try {
      const { extractAudioMetadata } = await loadMurmubaraProcessing();
      const metadata = await extractAudioMetadata(buffer);
      return metadata.duration;
    } catch (error) {
      // Fallback to estimation if metadata extraction fails
      const bytes = buffer.byteLength;
      const estimatedDuration = bytes / (44100 * 2 * 2); // 44.1kHz, 2 channels, 16-bit
      return Math.max(0.1, estimatedDuration);
    }
  }, []);

  // STREAMING RECORDING with callback pattern - Modern React 19 approach
  const startStreamingRecording = useCallback(
    async (
      onChunk: (chunk: StreamingSusurroChunk) => void,
      config?: RecordingConfig
    ): Promise<void> => {
      if (isStreamingRecording) {
        throw new Error('Already recording. Stop current recording first.');
      }

      // Don't initialize here - let useMurmubaraEngine handle it
      // The murmuraba hook will initialize when startRecording is called

      setIsStreamingRecording(true);
      setCurrentStreamingChunks([]);
      streamingCallbackRef.current = onChunk;

      // Configuration with defaults
      const recordingConfig = {
        chunkDuration: 3, // 3 seconds per chunk
        vadThreshold: 0.5,
        enableRealTimeTranscription: true,
        enableNoiseReduction: true,
        ...config,
      };

      try {
        // Get user media stream
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: recordingConfig.enableNoiseReduction,
            noiseSuppression: recordingConfig.enableNoiseReduction,
            autoGainControl: true,
            sampleRate: 44100,
          },
        });

        setCurrentMediaStream(stream);

        // Start recording with Murmuraba
        await startMurmurabaRecording();
        
        // Process Murmuraba chunks at regular intervals
        let lastProcessedIndex = 0;
        const chunkInterval = setInterval(async () => {
          if (!streamingCallbackRef.current) {
            return;
          }
          
          // Get new chunks from Murmuraba's recording state
          const murmubaraChunks = recordingState.chunks || [];
          const newChunks = murmubaraChunks.slice(lastProcessedIndex);
          
          // Process each new chunk
          for (const murmurabaChunk of newChunks) {
            if (!murmurabaChunk.processedAudioUrl) continue;
            
            // Convert URL to blob
            const audioBlob = await urlToBlob(murmurabaChunk.processedAudioUrl);
            
            // Analyze VAD (already provided by Murmuraba)
            const vadScore = murmurabaChunk.averageVad || 0;
            const isVoiceActive = vadScore > recordingConfig.vadThreshold;
            
            // Transcribe if Whisper is ready and voice is active
            let transcriptionText = '';
            if (whisperReady && isVoiceActive) {
              try {
                const transcriptionResult = await transcribeWhisper(audioBlob);
                transcriptionText = transcriptionResult?.text || '';
              } catch (error) {
                // Transcription failed, continue without it
              }
            }
            
            // Create a streaming chunk with real data from Murmuraba
            const chunk: StreamingSusurroChunk = {
              id: murmurabaChunk.id || `streaming-chunk-${Date.now()}`,
              audioBlob: audioBlob,
              vadScore: vadScore,
              timestamp: Date.now(),
              transcriptionText: transcriptionText,
              duration: murmurabaChunk.duration || recordingConfig.chunkDuration * 1000,
              isVoiceActive: isVoiceActive,
            };
            
            // Store chunk
            setCurrentStreamingChunks((prev) => [...prev, chunk]);
            
            // Call the callback
            streamingCallbackRef.current(chunk);
          }
          
          lastProcessedIndex = murmubaraChunks.length;
        }, 1000); // Check for new chunks every second

        // Store session with proper cleanup
        const streamingSession = {
          stop: async () => {
            clearInterval(chunkInterval);

            // Stop media stream
            if (stream) {
              stream.getTracks().forEach((track) => track.stop());
            }
            setCurrentMediaStream(null);

            // Stop Murmuraba recording
            stopMurmurabaRecording();

            setIsStreamingRecording(false);
            streamingCallbackRef.current = null;
          },
        };

        // Store session reference
        streamingSessionRef.current = streamingSession;
      } catch (error) {
        setIsStreamingRecording(false);
        streamingCallbackRef.current = null;
        const errorMsg =
          error instanceof Error ? error.message : 'Failed to start streaming recording';
        throw new Error(`Streaming recording failed: ${errorMsg}`);
      }
    },
    [isStreamingRecording, startMurmurabaRecording, stopMurmurabaRecording, whisperReady, transcribeWhisper, recordingState.chunks]
  );

  const stopStreamingRecording = useCallback(async (): Promise<StreamingSusurroChunk[]> => {
    if (streamingSessionRef.current) {
      await streamingSessionRef.current.stop();
      streamingSessionRef.current = null;
    }

    setIsStreamingRecording(false);
    streamingCallbackRef.current = null;

    // Return all chunks processed during this session
    return currentStreamingChunks;
  }, [currentStreamingChunks]);

  // Helper functions - moved before usage

  const tryEmitChunk = useCallback(
    async (chunk: AudioChunk, forceEmit = false) => {
      if (!conversational?.onChunk) return;

      const audioUrl = processedAudioUrls.get(chunk.id);
      const transcript = chunkTranscriptions.get(chunk.id);
      const processingStartTime = chunkProcessingTimes.get(chunk.id);

      // Only emit when both audio and transcript are ready
      if (audioUrl && transcript) {
        const processingLatency = processingStartTime
          ? Date.now() - processingStartTime
          : undefined;

        let susurroChunk: SusurroChunk = {
          id: chunk.id,
          audioUrl,
          transcript,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          vadScore: chunk.vadScore || 0,
          isComplete: true,
          processingLatency,
        };

        // Process chunk through middleware pipeline for enhancement
        const middlewareStartTime = performance.now();
        try {
          susurroChunk = await middlewarePipeline.process(susurroChunk);
        } catch (error) {
          // Log middleware processing failure
          // Middleware processing failed
        }
        const middlewareLatency = performance.now() - middlewareStartTime;

        // Phase 3: Record comprehensive latency metrics
        if (processingLatency) {
          const latencyMetrics: Omit<LatencyMetrics, 'timestamp'> = {
            chunkId: chunk.id,
            audioToEmitLatency: processingLatency,
            audioProcessingLatency: Math.max(0, processingLatency - middlewareLatency - 50), // Estimate
            transcriptionLatency: 50, // Placeholder - should be measured from transcription hook
            middlewareLatency,
            vadScore: chunk.vadScore,
            audioSize: chunk.blob?.size,
          };

          recordLatencyMetrics(latencyMetrics);

          // Real-time status is automatically updated by the hook
        }

        // Add to conversational chunks state
        setConversationalChunks((prev) => [...prev, susurroChunk]);

        // Emit via callback
        conversational.onChunk(susurroChunk);

        // Clear timeout if it exists
        const timeout = chunkEmissionTimeoutRef.current.get(chunk.id);
        if (timeout) {
          clearTimeout(timeout);
          chunkEmissionTimeoutRef.current.delete(chunk.id);
        }

        // Clean up tracking data
        chunkProcessingTimes.delete(chunk.id);
      } else if (forceEmit && conversational.chunkTimeout) {
        // Handle timeout case - emit incomplete chunk if timeout is reached
        const susurroChunk: SusurroChunk = {
          id: chunk.id,
          audioUrl: audioUrl || '',
          transcript: transcript || '',
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          vadScore: chunk.vadScore || 0,
          isComplete: false,
          processingLatency: processingStartTime ? Date.now() - processingStartTime : undefined,
        };

        setConversationalChunks((prev) => [...prev, susurroChunk]);
        conversational.onChunk(susurroChunk);
      }
    },
    [
      conversational,
      processedAudioUrls,
      chunkTranscriptions,
      chunkProcessingTimes,
      middlewarePipeline,
      recordLatencyMetrics,
    ]
  );

  const clearConversationalChunks = useCallback(() => {
    // Clear URL objects to prevent memory leaks
    setConversationalChunks((prevChunks) => {
      prevChunks.forEach((chunk) => {
        if (chunk.audioUrl.startsWith('blob:')) {
          URL.revokeObjectURL(chunk.audioUrl);
        }
      });
      return [];
    });

    setProcessedAudioUrls(new Map());
    setChunkTranscriptions(new Map());
    setChunkProcessingTimes(new Map());

    // Clear any pending timeouts
    chunkEmissionTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
    chunkEmissionTimeoutRef.current.clear();
  }, []);

  // Reset - just cleanup state since useMurmubaraEngine manages the engine
  const resetAudioEngine = useCallback(async () => {
    // Stop any ongoing recordings
    if (recordingState.isRecording) {
      stopMurmurabaRecording();
    }

    // Stop streaming if active
    if (streamingSessionRef.current) {
      await streamingSessionRef.current.stop();
      streamingSessionRef.current = null;
    }

    // Clean up media stream
    if (currentMediaStream) {
      currentMediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      setCurrentMediaStream(null);
    }

    // Clear all state
    setIsStreamingRecording(false);
    setCurrentStreamingChunks([]);
    streamingCallbackRef.current = null;

    // Clear audio chunks and transcriptions
    setAudioChunks([]);
    setTranscriptions([]);
    clearConversationalChunks();

    // Optionally reinitialize after a short delay
    setTimeout(async () => {
      try {
        await initializeAudioEngine();
      } catch (error) {
        // Failed to reinitialize after reset
      }
    }, 100);
  }, [
    recordingState.isRecording,
    stopMurmurabaRecording,
    currentMediaStream,
    clearConversationalChunks,
    initializeAudioEngine,
  ]);

  // Removed blobToFloat32Array - not needed with new simple hook

  // Simplified transcription handler
  const transcribeWithWhisper = useCallback(
    async (blob: Blob): Promise<TranscriptionResult | null> => {
      try {
        const result = await transcribeWhisper(blob);
        if (result) {
          // Create TranscriptionResult format expected by the app
          const transcriptionResult: TranscriptionResult = {
            text: result.text,
            chunkIndex: 0,
            timestamp: Date.now(),
            segments: result.chunks?.map((chunk, index) => ({
              id: index,
              seek: chunk.timestamp[0],
              start: chunk.timestamp[0],
              end: chunk.timestamp[1],
              text: chunk.text,
              tokens: [],
              temperature: 0,
              avg_logprob: 0,
              compression_ratio: 0,
              no_speech_prob: 0,
            })),
          };

          // Add to main transcriptions
          setTranscriptions((prev) => [...prev, transcriptionResult]);

          // Handle conversational mode transcription
          if (conversational?.onChunk && transcriptionResult.chunkIndex !== undefined) {
            const chunk = audioChunks[transcriptionResult.chunkIndex];
            if (chunk) {
              // Store transcription for this chunk
              setChunkTranscriptions((prev) =>
                new Map(prev).set(chunk.id, transcriptionResult.text)
              );

              // Try to emit chunk if audio is also ready
              tryEmitChunk(chunk);
            }
          }

          return transcriptionResult;
        }
        return null;
      } catch (error) {
        // Transcription failed
        return null;
      }
    },
    [transcribeWhisper, conversational, audioChunks, tryEmitChunk]
  );

  // MAIN METHOD FOR FILES - Everything in one (defined after transcribeWithWhisper)
  const processAndTranscribeFile = useCallback(
    async (file: File): Promise<CompleteAudioResult> => {
      const startTime = performance.now();

      try {
        // Ensure engines are ready
        if (!whisperReady) {
          throw new Error('Whisper model not ready. Please wait for model to load.');
        }
        if (!isEngineInitialized) {
          await initializeAudioEngine();
        }

        // 1. Convert file to ArrayBuffer
        const originalBuffer = await file.arrayBuffer();

        // 2. Create URL for original audio
        const originalAudioUrl = URL.createObjectURL(file);

        // 3. Process with Murmuraba (noise reduction + VAD)
        const {
          processFileWithMetrics,
          getEngineStatus,
          initializeAudioEngine: murmubaraInit,
        } = await loadMurmubaraProcessing();

        // Type cast to ensure TypeScript knows the correct return type
        type ProcessFileWithMetricsResult = {
          processedBuffer: ArrayBuffer;
          metrics: unknown[];
          averageVad: number;
        };

        // Check if engine is initialized, if not initialize it
        try {
          const engineStatus = getEngineStatus ? getEngineStatus() : 'uninitialized';
          if (engineStatus === 'uninitialized') {
            // Engine not initialized, initializing now
            if (murmubaraInit) {
              await murmubaraInit({
                noiseReductionLevel: 'medium',
                bufferSize: 1024,
                algorithm: 'rnnoise',
                logLevel: 'info',
                autoCleanup: true,
                useAudioWorklet: true,
              });
            }
          }
        } catch (initError) {
          // Engine status check failed, proceeding anyway
        }

        const processedResult = (await processFileWithMetrics(originalBuffer, () => {
          // Callback for real-time metrics if needed
        })) as ProcessFileWithMetricsResult;

        // 4. Create URL for processed audio
        const processedBlob = new Blob([processedResult.processedBuffer], { type: 'audio/wav' });
        const processedAudioUrl = URL.createObjectURL(processedBlob);

        // 5. Analyze VAD first
        const vadAnalysis = await analyzeVAD(originalBuffer);

        // 6. Transcribe with Whisper
        const transcriptionResult = await transcribeWithWhisper(processedBlob);
        if (!transcriptionResult) {
          throw new Error('Transcription failed - no result returned');
        }

        // 7. Extract metadata
        const metadata: AudioMetadata = {
          duration: await calculateDuration(originalBuffer),
          sampleRate: 44100, // Standard sample rate - should match actual buffer
          channels: 2, // Stereo channels - should match actual buffer
          fileSize: file.size,
          processedSize: processedResult.processedBuffer.byteLength,
        };

        // 8. Compile complete result
        const result: CompleteAudioResult = {
          originalAudioUrl,
          processedAudioUrl,
          transcriptionText: transcriptionResult.text,
          transcriptionSegments: transcriptionResult.segments,
          vadAnalysis,
          metadata,
          processingTime: performance.now() - startTime,
        };

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Audio processing failed';
        throw new Error(`File processing failed: ${errorMessage}`);
      }
    },
    [
      whisperReady,
      isEngineInitialized,
      initializeAudioEngine,
      transcribeWithWhisper,
      analyzeVAD,
      calculateDuration,
    ]
  );

  // Real-time chunk processing with hook pattern (Murmuraba v3 integration)
  useEffect(() => {
    const processNewChunks = async () => {
      const newChunks: AudioChunk[] = [];

      // Get chunks from murmuraba engine if available
      const chunks = recordingState.chunks || [];

      for (let index = audioChunks.length; index < chunks.length; index++) {
        const chunk = chunks[index];

        // Convert Murmuraba chunk to internal format with real VAD metrics
        const audioChunk: AudioChunk = {
          id: chunk.id || `chunk-${Date.now()}-${index}`,
          blob: await urlToBlob(chunk.processedAudioUrl || ''), // Real Murmuraba v3 integration
          startTime: chunk.startTime || index * chunkDurationMs,
          endTime: chunk.endTime || (index + 1) * chunkDurationMs,
          vadScore: chunk.averageVad || 0, // Real VAD from neural processing
          duration: chunk.duration || chunkDurationMs,
        };

        newChunks.push(audioChunk);

        // Store processed audio URL for conversational mode
        if (conversational?.onChunk && chunk.processedAudioUrl) {
          if (chunk.processedAudioUrl) {
            setProcessedAudioUrls((prev) =>
              new Map(prev).set(audioChunk.id, chunk.processedAudioUrl as string)
            );
          }

          // Set timeout for chunk emission if configured
          if (conversational.chunkTimeout) {
            const timeout = setTimeout(() => {
              tryEmitChunk(audioChunk, true); // Force emit on timeout
            }, conversational.chunkTimeout);
            chunkEmissionTimeoutRef.current.set(audioChunk.id, timeout);
          }
        }
      }

      if (newChunks.length > 0) {
        setAudioChunks((prev) => [...prev, ...newChunks]);
      }
    };

    processNewChunks();

    // Update VAD from latest chunk with enhanced metrics
    const chunks = recordingState.chunks || [];
    const latestChunk = chunks[chunks.length - 1];
    if (latestChunk) {
      setAverageVad(latestChunk.averageVad || 0);
    }
  }, [recordingState.chunks, audioChunks.length, chunkDurationMs, conversational, tryEmitChunk]);

  // REMOVED: processAudioFile deprecated in Murmuraba v3 - use startRecording() instead

  // Process chunks for transcription
  const processChunks = useCallback(
    async (chunks: AudioChunk[]) => {
      setProcessingStatus({
        isProcessing: true,
        currentChunk: 0,
        totalChunks: chunks.length,
        stage: 'processing',
      });

      // Process each chunk with Whisper
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        setProcessingStatus((prev) => ({
          ...prev,
          currentChunk: i + 1,
        }));

        try {
          const result = await transcribeWithWhisper(chunk.blob);
          if (result) {
            // Enhanced result with chunk information
            const enhancedResult: TranscriptionResult = {
              ...result,
              chunkIndex: i,
              timestamp: Date.now(),
            };
            setTranscriptions((prev) => [...prev, enhancedResult]);
          }
        } catch (error) {
          // Transcription failed for chunk
        }
      }

      setProcessingStatus({
        isProcessing: false,
        currentChunk: 0,
        totalChunks: 0,
        stage: 'complete',
      });
    },
    [transcribeWithWhisper]
  );

  // Recording functions - Direct hook integration
  const startRecording = useCallback(async () => {
    startTimeRef.current = Date.now();
    setAudioChunks([]);
    setTranscriptions([]);

    // NEW: Get MediaStream for visualization
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      setCurrentMediaStream(stream);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        // Failed to get MediaStream for visualization
      }
    }

    // Hook handles all audio setup and initialization
    await startMurmurabaRecording();
  }, [startMurmurabaRecording]);

  const stopRecording = useCallback(() => {
    // Clean up MediaStream
    if (currentMediaStream) {
      currentMediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      setCurrentMediaStream(null);
    }

    // Hook handles all cleanup automatically
    stopMurmurabaRecording();
  }, [stopMurmurabaRecording, currentMediaStream]);

  const pauseRecording = useCallback(() => {
    // Built-in pause functionality
    pauseMurmurabaRecording();
  }, [pauseMurmurabaRecording]);

  const resumeRecording = useCallback(() => {
    // Built-in resume functionality
    resumeMurmurabaRecording();
  }, [resumeMurmurabaRecording]);

  const clearTranscriptions = useCallback(() => {
    setTranscriptions([]);
    clearRecordings(); // Also clear Murmuraba recordings

    // Also clear conversational transcriptions if in conversational mode
    if (conversational?.onChunk) {
      setChunkTranscriptions(new Map());
    }
  }, [conversational, clearRecordings]);

  // Optimize memory by cleaning up old URL objects
  const cleanupOldChunks = useCallback(
    (maxChunks = 50) => {
      if (conversationalChunks.length > maxChunks) {
        const chunksToRemove = conversationalChunks.slice(
          0,
          conversationalChunks.length - maxChunks
        );

        // Revoke old URL objects
        chunksToRemove.forEach((chunk) => {
          if (chunk.audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(chunk.audioUrl);
          }
        });

        // Keep only recent chunks
        setConversationalChunks((prev) => prev.slice(-maxChunks));
      }
    },
    [conversationalChunks]
  );

  // Debounced cleanup to prevent memory bloat
  useEffect(() => {
    if (conversational?.onChunk && conversationalChunks.length > 0) {
      const cleanup = setTimeout(() => {
        cleanupOldChunks();
      }, 5000); // Clean up every 5 seconds

      return () => clearTimeout(cleanup);
    }
  }, [conversational, conversationalChunks.length, cleanupOldChunks]);

  // Phase 3: Latency reports are now handled automatically by the useLatencyMonitor hook

  // Sync engine state with murmuraba hook state
  useEffect(() => {
    if (murmubaraInitialized && !isEngineInitialized && !isInitializingEngine) {
      setIsEngineInitialized(true);
      setEngineError(null);
      // eslint-disable-next-line no-console
    } else if (murmubaraError && !engineError) {
      setEngineError(murmubaraError);
      setIsEngineInitialized(false);
      // eslint-disable-next-line no-console
    }
  }, [
    murmubaraInitialized,
    murmubaraError,
    isEngineInitialized,
    isInitializingEngine,
    engineError,
  ]);

  // NEW: Auto-initialize audio engine when Whisper is ready (with better guard)
  useEffect(() => {
    // Prevent auto-init if already initialized via murmuraba hook
    if (murmubaraInitialized) {
      setIsEngineInitialized(true);
      return;
    }

    if (
      whisperReady &&
      !isEngineInitialized &&
      !isInitializingEngine &&
      !engineError &&
      !murmubaraLoading &&
      !hasAutoInitializedRef.current
    ) {
      hasAutoInitializedRef.current = true;
      // eslint-disable-next-line no-console
      initializeAudioEngine().catch(() => {
        // eslint-disable-next-line no-console
        hasAutoInitializedRef.current = false; // Reset on failure to allow retry
      });
    }
  }, [
    whisperReady,
    isEngineInitialized,
    isInitializingEngine,
    engineError,
    murmubaraLoading,
    murmubaraInitialized,
    initializeAudioEngine,
  ]);

  // Auto-process chunks when ready
  useEffect(() => {
    const isRecording = recordingState.isRecording;
    if (audioChunks.length > 0 && !isRecording && whisperReady) {
      // Add delay to ensure Murmuraba processing is complete
      setTimeout(() => {
        // Only auto-process if not in conversational mode or instant transcription is enabled
        if (!conversational?.onChunk || conversational?.enableInstantTranscription) {
          processChunks(audioChunks);
        }
      }, 100);
    }
  }, [audioChunks, recordingState.isRecording, whisperReady, processChunks, conversational]);

  // Conversational mode: Process chunks individually for real-time emission
  useEffect(() => {
    if (
      conversational?.onChunk &&
      conversational?.enableInstantTranscription &&
      audioChunks.length > 0
    ) {
      // Find chunks that haven't been transcribed yet
      const untranscribedChunks = audioChunks.filter(
        (chunk) => !chunkTranscriptions.has(chunk.id) && processedAudioUrls.has(chunk.id)
      );

      // Process each untranscribed chunk immediately
      untranscribedChunks.forEach(async (chunk) => {
        try {
          const result = await transcribeWithWhisper(chunk.blob);
          if (result) {
            // Store transcription
            setChunkTranscriptions((prev) => new Map(prev).set(chunk.id, result.text));

            // Try to emit chunk now that transcript is ready
            tryEmitChunk(chunk);
          }
        } catch (error) {
          // Transcription failed for chunk

          // Still try to emit with empty transcript if audio is ready
          if (processedAudioUrls.has(chunk.id)) {
            tryEmitChunk(chunk, true);
          }
        }
      });
    }
  }, [
    audioChunks,
    conversational,
    chunkTranscriptions,
    processedAudioUrls,
    transcribeWhisper,
    tryEmitChunk,
    transcribeWithWhisper,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Reset auto-initialization flag on unmount
      hasAutoInitializedRef.current = false;

      // Clean up conversational resources
      clearConversationalChunks();

      // Clean up streaming recording if active
      if (streamingSessionRef.current) {
        streamingSessionRef.current.stop().catch(() => {
          // Error stopping streaming session on unmount
        });
      }

      // Destroy murmuraba engine on unmount to prevent double initialization
      if (isEngineInitialized || murmubaraInitialized) {
        (async () => {
          try {
            const { destroyEngine } = await import('murmuraba');
            if (destroyEngine) {
              await destroyEngine();
              // eslint-disable-next-line no-console
            }
          } catch (err) {
            // Ignore cleanup errors
          }
        })();
      }
    };
  }, [clearConversationalChunks, isEngineInitialized, murmubaraInitialized]);

  return {
    // Recording state - now from Murmuraba hook
    isRecording: recordingState.isRecording,
    isProcessing: processingStatus.isProcessing || isTranscribing,
    transcriptions,
    audioChunks,
    processingStatus,
    averageVad,
    // Simplified recording functions
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearTranscriptions,
    // REMOVED: processAudioFile deprecated in v3
    // Built-in export functions from hook - wrapped for compatibility
    exportChunkAsWav: () => exportChunkAsWav(),
    // Whisper-related properties
    whisperReady,
    whisperProgress,
    whisperError,
    transcribeWithWhisper,
    // Conversational features
    conversationalChunks,
    clearConversationalChunks,
    // Advanced middleware control
    middlewarePipeline,
    // Phase 3: Latency monitoring and optimization
    latencyReport,
    latencyStatus,

    // NEW REFACTORED METHODS - useSusurro consolidation
    // Audio engine management
    initializeAudioEngine,
    resetAudioEngine,
    isEngineInitialized,
    engineError,
    isInitializingEngine,

    // MAIN METHOD FOR FILES - Everything in one
    processAndTranscribeFile,

    // STREAMING RECORDING with callback pattern
    startStreamingRecording,
    stopStreamingRecording,

    // Auxiliary methods
    analyzeVAD,
    convertBlobToBuffer,

    // NEW: Expose MediaStream for waveform visualization
    currentStream: currentMediaStream,
  };
}
