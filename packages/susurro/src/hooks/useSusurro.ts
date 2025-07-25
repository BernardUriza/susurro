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
    averageVad,
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

  const { 
    transcribe: transcribeWhisper,
    modelReady: whisperReady,
    loadingProgress: whisperProgress,
    error: whisperError
  } = useWhisperDirect({
    model: (whisperConfig.model || 'Xenova/whisper-tiny') as any,
    language: whisperConfig.language || 'en'
  });

  const processChunks = useCallback(async (chunks: AudioChunk[]) => {
    setProcessingStatus({
      isProcessing: true,
      currentChunk: 0,
      totalChunks: chunks.length,
      stage: 'processing'
    });
    // For now, just show that audio was processed
    console.log('[useSusurro] Audio chunks processed by Murmuraba:', chunks.length);
    setTranscriptions([{
      text: '[Audio procesado por Murmuraba - Transcripción deshabilitada temporalmente]',
      segments: [],
      chunkIndex: 0,
      timestamp: Date.now()
    }]);

    setProcessingStatus({
      isProcessing: false,
      currentChunk: 0,
      totalChunks: 0,
      stage: 'complete'
    });
  }, [transcribe]);

  useEffect(() => {
    if (audioChunks.length > 0 && !isRecording) {
      // Add delay to ensure Murmuraba processing is complete
      setTimeout(() => {
        processChunks(audioChunks);
      }, 100);
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
    averageVad,
    startRecording,
    stopRecording: stopAudioRecording,
    pauseRecording: pauseAudioRecording,
    resumeRecording: resumeAudioRecording,
    clearTranscriptions,
    processAudioFile,
    // Whisper-related properties
    whisperReady,
    whisperProgress,
    whisperError,
    transcribeWithWhisper: transcribeWhisper
  };
}