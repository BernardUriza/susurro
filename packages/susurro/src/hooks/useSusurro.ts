import { useCallback, useEffect, useRef, useState } from 'react';
import { useWhisperDirect } from './useWhisperDirect';
// REMOVED: Singleton pattern replaced with direct hook usage
// REMOVED: import { murmurabaManager } from '../lib/murmuraba-singleton';
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

// Direct import from Murmuraba v3 - Real package integration
import { useMurmubaraEngine } from 'murmuraba';

// Import Murmuraba processing functions - ONLY useSusurro should access these
import {
  processFileWithMetrics as murmubaraProcess,
  murmubaraVAD,
  extractAudioMetadata
} from 'murmuraba';

// Use global engine manager for initialization
import { audioEngineManager } from '../lib/engine-manager';
import type { ProcessingMetrics as MurmurabaProcessingMetrics } from 'murmuraba';

// Conversational Evolution - Advanced chunk middleware
import { ChunkMiddlewarePipeline } from '../lib/chunk-middleware';

// Phase 3: Latency optimization and measurement
import { latencyMonitor, type LatencyMetrics, type LatencyReport } from '../lib/latency-monitor';

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
export interface UseSusurroOptions extends BaseUseSusurroOptions {}

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
  startStreamingRecording: (onChunk: (chunk: StreamingSusurroChunk) => void, config?: RecordingConfig) => Promise<void>;
  stopStreamingRecording: () => Promise<StreamingSusurroChunk[]>;
  
  // Auxiliary methods
  analyzeVAD: (buffer: ArrayBuffer) => Promise<VADAnalysisResult>;
  convertBlobToBuffer: (blob: Blob) => Promise<ArrayBuffer>;
  
  // NEW: Expose MediaStream for waveform visualization
  currentStream: MediaStream | null;
}

