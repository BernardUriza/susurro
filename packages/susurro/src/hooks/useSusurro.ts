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
} from '../lib/types';

// Direct import from Murmuraba v3 - Real package integration
import { useMurmubaraEngine } from 'murmuraba';

// Conversational Evolution - Advanced chunk middleware
import { ChunkMiddlewarePipeline } from '../lib/chunk-middleware';

// Phase 3: Latency optimization and measurement
import { latencyMonitor, type LatencyMetrics, type LatencyReport } from '../lib/latency-monitor';

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

  // Phase 3: Latency monitoring state
  const [latencyReport, setLatencyReport] = useState<LatencyReport>(
    latencyMonitor.generateReport()
  );
  const [latencyStatus, setLatencyStatus] = useState(latencyMonitor.getRealtimeStatus());

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
          // Log middleware processing failure in development only
          if (process.env.NODE_ENV === 'development') {
            console.warn('Middleware processing failed:', error);
          }
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
        if (process.env.NODE_ENV === 'development') {
          console.warn('Transcription failed:', error);
        }
        return null;
      }
    },
    [transcribeWhisper, conversational, audioChunks, tryEmitChunk]
  );

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
          if (process.env.NODE_ENV === 'development') {
            console.warn('Transcription failed for chunk:', chunk.id, error);
          }
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

    // Hook handles all audio setup and initialization
    await startMurmurabaRecording();
  }, [startMurmurabaRecording]);

  const stopRecording = useCallback(() => {
    // Hook handles all cleanup automatically
    stopMurmurabaRecording();
  }, [stopMurmurabaRecording]);

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
          if (process.env.NODE_ENV === 'development') {
            console.warn('Transcription failed for chunk:', chunk.id, error);
          }

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
  };
}

