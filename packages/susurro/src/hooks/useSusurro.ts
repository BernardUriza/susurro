import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioProcessor } from './useAudioProcessor';
import { useTranscription } from './useTranscription';
import { useWhisperDirect } from './useWhisperDirect';
import { MurmurabaSingleton } from '../lib/murmuraba-singleton';
import type { AudioChunk, ProcessingStatus, TranscriptionResult } from '../lib/types';

export interface UseSusurroOptions {
  chunkDurationMs?: number;
  enableVAD?: boolean;
  whisperConfig?: {
    model?: string;
    language?: string;
  };
}

export interface UseSusurroReturn {
  isRecording: boolean;
  isProcessing: boolean;
  transcriptions: TranscriptionResult[];
  audioChunks: AudioChunk[];
  processingStatus: ProcessingStatus;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearTranscriptions: () => void;
  processAudioFile: (file: File) => Promise<void>;
}

export function useSusurro(options: UseSusurroOptions = {}): UseSusurroReturn {
  const {
    chunkDurationMs = 8000,
    enableVAD = true,
    whisperConfig = {}
  } = options;

  const [transcriptions, setTranscriptions] = useState<TranscriptionResult[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    currentChunk: 0,
    totalChunks: 0,
    stage: 'idle'
  });

  const murmurabaSingleton = MurmurabaSingleton.getInstance();

  const {
    isRecording,
    isPaused,
    audioChunks,
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
    pauseRecording: pauseAudioRecording,
    resumeRecording: resumeAudioRecording,
    processAudioFile: processFile
  } = useAudioProcessor({
    chunkDurationMs,
    enableVAD
  });

  const { transcribe, isLoading: isTranscribing } = useTranscription({
    onTranscriptionComplete: (result) => {
      setTranscriptions(prev => [...prev, result]);
    },
    onStatusUpdate: (status) => {
      setProcessingStatus(prev => ({ 
        ...prev, 
        ...status,
        stage: status.stage as ProcessingStatus['stage'] || prev.stage
      }));
    }
  });

  const { transcribe: transcribeWhisper } = useWhisperDirect({
    model: (whisperConfig.model || 'Xenova/whisper-tiny') as any,
    language: whisperConfig.language || 'en'
  });

  const processChunks = useCallback(async (chunks: AudioChunk[]) => {
    setProcessingStatus({
      isProcessing: true,
      currentChunk: 0,
      totalChunks: chunks.length,
      stage: 'transcribing'
    });

    for (let i = 0; i < chunks.length; i++) {
      setProcessingStatus(prev => ({
        ...prev,
        currentChunk: i + 1,
        stage: 'transcribing'
      }));

      const result = await transcribe(chunks[i]);
      if (result) {
        setTranscriptions(prev => [...prev, result]);
      }
    }

    setProcessingStatus({
      isProcessing: false,
      currentChunk: 0,
      totalChunks: 0,
      stage: 'complete'
    });
  }, [transcribe]);

  useEffect(() => {
    if (audioChunks.length > 0 && !isRecording) {
      processChunks(audioChunks);
    }
  }, [audioChunks, isRecording, processChunks]);

  const startRecording = useCallback(async () => {
    setTranscriptions([]);
    await startAudioRecording();
  }, [startAudioRecording]);

  const clearTranscriptions = useCallback(() => {
    setTranscriptions([]);
  }, []);

  const processAudioFile = useCallback(async (file: File) => {
    setTranscriptions([]);
    await processFile(file);
  }, [processFile]);

  return {
    isRecording,
    isProcessing: processingStatus.isProcessing || isTranscribing,
    transcriptions,
    audioChunks,
    processingStatus,
    startRecording,
    stopRecording: stopAudioRecording,
    pauseRecording: pauseAudioRecording,
    resumeRecording: resumeAudioRecording,
    clearTranscriptions,
    processAudioFile
  };
}