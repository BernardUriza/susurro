/**
 * useTranscriptionWorker - Web Worker hook for non-blocking transcription
 * Prevents UI freezing during heavy chunk processing
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface TranscriptionWorkerConfig {
  claudeConfig?: {
    enabled: boolean;
    apiUrl: string;
  };
}

export interface TranscriptionChunk {
  text: string;
  source: 'web-speech' | 'deepgram';
  timestamp: number;
}

export interface TranscriptionWorkerState {
  isReady: boolean;
  isProcessing: boolean;
  queueLength: number;
}

export interface UseTranscriptionWorkerReturn {
  // State
  isReady: boolean;
  isProcessing: boolean;

  // Actions
  processChunk: (chunk: TranscriptionChunk) => void;
  refineText: (webSpeechText: string, deepgramText: string) => void;
  reset: () => void;

  // Event handlers (set these)
  onChunkProcessed?: (chunk: TranscriptionChunk) => void;
  onTextRefined?: (refinedText: string, webSpeechText: string, deepgramText: string) => void;
  onError?: (error: string) => void;
}

export function useTranscriptionWorker(
  config?: TranscriptionWorkerConfig
): UseTranscriptionWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Event handler refs (mutable without re-creating worker)
  const onChunkProcessedRef = useRef<((chunk: TranscriptionChunk) => void) | undefined>(undefined);
  const onTextRefinedRef = useRef<((refinedText: string, webSpeechText: string, deepgramText: string) => void) | undefined>(undefined);
  const onErrorRef = useRef<((error: string) => void) | undefined>(undefined);

  // Initialize worker
  useEffect(() => {
    // Create worker
    const worker = new Worker('/transcription-worker.js');
    workerRef.current = worker;

    // Handle messages from worker
    worker.onmessage = (e) => {
      const { type, data } = e.data;

      switch (type) {
        case 'ready':
          setIsReady(true);
          console.log('[TranscriptionWorker] Worker ready');
          break;

        case 'chunk_processed':
          onChunkProcessedRef.current?.(data.chunk);
          break;

        case 'text_refined':
          setIsProcessing(false);
          onTextRefinedRef.current?.(
            data.refinedText,
            data.webSpeechText || '',
            data.deepgramText || ''
          );
          break;

        case 'error':
          setIsProcessing(false);
          onErrorRef.current?.(data.error);
          console.error('[TranscriptionWorker] Error:', data.error);
          break;

        case 'state':
          if (data.isProcessing !== undefined) {
            setIsProcessing(data.isProcessing);
          }
          break;
      }
    };

    worker.onerror = (error) => {
      console.error('[TranscriptionWorker] Worker error:', error);
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
  }, [config?.claudeConfig?.enabled, config?.claudeConfig?.apiUrl]);

  // Process chunk (non-blocking)
  const processChunk = useCallback((chunk: TranscriptionChunk) => {
    if (!workerRef.current || !isReady) {
      console.warn('[TranscriptionWorker] Worker not ready');
      return;
    }

    workerRef.current.postMessage({
      type: 'process_chunk',
      data: chunk,
    });
  }, [isReady]);

  // Refine text with Claude (heavy operation in worker)
  const refineText = useCallback((webSpeechText: string, deepgramText: string) => {
    if (!workerRef.current || !isReady) {
      console.warn('[TranscriptionWorker] Worker not ready');
      return;
    }

    setIsProcessing(true);

    workerRef.current.postMessage({
      type: 'refine_text',
      data: { webSpeechText, deepgramText },
    });
  }, [isReady]);

  // Reset worker state
  const reset = useCallback(() => {
    if (!workerRef.current || !isReady) {
      return;
    }

    workerRef.current.postMessage({
      type: 'reset',
    });
  }, [isReady]);

  // Create object with mutable event handlers
  const api = {
    isReady,
    isProcessing,
    processChunk,
    refineText,
    reset,
    onChunkProcessed: undefined as ((chunk: TranscriptionChunk) => void) | undefined,
    onTextRefined: undefined as ((refinedText: string, webSpeechText: string, deepgramText: string) => void) | undefined,
    onError: undefined as ((error: string) => void) | undefined,
  };

  // Sync refs with object properties
  useEffect(() => {
    onChunkProcessedRef.current = api.onChunkProcessed;
    onTextRefinedRef.current = api.onTextRefined;
    onErrorRef.current = api.onError;
  });

  return api;
}
