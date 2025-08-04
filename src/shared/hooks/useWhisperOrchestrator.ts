import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  useOptimistic,
  useMemo,
} from 'react';
import { useTranscription } from '@susurro/core';
import type { WhisperFragment, ProcessingState, WhisperRevelation } from '../types/whisper-types';

export interface WhisperOrchestratorOptions {
  temporalSegmentMs?: number;
  enableVoiceResonance?: boolean;
  whisperConfig?: {
    model?: string;
    language?: string;
  };
}

export interface WhisperOrchestratorReturn {
  isCapturing: boolean;
  isProcessing: boolean;
  revelations: WhisperRevelation[];
  audioFragments: WhisperFragment[];
  processingState: ProcessingState;
  averageResonance: number;
  startCapturing: () => Promise<void>;
  stopCapturing: () => void;
  pauseCapturing: () => void;
  resumeCapturing: () => void;
  clearRevelations: () => void;
  processAudioFile: (file: File) => Promise<void>;
  // Whisper-related properties
  whisperReady: boolean;
  whisperProgress: number;
  whisperError: any;
  transcribeWithWhisper: (blob: Blob) => Promise<any>;
}

export function useWhisperOrchestrator(
  options: WhisperOrchestratorOptions = {}
): WhisperOrchestratorReturn {
  const { temporalSegmentMs = 8000, enableVoiceResonance = true, whisperConfig = {} } = options;

  // React 19 concurrent features
  const [isPending, startTransition] = useTransition();
  const [optimisticRevelations, addOptimisticRevelation] = useOptimistic(
    [] as WhisperRevelation[],
    (state, newRevelation: WhisperRevelation) => [...state, newRevelation]
  );

  // State management with whisper-themed naming
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioFragments, setAudioFragments] = useState<WhisperFragment[]>([]);
  const [averageResonance, setAverageResonance] = useState(0);
  const [revelations, setRevelations] = useState<WhisperRevelation[]>([]);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    currentFragment: 0,
    totalFragments: 0,
    stage: 'silent',
  });

  // Refs with whisper-themed naming
  const audioCapturerRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const captureStartTimeRef = useRef<number>(0);

  // Use existing hooks with updated interface
  const {
    transcribe,
    isLoading: isTranscribing,
    whisperReady,
    whisperProgress,
    whisperError,
    transcribeWithWhisper: transcribeWhisper,
  } = useTranscription({
    onTranscriptionComplete: (result) => {
      const revelation: WhisperRevelation = {
        decodedMessage: result.text,
        audioFragments: result.segments || [],
        fragmentIndex: result.chunkIndex || 0,
        revelationTime: Date.now(),
        confidenceScore: result.confidence || 0.5,
        languageDetected: result.language || 'unknown',
        processingDuration: result.processingTime || 0,
      };
      setRevelations((prev) => [...prev, revelation]);
    },
    onStatusUpdate: (status) => {
      setProcessingState((prev) => ({
        ...prev,
        ...status,
        stage: (status.stage as ProcessingState['stage']) || prev.stage,
      }));
    },
    whisperConfig: {
      language: whisperConfig.language || 'en',
    },
  });

  // Helper functions with whisper-themed naming
  const createWhisperFragment = (
    blob: Blob,
    echoStart: number,
    echoEnd: number
  ): WhisperFragment => ({
    whisperID: `whisper-${Date.now()}-${Math.random()}`,
    audioEssence: blob,
    temporalSpan: echoEnd - echoStart,
    echoStart,
    echoEnd,
    spectralSignature: new Float32Array(0), // Placeholder
  });

  // Process audio file with optimistic UI updates
  const processAudioFileWithOptimism = useCallback(
    async (file: File) => {
      try {
        setRevelations([]);

        // Add optimistic revelation for immediate feedback
        addOptimisticRevelation({
          decodedMessage: '[WHISPER_PROCESSING_AUDIO_ESSENCE...]',
          audioFragments: [],
          fragmentIndex: 0,
          revelationTime: Date.now(),
          confidenceScore: 0,
          languageDetected: 'processing',
          processingDuration: 0,
        });

        // Use React 19 startTransition for non-blocking updates
        startTransition(async () => {
          // Note: murmurabaManager deprecated in v3 - use useSusurro hook instead
          // This is a legacy function that should be refactored to use the new hook pattern
          
          // Create a simple fragment from the file for now
          const arrayBuffer = await file.arrayBuffer();
          const blob = new Blob([arrayBuffer], { type: file.type });
          const fragment = createWhisperFragment(blob, 0, file.size);
          
          setAudioFragments([fragment]);
          setAverageResonance(0.5); // Default value
        });
      } catch (error) {
        throw error;
      }
    },
    [temporalSegmentMs, enableVoiceResonance, addOptimisticRevelation]
  );

  // Process fragments for transcription with React 19 patterns
  const processFragmentsWithConcurrency = useCallback(
    async (fragments: WhisperFragment[]) => {
      setProcessingState({
        isProcessing: true,
        currentFragment: 0,
        totalFragments: fragments.length,
        stage: 'decoding',
      });

      // Process fragments concurrently using React 19 patterns
      const fragmentPromises = fragments.map(async (fragment, index) => {
        setProcessingState((prev) => ({
          ...prev,
          currentFragment: index + 1,
        }));

        try {
          const result = await transcribeWhisper(fragment.audioEssence);
          if (result) {
            const revelation: WhisperRevelation = {
              decodedMessage: result.text,
              audioFragments: result.segments || [],
              fragmentIndex: index,
              revelationTime: Date.now(),
              confidenceScore: result.confidence || 0.5,
              languageDetected: result.language || 'en',
              processingDuration: result.processingTime || 0,
            };

            // Use optimistic updates for immediate UI feedback
            addOptimisticRevelation(revelation);
            setRevelations((prev) => [...prev, revelation]);
          }
        } catch (error) {
          console.error(`Fragment ${index} processing failed:`, error);
        }
      });

      await Promise.allSettled(fragmentPromises);

      setProcessingState({
        isProcessing: false,
        currentFragment: 0,
        totalFragments: 0,
        stage: 'complete',
      });
    },
    [transcribeWhisper, addOptimisticRevelation]
  );

  // Capture functions with whisper-themed naming
  const startCapturing = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCapturer = new MediaRecorder(stream);
      const essenceChunks: Blob[] = [];

      audioCapturer.ondataavailable = (event) => {
        if (event.data.size > 0) {
          essenceChunks.push(event.data);
        }
      };

      audioCapturer.onstop = async () => {
        const audioEssence = new Blob(essenceChunks, { type: 'audio/webm' });
        const audioFile = new File([audioEssence], 'whisper-capture.webm', { type: 'audio/webm' });
        await processAudioFileWithOptimism(audioFile);
      };

      audioCapturerRef.current = audioCapturer;
      captureStartTimeRef.current = Date.now();
      audioCapturer.start(temporalSegmentMs);
      setIsCapturing(true);
      setAudioFragments([]);
      setRevelations([]);
    } catch (error) {
      throw error;
    }
  }, [temporalSegmentMs, processAudioFileWithOptimism]);

  const stopCapturing = useCallback(() => {
    if (audioCapturerRef.current && isCapturing) {
      audioCapturerRef.current.stop();
      audioCapturerRef.current.stream.getTracks().forEach((track) => track.stop());
      audioCapturerRef.current = null;
      setIsCapturing(false);
      setIsPaused(false);
    }
  }, [isCapturing]);

  const pauseCapturing = useCallback(() => {
    if (audioCapturerRef.current && isCapturing && !isPaused) {
      audioCapturerRef.current.pause();
      setIsPaused(true);
    }
  }, [isCapturing, isPaused]);

  const resumeCapturing = useCallback(() => {
    if (audioCapturerRef.current && isCapturing && isPaused) {
      audioCapturerRef.current.resume();
      setIsPaused(false);
    }
  }, [isCapturing, isPaused]);

  const clearRevelations = useCallback(() => {
    setRevelations([]);
  }, []);

  // Auto-process fragments when ready with React 19 concurrent features
  useEffect(() => {
    if (audioFragments.length > 0 && !isCapturing && whisperReady) {
      // Use startTransition to avoid blocking the UI
      startTransition(() => {
        setTimeout(() => {
          processFragmentsWithConcurrency(audioFragments);
        }, 100);
      });
    }
  }, [audioFragments, isCapturing, whisperReady, processFragmentsWithConcurrency]);

  // Cleanup with enhanced resource management
  useEffect(() => {
    return () => {
      // Clean up audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // Stop and clean up audio capturer
      if (audioCapturerRef.current) {
        if (audioCapturerRef.current.state !== 'inactive') {
          audioCapturerRef.current.stop();
        }
        audioCapturerRef.current.stream.getTracks().forEach((track) => track.stop());
        audioCapturerRef.current = null;
      }
    };
  }, []);

  return {
    isCapturing,
    isProcessing: processingState.isProcessing || isTranscribing || isPending,
    revelations: optimisticRevelations.length > 0 ? optimisticRevelations : revelations,
    audioFragments,
    processingState,
    averageResonance,
    startCapturing,
    stopCapturing,
    pauseCapturing,
    resumeCapturing,
    clearRevelations,
    processAudioFile: processAudioFileWithOptimism,
    // Whisper-related properties
    whisperReady,
    whisperProgress,
    whisperError,
    transcribeWithWhisper: transcribeWhisper,
  };
}

// Helper function with enhanced WAV processing
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
