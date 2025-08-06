/**
 * EMERGENCY STUB for broken useMurmubaraEngine
 *
 * The murmuraba package exports an empty object, so useMurmubaraEngine doesn't exist.
 * This stub provides the minimal interface needed for the app to function while
 * we fix the underlying architecture.
 */

import { useState, useCallback, useRef } from 'react';

interface AudioChunk {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  processedAudioUrl?: string;
  averageVad?: number;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  chunks: AudioChunk[];
  currentChunk: AudioChunk | null;
}

interface UseMurmubaraEngineReturn {
  recordingState: RecordingState;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
export function useMurmubaraEngine(_config?: any): UseMurmubaraEngineReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [chunks, setChunks] = useState<AudioChunk[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const recordingState: RecordingState = {
    isRecording,
    isPaused,
    chunks,
    currentChunk: null,
  };

  const startRecording = useCallback(async () => {
    try {
      // eslint-disable-next-line no-console
      console.log('[STUB] Starting recording...');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const recordedChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (recordedChunks.length > 0) {
          const blob = new Blob(recordedChunks, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(blob);

          const chunk: AudioChunk = {
            id: `chunk-${Date.now()}`,
            startTime: Date.now() - 5000, // Approximate
            endTime: Date.now(),
            duration: 5000,
            processedAudioUrl: audioUrl,
            averageVad: 0.5, // Placeholder
          };

          setChunks((prev) => [...prev, chunk]);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);

      // eslint-disable-next-line no-console
      console.log('[STUB] Recording started');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[STUB] Failed to start recording:', error);
      throw error;
    }
  }, []);

  const stopRecording = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log('[STUB] Stopping recording...');

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setIsPaused(false);
    mediaRecorderRef.current = null;

    // eslint-disable-next-line no-console
    console.log('[STUB] Recording stopped');
  }, [isRecording]);

  const pauseRecording = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log('[STUB] Pausing recording...');

    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log('[STUB] Resuming recording...');

    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  }, [isRecording, isPaused]);

  return {
    recordingState,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
