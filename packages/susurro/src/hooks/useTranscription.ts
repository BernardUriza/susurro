import { useState, useCallback } from 'react';
import { useWhisperDirect } from './useWhisperDirect';
import { TranscriptionResult, AudioChunk, WhisperConfig } from '../lib/types';

interface UseTranscriptionOptions {
  onTranscriptionComplete?: (result: TranscriptionResult) => void;
  onStatusUpdate?: (status: Partial<TranscriptionStatus>) => void;
  whisperConfig?: WhisperConfig;
}

interface TranscriptionStatus {
  isProcessing: boolean;
  currentChunk: number;
  totalChunks: number;
  stage: string;
}

interface UseTranscriptionReturn {
  transcribe: (chunk: AudioChunk) => Promise<TranscriptionResult | null>;
  isLoading: boolean;
  status: TranscriptionStatus;
  // Whisper-specific methods and properties
  whisperReady: boolean;
  whisperProgress: number;
  whisperError: any;
  transcribeWithWhisper: (blob: Blob) => Promise<TranscriptionResult | null>;
}

export function useTranscription(options: UseTranscriptionOptions = {}): UseTranscriptionReturn {
  const { onTranscriptionComplete, onStatusUpdate, whisperConfig = {} } = options;

  const [status, setStatus] = useState<TranscriptionStatus>({
    isProcessing: false,
    currentChunk: 0,
    totalChunks: 0,
    stage: 'idle',
  });

  const {
    transcribe: whisperTranscribe,
    isTranscribing,
    modelReady: whisperReady,
    loadingProgress: whisperProgress,
    error: whisperError,
  } = useWhisperDirect(whisperConfig);

  const transcribe = useCallback(
    async (chunk: AudioChunk): Promise<TranscriptionResult | null> => {
      try {
        setStatus((prev) => ({ ...prev, isProcessing: true, stage: 'transcribing' }));
        onStatusUpdate?.({ isProcessing: true, stage: 'transcribing' });

        const result = await whisperTranscribe(chunk.blob);

        if (result) {
          const transcriptionResult: TranscriptionResult = {
            ...result,
            chunkIndex: chunk.startTime / 8000, // Assuming 8 second chunks
            timestamp: Date.now(),
          };

          onTranscriptionComplete?.(transcriptionResult);
          setStatus((prev) => ({ ...prev, isProcessing: false, stage: 'complete' }));
          onStatusUpdate?.({ isProcessing: false, stage: 'complete' });

          return transcriptionResult;
        }

        return null;
      } catch (error) {
        setStatus((prev) => ({ ...prev, isProcessing: false, stage: 'error' }));
        onStatusUpdate?.({ isProcessing: false, stage: 'error' });
        return null;
      }
    },
    [whisperTranscribe, onTranscriptionComplete, onStatusUpdate]
  );

  return {
    transcribe,
    isLoading: isTranscribing || status.isProcessing,
    status,
    // Expose whisper-specific properties
    whisperReady,
    whisperProgress,
    whisperError,
    transcribeWithWhisper: whisperTranscribe,
  };
}
