/**
 * Simplified useWhisperPipeline Hook
 * Based on official Hugging Face examples
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseWhisperPipelineOptions {
  onLog?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  autoLoad?: boolean;
  language?: string;
  initialModel?: 'tiny' | 'base' | 'small' | 'medium';
}

interface UseWhisperPipelineReturn {
  ready: boolean;
  loading: boolean;
  currentModel: string | null;
  progress: number;
  transcribe: (audioData: Float32Array) => Promise<{ text?: string; segments?: unknown[] } | null>;
  loadModel: (modelId?: 'tiny' | 'base' | 'small' | 'medium') => void;
}

export function useWhisperPipeline({
  onLog,
  autoLoad = false,
  language = 'es',
  initialModel = 'tiny'
}: UseWhisperPipelineOptions = {}): UseWhisperPipelineReturn {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  const worker = useRef<Worker | null>(null);
  const messageId = useRef(0);
  const pendingMessages = useRef(new Map());

  // Initialize worker
  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(
        new URL('../workers/whisper-pipeline.worker.js', import.meta.url),
        { type: 'module' }
      );

      // Handle messages from worker
      worker.current.onmessage = (e) => {
        const { id, status, ...data } = e.data;
        
        // Log all progress events for debugging
        if (status === 'progress') {
          const percent = Math.round(data.progress || 0);
          setProgress(percent);
          
          // Show file being downloaded and progress
          const fileName = data.file?.split('/').pop() || data.file || 'archivo';
          
          // Format file size if available
          let sizeInfo = '';
          if (data.loaded && data.total) {
            const loadedMB = (data.loaded / 1024 / 1024).toFixed(1);
            const totalMB = (data.total / 1024 / 1024).toFixed(1);
            sizeInfo = ` (${loadedMB}/${totalMB} MB)`;
          }
          
          // Only log at certain intervals to avoid spam
          if (percent === 0 || percent === 100 || percent % 5 === 0) {
            onLog?.(`📥 ${fileName}: ${percent}%${sizeInfo}`, 'info');
          }
        }
        
        // Handle response to specific message
        if (id !== undefined && pendingMessages.current.has(id)) {
          const { resolve, reject } = pendingMessages.current.get(id);
          
          if (status === 'error') {
            reject(new Error(data.error));
            onLog?.(`❌ Error: ${data.error}`, 'error');
            pendingMessages.current.delete(id);
          } else if (status === 'loaded') {
            setReady(true);
            setLoading(false);
            setCurrentModel(data.model);
            setProgress(100);
            onLog?.(`✅ Modelo ${data.model} cargado completamente`, 'success');
            resolve(data);
            pendingMessages.current.delete(id);
          } else if (status === 'complete') {
            resolve(data.result);
            pendingMessages.current.delete(id);
          }
        }
      };
    }

    return () => {
      if (worker.current) {
        worker.current.terminate();
        worker.current = null;
      }
    };
  }, [onLog]);

  // Send message to worker
  const sendMessage = useCallback((type: string, data?: unknown): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      if (!worker.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = messageId.current++;
      pendingMessages.current.set(id, { resolve, reject });
      worker.current.postMessage({ id, type, data });
      
      // Timeout after 2 minutes
      setTimeout(() => {
        if (pendingMessages.current.has(id)) {
          pendingMessages.current.delete(id);
          reject(new Error('Worker timeout'));
        }
      }, 120000);
    });
  }, []);

  // Load model
  const loadModel = useCallback((modelId: 'tiny' | 'base' | 'small' | 'medium' = initialModel) => {
    if (loading) {
      onLog?.(`⚠️ Ya se está cargando un modelo`, 'warning');
      return;
    }
    if (ready && currentModel === modelId) {
      onLog?.(`⚠️ Modelo ${modelId} ya cargado`, 'warning');
      return;
    }

    setLoading(true);
    setProgress(0);
    onLog?.(`🚀 Iniciando descarga del modelo Whisper ${modelId.toUpperCase()}...`, 'info');
    onLog?.(`📊 Esto puede tomar varios minutos dependiendo de tu conexión`, 'info');
    
    sendMessage('load', { model: modelId }).catch(error => {
      setLoading(false);
      setProgress(0);
      onLog?.(`❌ Error al cargar modelo: ${error.message}`, 'error');
    });
  }, [loading, ready, currentModel, initialModel, sendMessage, onLog]);

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad && !ready && !loading && !currentModel) {
      loadModel(initialModel);
    }
  }, [autoLoad, ready, loading, currentModel, initialModel, loadModel]);

  // Transcribe audio
  const transcribe = useCallback(async (audioData: Float32Array): Promise<{ text?: string; segments?: unknown[] } | null> => {
    if (!ready) {
      throw new Error('Model not ready');
    }

    onLog?.('🎙️ Transcribiendo...', 'info');
    const result = await sendMessage('transcribe', { audio: audioData, language });
    
    if (result?.text) {
      onLog?.(`✅ "${result.text}"`, 'success');
    }
    
    return result;
  }, [ready, language, sendMessage, onLog]);

  return {
    ready,
    loading,
    currentModel,
    progress,
    transcribe,
    loadModel
  };
}