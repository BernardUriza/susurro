import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranscription } from './useTranscription';
import { murmurabaManager } from '../lib/murmuraba-singleton';
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

  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([]);
  const [averageVad, setAverageVad] = useState(0);
  const [transcriptions, setTranscriptions] = useState<TranscriptionResult[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    currentChunk: 0,
    totalChunks: 0,
    stage: 'idle'
  });

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const startTimeRef = useRef<number>(0);

  // Use existing hooks
  const { 
    transcribe, 
    isLoading: isTranscribing,
    whisperReady,
    whisperProgress,
    whisperError,
    transcribeWithWhisper: transcribeWhisper
  } = useTranscription({
    onTranscriptionComplete: (result) => {
      setTranscriptions(prev => [...prev, result]);
    },
    onStatusUpdate: (status) => {
      setProcessingStatus(prev => ({ 
        ...prev, 
        ...status,
        stage: status.stage as ProcessingStatus['stage'] || prev.stage
      }));
    },
    whisperConfig: {
      language: whisperConfig.language || 'en'
    }
  });

  // Helper functions
  const createChunk = (blob: Blob, startTime: number, endTime: number): AudioChunk => ({
    id: `chunk-${Date.now()}-${Math.random()}`,
    blob,
    duration: endTime - startTime,
    startTime,
    endTime
  });

  // Process audio file with Murmuraba
  const processAudioFile = useCallback(async (file: File) => {
    try {
      console.log('[useSusurro] Starting file processing...');
      setTranscriptions([]);
      
      // Step 1: Initialize Murmuraba
      await murmurabaManager.initialize();
      console.log('[useSusurro] Murmuraba initialized');
      
      // Step 2: Process with Murmuraba to clean audio with metrics
      console.log('[useSusurro] Processing with Murmuraba for audio cleaning...');
      const cleanedResult = await murmurabaManager.processFileWithMetrics(file, (metrics) => {
        console.log('[useSusurro] Frame metrics:', metrics);
      });
      
      console.log('[useSusurro] Murmuraba processing complete, cleaned audio received');
      console.log('[useSusurro] Murmuraba result:', {
        hasProcessedBuffer: !!cleanedResult.processedBuffer,
        hasVadScores: !!cleanedResult.vadScores,
        averageVad: cleanedResult.averageVad
      });
      
      // Step 3: Use Murmuraba's chunking if available
      if (cleanedResult.chunks && Array.isArray(cleanedResult.chunks)) {
        console.log('[useSusurro] Using chunks from Murmuraba:', cleanedResult.chunks.length);
        const chunks: AudioChunk[] = [];
        
        for (const chunk of cleanedResult.chunks) {
          const wavBlob = chunk.blob || await audioBufferToWav(chunk.audioBuffer);
          const audioChunk = createChunk(wavBlob, chunk.startTime, chunk.endTime);
          if (chunk.vadScore !== undefined) {
            audioChunk.vadScore = chunk.vadScore;
          }
          chunks.push(audioChunk);
        }
        
        setAudioChunks(chunks);
        setAverageVad(cleanedResult.averageVad || 0);
      } else {
        // Fallback: manually create chunks from cleaned audio
        console.log('[useSusurro] Creating chunks manually from cleaned audio');
        const audioContext = new AudioContext();
        let audioBuffer: AudioBuffer;
        
        if (cleanedResult.processedBuffer instanceof ArrayBuffer) {
          audioBuffer = await audioContext.decodeAudioData(cleanedResult.processedBuffer);
        } else if (cleanedResult.processedBuffer instanceof Blob) {
          const arrayBuffer = await cleanedResult.processedBuffer.arrayBuffer();
          audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        } else {
          audioBuffer = cleanedResult.processedBuffer;
        }
        
        console.log('[useSusurro] Cleaned audio decoded, duration:', audioBuffer.duration, 'seconds');
        
        const duration = audioBuffer.duration * 1000;
        const chunks: AudioChunk[] = [];
        const chunkCount = Math.ceil(duration / chunkDurationMs);
        
        for (let i = 0; i < chunkCount; i++) {
          const startTime = i * chunkDurationMs;
          const endTime = Math.min((i + 1) * chunkDurationMs, duration);
          
          const startSample = Math.floor((startTime / 1000) * audioBuffer.sampleRate);
          const endSample = Math.floor((endTime / 1000) * audioBuffer.sampleRate);
          const frameCount = endSample - startSample;
          
          const chunkBuffer = audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            frameCount,
            audioBuffer.sampleRate
          );
          
          for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            const chunkChannelData = chunkBuffer.getChannelData(channel);
            for (let j = 0; j < frameCount; j++) {
              chunkChannelData[j] = channelData[startSample + j];
            }
          }
          
          const wavBlob = await audioBufferToWav(chunkBuffer);
          chunks.push(createChunk(wavBlob, startTime, endTime));
        }
        
        console.log('[useSusurro] Created', chunks.length, 'chunks for transcription');
        setAverageVad(cleanedResult.averageVad || 0);
        setAudioChunks(chunks);
        audioContext.close();
      }
    } catch (error) {
      console.error('[useSusurro] Error processing audio file:', error);
      throw error;
    }
  }, [chunkDurationMs, enableVAD]);

  // Process chunks for transcription
  const processChunks = useCallback(async (chunks: AudioChunk[]) => {
    setProcessingStatus({
      isProcessing: true,
      currentChunk: 0,
      totalChunks: chunks.length,
      stage: 'processing'
    });
    
    // Process each chunk with Whisper
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      setProcessingStatus(prev => ({
        ...prev,
        currentChunk: i + 1
      }));
      
      try {
        const result = await transcribeWhisper(chunk.blob);
        if (result) {
          setTranscriptions(prev => [...prev, {
            text: result.text,
            segments: result.segments || [],
            chunkIndex: i,
            timestamp: Date.now()
          }]);
        }
      } catch (error) {
        console.error(`[useSusurro] Error transcribing chunk ${i + 1}:`, error);
      }
    }

    setProcessingStatus({
      isProcessing: false,
      currentChunk: 0,
      totalChunks: 0,
      stage: 'complete'
    });
  }, [transcribeWhisper]);

  // Recording functions
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const audioFile = new File([blob], 'recording.webm', { type: 'audio/webm' });
        await processAudioFile(audioFile);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      startTimeRef.current = Date.now();
      mediaRecorder.start(chunkDurationMs);
      setIsRecording(true);
      setAudioChunks([]);
      setTranscriptions([]);
    } catch (error) {
      console.error('[useSusurro] Error starting recording:', error);
      throw error;
    }
  }, [chunkDurationMs, processAudioFile]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setIsPaused(false);
    }
  }, [isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  }, [isRecording, isPaused]);

  const clearTranscriptions = useCallback(() => {
    setTranscriptions([]);
  }, []);

  // Auto-process chunks when ready
  useEffect(() => {
    if (audioChunks.length > 0 && !isRecording && whisperReady) {
      // Add delay to ensure Murmuraba processing is complete
      setTimeout(() => {
        processChunks(audioChunks);
      }, 100);
    }
  }, [audioChunks, isRecording, whisperReady, processChunks]);

  return {
    isRecording,
    isProcessing: processingStatus.isProcessing || isTranscribing,
    transcriptions,
    audioChunks,
    processingStatus,
    averageVad,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearTranscriptions,
    processAudioFile,
    // Whisper-related properties
    whisperReady,
    whisperProgress,
    whisperError,
    transcribeWithWhisper: transcribeWhisper
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
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
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