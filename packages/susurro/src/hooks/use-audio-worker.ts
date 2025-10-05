/**
 * useAudioWorker - Web Worker for non-blocking audio processing
 * Moves RNNoise and VAD processing off the main thread
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface AudioWorkerConfig {
  sampleRate?: number;
  channelCount?: number;
  denoiseStrength?: number;
  vadThreshold?: number;
}

export interface ProcessedAudioChunk {
  processedAudio: ArrayBuffer;
  vadScore: number;
  isVoiceActive: boolean;
  rms: number;
  sampleRate: number;
  timestamp: number;
}

export interface UseAudioWorkerReturn {
  // State
  isReady: boolean;
  isProcessing: boolean;

  // Actions
  processAudio: (audioData: Float32Array) => void;
  stop: () => void;

  // Event handlers (set these)
  onAudioProcessed?: (chunk: ProcessedAudioChunk) => void;
  onError?: (error: string) => void;
}

export function useAudioWorker(config?: AudioWorkerConfig): UseAudioWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Event handler refs (mutable without re-creating worker)
  const onAudioProcessedRef = useRef<((chunk: ProcessedAudioChunk) => void) | undefined>(undefined);
  const onErrorRef = useRef<((error: string) => void) | undefined>(undefined);

  // Initialize worker
  useEffect(() => {
    // Create worker
    const worker = new Worker('/audio-processing-worker.js');
    workerRef.current = worker;

    // Handle messages from worker
    worker.onmessage = (e) => {
      const { type, data } = e.data;

      switch (type) {
        case 'ready':
          setIsReady(true);
          console.log('[AudioWorker] Worker ready with config:', data.config);
          break;

        case 'audio_processed':
          setIsProcessing(false);
          onAudioProcessedRef.current?.(data as ProcessedAudioChunk);
          break;

        case 'error':
          setIsProcessing(false);
          onErrorRef.current?.(data.error);
          console.error('[AudioWorker] Error:', data.error);
          break;

        case 'state':
          if (data.isProcessing !== undefined) {
            setIsProcessing(data.isProcessing);
          }
          break;
      }
    };

    worker.onerror = (error) => {
      console.error('[AudioWorker] Worker error:', error);
      onErrorRef.current?.('Worker error: ' + error.message);
    };

    // Initialize worker with config
    worker.postMessage({
      type: 'init',
      data: config || {},
    });

    // Cleanup
    return () => {
      worker.terminate();
      workerRef.current = null;
      setIsReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Process audio (non-blocking)
  const processAudio = useCallback(
    (audioData: Float32Array) => {
      if (!workerRef.current || !isReady) {
        console.warn('[AudioWorker] Worker not ready');
        return;
      }

      setIsProcessing(true);

      // Transfer audio data to worker (zero-copy)
      workerRef.current.postMessage(
        {
          type: 'process_audio',
          data: { audioData: audioData.buffer },
        },
        [audioData.buffer]
      );
    },
    [isReady]
  );

  // Stop worker processing
  const stop = useCallback(() => {
    if (!workerRef.current || !isReady) {
      return;
    }

    workerRef.current.postMessage({
      type: 'stop',
    });
  }, [isReady]);

  // Create object with mutable event handlers
  const api = {
    isReady,
    isProcessing,
    processAudio,
    stop,
    onAudioProcessed: undefined as ((chunk: ProcessedAudioChunk) => void) | undefined,
    onError: undefined as ((error: string) => void) | undefined,
  };

  // Sync refs with object properties
  useEffect(() => {
    onAudioProcessedRef.current = api.onAudioProcessed;
    onErrorRef.current = api.onError;
  });

  return api;
}
