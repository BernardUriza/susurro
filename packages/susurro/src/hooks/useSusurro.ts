import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranscription } from './useTranscription';
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
  processAudioFile: (file: File) => Promise<void>;
  // Whisper-related properties
  whisperReady: boolean;
  whisperProgress: number;
  whisperError: any;
  transcribeWithWhisper: (blob: Blob) => Promise<any>;
  // Built-in export functions (Murmuraba v3)
  exportChunkAsWav: (chunkId: string) => Promise<Blob>;
  // Conversational features
  conversationalChunks: SusurroChunk[];
  clearConversationalChunks: () => void;
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

  // Refs - Minimal refs for conversational features only
  const startTimeRef = useRef<number>(0);
  const chunkEmissionTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Use existing hooks with conversational enhancement
  const {
    transcribe,
    isLoading: isTranscribing,
    whisperReady,
    whisperProgress,
    whisperError,
    transcribeWithWhisper: transcribeWhisper,
  } = useTranscription({
    onTranscriptionComplete: (result) => {
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
    },
    onStatusUpdate: (status) => {
      setProcessingStatus((prev) => ({
        ...prev,
        ...status,
        stage: (status.stage as ProcessingStatus['stage']) || prev.stage,
      }));
    },
    whisperConfig: {
      language: whisperConfig?.language || 'en',
    },
  });

  // Helper functions
  const createChunk = (blob: Blob, startTime: number, endTime: number): AudioChunk => {
    const id = `chunk-${Date.now()}-${Math.random()}`;
    // Track processing start time for latency measurement
    chunkProcessingTimes.set(id, Date.now());

    return {
      id,
      blob,
      duration: endTime - startTime,
      startTime,
      endTime,
    };
  };

  // Conversational helper functions
  const createAudioUrl = useCallback((blob: Blob): string => {
    return URL.createObjectURL(blob);
  }, []);

  const hasTranscriptFor = useCallback(
    (chunkId: string): boolean => {
      return chunkTranscriptions.has(chunkId);
    },
    [chunkTranscriptions]
  );

  const getTranscriptFor = useCallback(
    (chunkId: string): string => {
      return chunkTranscriptions.get(chunkId) || '';
    },
    [chunkTranscriptions]
  );

  const tryEmitChunk = useCallback(
    (chunk: AudioChunk, forceEmit = false) => {
      if (!conversational?.onChunk) return;

      const audioUrl = processedAudioUrls.get(chunk.id);
      const transcript = chunkTranscriptions.get(chunk.id);
      const processingStartTime = chunkProcessingTimes.get(chunk.id);

      // Only emit when both audio and transcript are ready
      if (audioUrl && transcript) {
        const processingLatency = processingStartTime
          ? Date.now() - processingStartTime
          : undefined;

        const susurroChunk: SusurroChunk = {
          id: chunk.id,
          audioUrl,
          transcript,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          vadScore: chunk.vadScore || 0,
          isComplete: true,
          processingLatency,
        };

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
    [conversational, processedAudioUrls, chunkTranscriptions, chunkProcessingTimes]
  );

  const clearConversationalChunks = useCallback(() => {
    // Clear URL objects to prevent memory leaks
    conversationalChunks.forEach((chunk) => {
      if (chunk.audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(chunk.audioUrl);
      }
    });

    setConversationalChunks([]);
    setProcessedAudioUrls(new Map());
    setChunkTranscriptions(new Map());
    setChunkProcessingTimes(new Map());

    // Clear any pending timeouts
    chunkEmissionTimeoutRef.current.forEach((timeout) => clearTimeout(timeout));
    chunkEmissionTimeoutRef.current.clear();
  }, [conversationalChunks]);

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
          setProcessedAudioUrls((prev) => new Map(prev).set(audioChunk.id, chunk.processedAudioUrl!));
          
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

  // Process audio file - DEPRECATED in Murmuraba v3
  const processAudioFile = useCallback(async (file: File) => {
    throw new Error(
      'File processing is deprecated in Murmuraba v3. Use real-time recording with startRecording() instead.'
    );
  }, []);

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
          const result = await transcribeWhisper(chunk.blob);
          if (result) {
            setTranscriptions((prev) => [
              ...prev,
              {
                text: result.text,
                segments: result.segments || [],
                chunkIndex: i,
                timestamp: Date.now(),
              },
            ]);
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
    try {
      startTimeRef.current = Date.now();
      setAudioChunks([]);
      setTranscriptions([]);

      // Hook handles all MediaRecorder setup and initialization
      await startMurmurabaRecording();
    } catch (error) {
      throw error;
    }
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
  }, [conversational]);

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
          const result = await transcribeWhisper(chunk.blob);
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
    processAudioFile, // Deprecated in v3
    // Built-in export functions from hook - wrapped for compatibility
    exportChunkAsWav: (chunkId: string) => exportChunkAsWav(chunkId, 'processed'),
    // Whisper-related properties
    whisperReady,
    whisperProgress,
    whisperError,
    transcribeWithWhisper: transcribeWhisper,
    // Conversational features
    conversationalChunks,
    clearConversationalChunks,
  };
}

// Helper function to convert AudioBuffer to WAV
async function audioBufferToWav(audioBuffer: AudioBuffer): Promise<Blob> {
  const length = audioBuffer.length * audioBuffer.numberOfChannels * 2;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const floatTo16BitPCM = (output: DataView, offset: number, input: Float32Array) => {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, audioBuffer.numberOfChannels, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * audioBuffer.numberOfChannels * 2, true);
  view.setUint16(32, audioBuffer.numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length, true);

  const offset = 44;
  const interleaved = new Float32Array(audioBuffer.length * audioBuffer.numberOfChannels);

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      interleaved[i * audioBuffer.numberOfChannels + channel] = channelData[i];
    }
  }

  floatTo16BitPCM(view, offset, interleaved);

  return new Blob([buffer], { type: 'audio/wav' });
}