export function useSusurro(options: UseSusurroOptions = {}): UseSusurroReturn {
  const { chunkDurationMs = 8000, whisperConfig = {}, conversational } = options;

  // Direct useMurmubaraEngine hook integration (Murmuraba v3 pattern)
  const {
    recordingState,
    startRecording: startMurmurabaRecording,
    stopRecording: stopMurmurabaRecording,
    pauseRecording: pauseMurmurabaRecording,
    resumeRecording: resumeMurmurabaRecording,
    exportChunkAsWav,
    clearRecordings,
  } = useMurmubaraEngine({
    defaultChunkDuration: chunkDurationMs / 1000, // Convert to seconds
  });

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

  // Phase 3: Latency monitoring state
  const [latencyReport, setLatencyReport] = useState<LatencyReport>(
    latencyMonitor.generateReport()
  );
  const [latencyStatus, setLatencyStatus] = useState(latencyMonitor.getRealtimeStatus());

  // NEW: MediaStream state for waveform visualization
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);

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

  // Direct Whisper integration - no abstraction layer
  const {
    isTranscribing,
    modelReady: whisperReady,
    loadingProgress: whisperProgress,
    error: whisperError,
    transcribe: transcribeWhisper,
  } = useWhisperDirect({
    language: whisperConfig?.language || 'en',
    model: whisperConfig?.model,
  });

  // NEW REFACTORED METHODS - Core functionality
  
  // Audio engine initialization using global manager
  const initializeAudioEngine = useCallback(async (config?: AudioEngineConfig) => {
    const engineState = audioEngineManager.getState();
    
    // Check if already initialized or initializing
    if (engineState.isInitialized) {
      console.log('[useSusurro] Engine already initialized via manager');
      setIsEngineInitialized(true);
      return;
    }
    
    if (engineState.isInitializing) {
      console.log('[useSusurro] Engine initialization already in progress');
      return;
    }
    
    setIsInitializingEngine(true);
    setEngineError(null);
    
    try {
      console.log('[useSusurro] Initializing audio engine via manager...');
      
      // Convert our config to MurmubaraConfig format
      const murmubaraConfig = {
        logLevel: 'info' as const,
        noiseReductionLevel: 'high' as const,
        algorithm: 'rnnoise' as const,
        useAudioWorklet: true,
        autoCleanup: true
      };
      
      await audioEngineManager.initialize(murmubaraConfig);
      
      console.log('[useSusurro] Audio engine initialized successfully');
      setIsEngineInitialized(true);
      setEngineError(null);
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : 'Audio engine initialization failed';
      
      // Special handling for already initialized error
      if (errorMsg.includes('already initialized')) {
        console.log('[useSusurro] Engine reported as already initialized, accepting state');
        setIsEngineInitialized(true);
        setEngineError(null);
        return; // Don't throw, just accept the state
      }
      
      console.error('[useSusurro] Audio engine initialization failed:', error);
      setEngineError(errorMsg);
      throw new Error(`Audio engine initialization failed: ${errorMsg}`);
    } finally {
      setIsInitializingEngine(false);
    }
  }, []);
  
  // VAD analysis helper  
  const analyzeVAD = useCallback(async (buffer: ArrayBuffer): Promise<VADAnalysisResult> => {
    try {
      // Using real murmubaraVAD from v3.0.3
      const result = await murmubaraVAD(buffer);
      
      // Process results to find voice segments
      const voiceSegments: VoiceSegment[] = [];
      const vadScores = result.scores || [];
      const metrics = result.metrics || [];
      
      // Use voiceSegments from murmubaraVAD if available
      if (result.voiceSegments && result.voiceSegments.length > 0) {
        result.voiceSegments.forEach(segment => {
          voiceSegments.push({
            startTime: segment.startTime,
            endTime: segment.endTime,
            vadScore: segment.confidence,
            confidence: segment.confidence
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
              vadScore: vadScores.slice(segmentStart, i).reduce((a: number, b: number) => a + b, 0) / (i - segmentStart),
              confidence: vadScores.slice(segmentStart, i).reduce((a: number, b: number) => a + b, 0) / (i - segmentStart)
            });
            segmentStart = -1;
          }
        }
      }
      
      return {
        averageVad: result.average || 0,
        vadScores,
        metrics,
        voiceSegments
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
  const calculateDuration = (buffer: ArrayBuffer): number => {
    try {
      const metadata = extractAudioMetadata(buffer);
      return metadata.duration;
    } catch (error) {
      // Fallback to estimation if metadata extraction fails
      console.warn('Failed to extract audio metadata, using estimation:', error);
      const bytes = buffer.byteLength;
      const estimatedDuration = bytes / (44100 * 2 * 2); // 44.1kHz, 2 channels, 16-bit
      return Math.max(0.1, estimatedDuration);
    }
  };
  
  // STREAMING RECORDING with callback pattern - Modern React 19 approach
  const startStreamingRecording = useCallback(async (
    onChunk: (chunk: StreamingSusurroChunk) => void,
    config?: RecordingConfig
  ): Promise<void> => {
    if (isStreamingRecording) {
      throw new Error('Already recording. Stop current recording first.');
    }
    
    // Ensure engine is initialized with better error handling
    if (!isEngineInitialized) {
      try {
        console.log('[useSusurro] Engine not initialized, attempting initialization...');
        await initializeAudioEngine();
      } catch (error: any) {
        // If error is about already initialized, try to recover
        if (error?.message?.includes('already initialized')) {
          console.log('[useSusurro] Engine already initialized error, force resetting...');
          // Force reset the singleton state
          audioEngineManager.forceReset();
          // Mark as initialized locally and continue
          setIsEngineInitialized(true);
          console.log('[useSusurro] Recovered from initialization error, continuing...');
        } else {
          throw error;
        }
      }
    }
    
    setIsStreamingRecording(true);
    setCurrentStreamingChunks([]);
    streamingCallbackRef.current = onChunk;
    
    // Configuration with defaults
    const recordingConfig = {
      chunkDuration: 3, // 3 seconds per chunk
      vadThreshold: 0.5,
      enableRealTimeTranscription: true,
      enableNoiseReduction: true,
      ...config
    };
    
    try {
      console.log('[useSusurro] Starting streaming recording with config:', recordingConfig);
      
      // Get user media stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: recordingConfig.enableNoiseReduction,
          noiseSuppression: recordingConfig.enableNoiseReduction,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      setCurrentStream(stream);
      
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
        setCurrentStreamingChunks(prev => [...prev, chunk]);
        
        // Call the callback
        streamingCallbackRef.current(chunk);
        chunkIndex++;
      }, recordingConfig.chunkDuration * 1000);
      
      // Store session with proper cleanup
      const streamingSession = {
        stop: async () => {
          clearInterval(chunkInterval);
          
          // Stop media stream
          if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            setCurrentStream(null);
          }
          
          // Stop Murmuraba recording
          stopMurmurabaRecording();
          
          setIsStreamingRecording(false);
          streamingCallbackRef.current = null;
        }
      };
      
      // Store session reference
      streamingSessionRef.current = streamingSession;
      
      console.log('[useSusurro] Streaming recording started successfully');
      
    } catch (error) {
      setIsStreamingRecording(false);
      streamingCallbackRef.current = null;
      const errorMsg = error instanceof Error ? error.message : 'Failed to start streaming recording';
      throw new Error(`Streaming recording failed: ${errorMsg}`);
    }
  }, [isStreamingRecording, isEngineInitialized, initializeAudioEngine, startMurmurabaRecording, stopMurmurabaRecording, currentStream]);
  
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
          console.warn('Middleware processing failed:', error);
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

          latencyMonitor.recordMetrics(latencyMetrics);

          // Update real-time status
          setLatencyStatus(latencyMonitor.getRealtimeStatus());
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

  // Reset audio engine - cleanup and reinitialize
  const resetAudioEngine = useCallback(async () => {
    console.log('[useSusurro] Resetting audio engine...');
    
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
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      setCurrentStream(null);
    }
    
    // Use the global engine manager to reset
    await audioEngineManager.reset();
    
    // Clear all state
    setIsEngineInitialized(false);
    setEngineError(null);
    setIsStreamingRecording(false);
    setCurrentStreamingChunks([]);
    streamingCallbackRef.current = null;
    
    // Clear audio chunks and transcriptions
    setAudioChunks([]);
    setTranscriptions([]);
    clearConversationalChunks();
    
    console.log('[useSusurro] Audio engine reset complete');
    
    // Optionally reinitialize after a short delay
    setTimeout(async () => {
      try {
        await initializeAudioEngine();
        console.log('[useSusurro] Audio engine reinitialized after reset');
      } catch (error) {
        console.warn('[useSusurro] Failed to reinitialize after reset:', error);
      }
    }, 100);
  }, [
    recordingState.isRecording,
    stopMurmurabaRecording,
    currentStream,
    clearConversationalChunks,
    initializeAudioEngine,
    isEngineInitialized
  ]);

  // Enhanced transcription handler with conversational support
  const transcribeWithWhisper = useCallback(
    async (blob: Blob): Promise<TranscriptionResult | null> => {
      try {
        const result = await transcribeWhisper(blob);
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
        console.warn('Transcription failed:', error);
        return null;
      }
    },
    [transcribeWhisper, conversational, audioChunks, tryEmitChunk]
  );

  // MAIN METHOD FOR FILES - Everything in one (defined after transcribeWithWhisper)
  const processAndTranscribeFile = useCallback(async (file: File): Promise<CompleteAudioResult> => {
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
      const processedResult = await murmubaraProcess(originalBuffer, (metrics: MurmurabaProcessingMetrics) => {
        // Callback for real-time metrics if needed
        if (DEBUG_MODE) {
          console.log(`Processing: VAD=${metrics.vad?.toFixed(3)}, Frame=${metrics.frame}`);
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
        duration: calculateDuration(originalBuffer),
        sampleRate: 44100, // TODO: Extract from actual buffer
        channels: 2, // TODO: Extract from actual buffer
        fileSize: file.size,
        processedSize: processedResult.processedBuffer.byteLength
      };
      
      // 8. Compile complete result
      const result: CompleteAudioResult = {
        originalAudioUrl,
        processedAudioUrl,
        transcriptionText: transcriptionResult.text,
        transcriptionSegments: transcriptionResult.segments,
        vadAnalysis,
        metadata,
        processingTime: performance.now() - startTime
      };
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Audio processing failed';
      throw new Error(`File processing failed: ${errorMessage}`);
    }
  }, [whisperReady, isEngineInitialized, initializeAudioEngine, transcribeWithWhisper, analyzeVAD]);

  // Real-time chunk processing with hook pattern (Murmuraba v3 integration)
  useEffect(() => {
    const processNewChunks = async () => {
      const newChunks: AudioChunk[] = [];

      for (let index = audioChunks.length; index < recordingState.chunks.length; index++) {
        const chunk = recordingState.chunks[index];

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
              new Map(prev).set(audioChunk.id, chunk.processedAudioUrl!)
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
    const latestChunk = recordingState.chunks[recordingState.chunks.length - 1];
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
          console.warn('Transcription failed for chunk:', chunk.id, error);
        }
      }

      setProcessingStatus({
        isProcessing: false,
        currentChunk: 0,
        totalChunks: 0,
        stage: 'complete',
      });
    },
    [transcribeWhisper]
  );

  // Recording functions - Placeholder for Murmuraba v3 integration
  // Recording functions - Direct hook integration (Murmuraba v3 pattern)
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
          autoGainControl: true
        } 
      });
      setCurrentStream(stream);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to get MediaStream for visualization:', error);
      }
    }

    // Hook handles all audio setup and initialization
    await startMurmurabaRecording();
  }, [startMurmurabaRecording]);

  const stopRecording = useCallback(() => {
    // Clean up MediaStream
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      setCurrentStream(null);
    }

    // Hook handles all cleanup automatically
    stopMurmurabaRecording();
  }, [stopMurmurabaRecording, currentStream]);

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

  // Phase 3: Update latency reports periodically
  useEffect(() => {
    const updateLatencyReport = () => {
      setLatencyReport(latencyMonitor.generateReport());
      setLatencyStatus(latencyMonitor.getRealtimeStatus());
    };

    // Update every 10 seconds for real-time monitoring
    const interval = setInterval(updateLatencyReport, 10000);

    return () => clearInterval(interval);
  }, []);
  
  // NEW: Auto-initialize audio engine when Whisper is ready
  useEffect(() => {
    if (whisperReady && !isEngineInitialized && !isInitializingEngine && !engineError) {
      initializeAudioEngine({
        enableVAD: true,
        enableNoiseSuppression: true,
        enableEchoCancellation: true,
        vadThreshold: 0.5
      }).catch(error => {
        console.warn('Auto-initialization of audio engine failed:', error.message);
        // Don't throw - allow manual initialization
      });
    }
  }, [whisperReady, isEngineInitialized, isInitializingEngine, engineError, initializeAudioEngine]);

  // Auto-process chunks when ready
  useEffect(() => {
    if (audioChunks.length > 0 && !recordingState.isRecording && whisperReady) {
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
          console.warn('Transcription failed for chunk:', chunk.id, error);

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
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up conversational resources
      clearConversationalChunks();
      
      // Clean up streaming recording if active
      if (streamingSessionRef.current) {
        streamingSessionRef.current.stop().catch(console.error);
      }

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
    currentStream,
  };
}

