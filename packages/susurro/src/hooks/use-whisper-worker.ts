/**
 * useWhisperWorker Hook
 * Modern implementation using Web Workers for non-blocking model loading
 * Replaces the legacy use-whisper-direct implementation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getWhisperWorker, type TranscriptionResult } from '../workers/whisper-worker-manager';

export interface UseWhisperWorkerOptions {
  autoLoad?: boolean;
  model?: string;
  language?: string;
  onProgressLog?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onProgress?: (progress: number) => void;
}

export interface UseWhisperWorkerReturn {
  // State
  isReady: boolean;
  isLoading: boolean;
  error: Error | null;
  progress: number;
  
  // Methods
  loadModel: () => Promise<void>;
  transcribe: (audioData: Float32Array) => Promise<TranscriptionResult>;
  
  // Compatibility with old API
  whisperReady: boolean;
  whisperProgress: number;
  whisperError: Error | null;
}

export function useWhisperWorker({
  autoLoad = true,
  model = 'Xenova/whisper-tiny',
  language = 'es',
  onProgressLog,
  onProgress
}: UseWhisperWorkerOptions = {}): UseWhisperWorkerReturn {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);
  
  const workerRef = useRef(getWhisperWorker());
  const loadedRef = useRef(false);
  const loadingRef = useRef(false);
  
  // Setup callbacks
  useEffect(() => {
    const worker = workerRef.current;
    
    // Set log callback for WhisperEchoLog
    if (onProgressLog) {
      worker.setLogCallback(onProgressLog);
    }
    
    // Set progress callback
    worker.setProgressCallback((prog, message) => {
      setProgress(prog);
      onProgress?.(prog);
    });
    
    return () => {
      // Cleanup on unmount
      if (!loadedRef.current && !loadingRef.current) {
        // Only terminate if not being used
        worker.terminate();
      }
    };
  }, [onProgressLog, onProgress]);
  
  // Load model function
  const loadModel = useCallback(async () => {
    if (loadedRef.current || loadingRef.current) {
      onProgressLog?.('⚠️ Modelo ya cargado o cargando', 'warning');
      return;
    }
    
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    setProgress(0);
    
    try {
      onProgressLog?.('🚀 Iniciando carga de modelo con Web Worker...', 'info');
      
      const worker = workerRef.current;
      
      // Initialize worker if needed
      await worker.initialize();
      
      // Load model in worker
      await worker.loadModel(model);
      
      loadedRef.current = true;
      setIsReady(true);
      setProgress(100);
      
      onProgressLog?.('✅ Modelo listo para transcripción', 'success');
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load model');
      setError(error);
      onProgressLog?.(`❌ Error: ${error.message}`, 'error');
      
      // Reset refs
      loadedRef.current = false;
      
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [model, onProgressLog]);
  
  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad && !loadedRef.current && !loadingRef.current) {
      loadModel();
    }
  }, [autoLoad, loadModel]);
  
  // Transcribe function
  const transcribe = useCallback(async (audioData: Float32Array): Promise<TranscriptionResult> => {
    if (!isReady) {
      throw new Error('Model not ready');
    }
    
    try {
      onProgressLog?.('🎙️ Enviando audio al Worker para transcripción...', 'info');
      
      const result = await workerRef.current.transcribe(audioData, language);
      
      onProgressLog?.(`✅ Transcripción: "${result.text}"`, 'success');
      
      return result;
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Transcription failed');
      onProgressLog?.(`❌ Error en transcripción: ${error.message}`, 'error');
      throw error;
    }
  }, [isReady, language, onProgressLog]);
  
  return {
    // Modern API
    isReady,
    isLoading,
    error,
    progress,
    loadModel,
    transcribe,
    
    // Compatibility with old API
    whisperReady: isReady,
    whisperProgress: progress,
    whisperError: error
  };
}