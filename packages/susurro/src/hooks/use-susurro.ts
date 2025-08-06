import { useCallback, useEffect, useRef, useState } from 'react';
import { useWhisperPipeline } from './use-whisper-pipeline'; // Clean pipeline implementation
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
  AudioEngineConfig,
  VADAnalysisResult,
  AudioMetadata,
  VoiceSegment,
} from '../lib/types';

// Import dynamic loaders from centralized location
import { loadMurmubaraEngine, loadMurmubaraProcessing } from '../lib/dynamic-loaders';

// Conversational Evolution - Advanced chunk middleware
import { ChunkMiddlewarePipeline } from '../lib/chunk-middleware';
import { getModernVAD, destroyModernVAD } from '../lib/modern-vad';

// Phase 3: Latency optimization and measurement - Hook-based approach
import { useLatencyMonitor } from './use-latency-monitor';
import type { LatencyMetrics, LatencyReport } from '../lib/latency-monitor';

// Debug mode for development
const DEBUG_MODE = false;

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
  whisperError: Error | null;
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
  initializeAudioEngine: (config?: AudioEngineConfig) => Promise<void>;
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
  analyzeVAD: (buffer: ArrayBuffer) => Promise<VADAnalysisResult>;
  convertBlobToBuffer: (blob: Blob) => Promise<ArrayBuffer>;

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
  } = useMurmubaraEngine({});

  const exportChunkAsWav = useCallback(async (chunkId: string, type = 'processed') => {
    // TODO: Implement with murmuraba engine
    return Promise.resolve(new Blob());
  }, []);

  const clearRecordings = useCallback(() => {
    // TODO: Implement with murmuraba engine
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
  const [isInitializingEngine] = useState(false);
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

  // NEW: Using clean pipeline implementation based on HuggingFace example
  // This provides better performance and cleaner code
  const {
    ready: whisperReady,
    loading: whisperIsLoading,
    progressItems,
    transcribe: transcribeWhisperPipeline,
  } = useWhisperPipeline({
    language: whisperConfig?.language || 'es',
    autoLoad: true,
    onLog: (message, type) => {
      // Send all logs to WhisperEchoLog
      if (onWhisperProgressLog) {
        onWhisperProgressLog(message, type);
      }
    }
  });

  // Calculate overall progress from progress items
  const whisperProgress = progressItems.length > 0
    ? Math.round(progressItems.reduce((acc, item) => acc + item.progress, 0) / progressItems.length)
    : (whisperReady ? 100 : 0);

  // No error state in pipeline (handled internally)
  const whisperError = null;
  
  // Track transcription state separately (for compatibility)
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Wrap transcribe method to set state
  const transcribeWhisper = useCallback(async (audioData: Float32Array) => {
    setIsTranscribing(true);
    try {
      const result = await transcribeWhisperPipeline(audioData);
      return result;
    } finally {
      setIsTranscribing(false);
    }
  }, [transcribeWhisperPipeline]);

  // NEW REFACTORED METHODS - Core functionality

  // Audio engine initialization - Fully integrated with useMurmubaraEngine
  const initializeAudioEngine = useCallback(async () => {
    try {
      // The useMurmubaraEngine hook handles initialization internally
      // We just mark it as initialized for our state tracking
      setIsEngineInitialized(true);
      setEngineError(null);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Engine initialization failed';
      setEngineError(errorMsg);
      setIsEngineInitialized(false);
      throw error;
    }
  }, []);

  // VAD analysis helper with Modern Neural VAD
  const analyzeVAD = useCallback(async (buffer: ArrayBuffer): Promise<VADAnalysisResult> => {
    try {
      // Primary: Use Modern Neural VAD (Silero) for superior accuracy
      const modernVAD = getModernVAD({
        positiveSpeechThreshold: 0.6, // Higher threshold for better precision
        negativeSpeechThreshold: 0.4,
        frameSamples: 1536, // Optimized for 32ms frames
      });

      const modernResult = await modernVAD.analyze(buffer);

      if (modernResult.averageVad > 0) {
        // Modern VAD successful
        // Debug logging removed - use DEBUG_MODE flag if needed
        return modernResult;
      }

      // Fallback: Use Murmuraba VAD if Modern VAD fails
      // Debug logging removed - use DEBUG_MODE flag if needed

      const { murmubaraVAD } = await loadMurmubaraProcessing();
      const result = await murmubaraVAD(buffer);

      // Process results to find voice segments
      const voiceSegments: VoiceSegment[] = [];
      const vadScores = result.scores || [];
      const metrics = result.metrics || [];

      // Use voiceSegments from murmubaraVAD if available
      if (result.voiceSegments && result.voiceSegments.length > 0) {
        result.voiceSegments.forEach((segment) => {
          voiceSegments.push({
            startTime: segment.startTime,
            endTime: segment.endTime,
            vadScore: segment.confidence,
            confidence: segment.confidence,
          });
        });
      } else {
        // Fallback: Find continuous voice segments
        let segmentStart = -1;
        const threshold = 0.5;

        for (let i = 0; i < vadScores.length; i++) {
          const isVoice = vadScores[i] > threshold;

          if (isVoice && segmentStart === -1) {
            segmentStart = i;
          } else if (!isVoice && segmentStart !== -1) {
            voiceSegments.push({
              startTime: segmentStart * 0.02, // 20ms per frame
              endTime: i * 0.02,
              vadScore:
                vadScores.slice(segmentStart, i).reduce((a: number, b: number) => a + b, 0) /
                (i - segmentStart),
              confidence:
                vadScores.slice(segmentStart, i).reduce((a: number, b: number) => a + b, 0) /
                (i - segmentStart),
            });
            segmentStart = -1;
          }
        }
      }

      return {
        averageVad: result.average || 0,
        vadScores,
        metrics,
        voiceSegments,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'VAD analysis failed';
      throw new Error(`VAD analysis failed: ${errorMsg}`);
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

        // Set up chunk processing interval
        let chunkIndex = 0;
        const chunkInterval = setInterval(async () => {
          if (!streamingCallbackRef.current) {
            clearInterval(chunkInterval);
            return;
          }

          // Create a streaming chunk
          const chunk: StreamingSusurroChunk = {
            id: `streaming-chunk-${Date.now()}-${chunkIndex}`,
            audioBlob: new Blob(), // This would come from actual audio processing
            vadScore: Math.random(), // Placeholder VAD score
            timestamp: Date.now(),
            transcriptionText: '', // Will be filled by Whisper
            duration: recordingConfig.chunkDuration * 1000, // Convert to ms
            isVoiceActive: Math.random() > 0.5, // Placeholder voice detection
          };

          // Store chunk
          setCurrentStreamingChunks((prev) => [...prev, chunk]);

          // Call the callback
          streamingCallbackRef.current(chunk);
          chunkIndex++;
        }, recordingConfig.chunkDuration * 1000);

        // Store session with proper cleanup
        const streamingSession = {
          stop: async () => {
            clearInterval(chunkInterval);

            // Stop media stream - use the stream we just created
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
    [isStreamingRecording, startMurmurabaRecording, stopMurmurabaRecording]
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

  // Convert Blob to Float32Array for Whisper pipeline
  const blobToFloat32Array = useCallback(async (blob: Blob): Promise<Float32Array> => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Get first channel and convert to Float32Array
    const audioData = audioBuffer.getChannelData(0);
    audioContext.close();
    
    return audioData;
  }, []);

  // Enhanced transcription handler with conversational support
  const transcribeWithWhisper = useCallback(
    async (blob: Blob): Promise<TranscriptionResult | null> => {
      try {
        const audioData = await blobToFloat32Array(blob);
        const result = await transcribeWhisper(audioData);
        if (result) {
          // Add to main transcriptions
          setTranscriptions((prev) => [...prev, result]);

          // Handle conversational mode transcription
          if (conversational?.onChunk && result.chunkIndex !== undefined) {
            const chunk = audioChunks[result.chunkIndex];
            if (chunk) {
              // Store transcription for this chunk
              setChunkTranscriptions((prev) => new Map(prev).set(chunk.id, result.text));

              // Try to emit chunk if audio is also ready
              tryEmitChunk(chunk);
            }
          }

          return result;
        }
        return null;
      } catch (error) {
        // Transcription failed
        return null;
      }
    },
    [blobToFloat32Array, transcribeWhisper, conversational, audioChunks, tryEmitChunk]
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
        const { processFileWithMetrics } = await loadMurmubaraProcessing();
        const processedResult = await processFileWithMetrics(originalBuffer, () => {
          // Callback for real-time metrics if needed
          if (DEBUG_MODE) {
            // Processing metrics
          }
        });

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
          sampleRate: 44100, // TODO: Extract from actual buffer
          channels: 2, // TODO: Extract from actual buffer
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
    [whisperReady, isEngineInitialized, initializeAudioEngine, transcribeWithWhisper, analyzeVAD, calculateDuration]
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

  // NEW: Auto-initialize audio engine when Whisper is ready
  useEffect(() => {
    if (whisperReady && !isEngineInitialized && !isInitializingEngine && !engineError) {
      initializeAudioEngine().catch(() => {
        // Don't throw - allow manual initialization
      });
    }
  }, [whisperReady, isEngineInitialized, isInitializingEngine, engineError, initializeAudioEngine]);

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
      // Clean up conversational resources
      clearConversationalChunks();

      // Clean up streaming recording if active
      if (streamingSessionRef.current) {
        streamingSessionRef.current.stop().catch(() => {
          // Error stopping streaming session on unmount
        });
      }

      // Clean up Modern VAD resources
      destroyModernVAD();

      // Murmuraba v3 hook handles all cleanup automatically
    };
  }, [clearConversationalChunks]);

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
    exportChunkAsWav: (chunkId: string) => exportChunkAsWav(chunkId, 'processed'),
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
