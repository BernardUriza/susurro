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
  transcribe: (audioData: Float32Array) => Promise<any>;
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
        
        // Handle response to specific message
        if (id !== undefined && pendingMessages.current.has(id)) {
          const { resolve, reject } = pendingMessages.current.get(id);
          
          if (status === 'error') {
            reject(new Error(data.error));
            onLog?.(`❌ Error: ${data.error}`, 'error');
          } else if (status === 'loaded') {
            setReady(true);
            setLoading(false);
            setCurrentModel(data.model);
            setProgress(100);
            onLog?.(`✅ Modelo ${data.model} cargado`, 'success');
            resolve(data);
          } else if (status === 'progress') {
            const percent = Math.round(data.progress || 0);
            setProgress(percent);
            
            // Log only significant progress updates
            if (percent % 10 === 0 || percent === 100) {
              onLog?.(`📥 ${data.file}: ${percent}%`, 'info');
            }
          } else if (status === 'complete') {
            resolve(data.result);
          }
          
          if (status === 'loaded' || status === 'complete' || status === 'error') {
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
  const sendMessage = useCallback((type: string, data?: any): Promise<any> => {
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
    if (loading) return;
    if (ready && currentModel === modelId) {
      onLog?.(`⚠️ Modelo ${modelId} ya cargado`, 'warning');
      return;
    }

    setLoading(true);
    setProgress(0);
    onLog?.(`🚀 Cargando modelo ${modelId}...`, 'info');
    
    sendMessage('load', { model: modelId }).catch(error => {
      setLoading(false);
      onLog?.(`❌ Error: ${error.message}`, 'error');
    });
  }, [loading, ready, currentModel, initialModel, sendMessage, onLog]);

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad && !ready && !loading && !currentModel) {
      loadModel(initialModel);
    }
  }, [autoLoad, ready, loading, currentModel, initialModel, loadModel]);

  // Transcribe audio
  const transcribe = useCallback(async (audioData: Float32Array): Promise<any> => {
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