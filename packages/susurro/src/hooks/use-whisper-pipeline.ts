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
        console.log('[HOOK] Received from worker:', { id, status, data });
        
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
          
          // Log ALL progress events - users need to see download progress
          // Special handling for cache verification
          if (fileName === 'Verificando caché del modelo' && percent === 0) {
            onLog?.(`🔍 Verificando caché local...`, 'info');
          } else if (fileName.includes('cargado desde caché')) {
            onLog?.(`⚡ ${fileName}`, 'success');
          } else if (percent > 0) {
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
            
            // Show different message if loaded from cache
            if (data.fromCache) {
              onLog?.(`⚡ Modelo ${data.model} cargado desde caché (instantáneo)`, 'success');
            } else {
              onLog?.(`✅ Modelo ${data.model} descargado y cargado completamente`, 'success');
            }
            
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

  // Store progress ref for access in sendMessage
  const progressRef = useRef(0);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // Send message to worker
  const sendMessage = useCallback((type: string, data?: unknown, progressCallback?: (msg: string) => void): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      if (!worker.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = messageId.current++;
      pendingMessages.current.set(id, { resolve, reject });
      worker.current.postMessage({ id, type, data });
      
      // Progress check every 5 seconds
      let progressCheckCount = 0;
      const progressInterval = setInterval(() => {
        progressCheckCount++;
        if (!pendingMessages.current.has(id)) {
          // Request completed, clear interval
          clearInterval(progressInterval);
        } else if (progressCheckCount < 24) { // 24 * 5s = 120s total
          // Still waiting, send status update with current progress
          if (progressCallback && progressCheckCount % 2 === 0) { // Every 10 seconds
            const currentProgress = progressRef.current;
            const elapsedTime = progressCheckCount * 5;
            
            if (currentProgress > 0) {
              // Estimate remaining time based on progress
              const estimatedTotal = (elapsedTime / currentProgress) * 100;
              const estimatedRemaining = Math.round(estimatedTotal - elapsedTime);
              
              if (estimatedRemaining > 0) {
                progressCallback(`⏳ Descargando modelo... ${currentProgress}% (~${estimatedRemaining}s restantes)`);
              } else {
                progressCallback(`⏳ Descargando modelo... ${currentProgress}% (${elapsedTime}s)`);
              }
            } else {
              progressCallback(`⏳ Conectando... (${elapsedTime}s)`);
            }
          }
        } else {
          // Timeout after 2 minutes
          clearInterval(progressInterval);
          if (pendingMessages.current.has(id)) {
            pendingMessages.current.delete(id);
            if (progressCallback) {
              progressCallback(`❌ Timeout: El modelo tardó demasiado en cargar`);
            }
            reject(new Error('Worker timeout after 2 minutes'));
          }
        }
      }, 5000);
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
    onLog?.(`🔍 Verificando modelo Whisper ${modelId.toUpperCase()}...`, 'info');
    onLog?.(`📊 Buscando en caché local o descargando desde Hugging Face CDN`, 'info');
    
    sendMessage('load', { model: modelId }, (msg) => {
      onLog?.(msg, 'info');
    }).catch(error => {
      setLoading(false);
      setProgress(0);
      onLog?.(`❌ Error al cargar modelo: ${error.message}`, 'error');
    });
  }, [loading, ready, currentModel, initialModel, sendMessage, onLog]);

  // Model mapping - sync with worker
  const models = {
    'tiny': 'Xenova/whisper-tiny',
    'base': 'Xenova/whisper-base', 
    'small': 'Xenova/whisper-small',
    'medium': 'Xenova/whisper-medium'
  };

  // Auto-load on mount if enabled, or when initialModel changes
  useEffect(() => {
    if (autoLoad && !loading) {
      const expectedModel = models[initialModel];
      // Load if no model is loaded yet, OR if a different model is requested
      if (!currentModel || currentModel !== expectedModel) {
        loadModel(initialModel);
      }
    }
  }, [autoLoad, loading, currentModel, initialModel, loadModel, models]);

  // Transcribe audio
  const transcribe = useCallback(async (audioData: Float32Array): Promise<{ text?: string; segments?: unknown[] } | null> => {
    if (!ready) {
      throw new Error('Model not ready');
    }

    onLog?.('🎙️ Transcribiendo...', 'info');
    const result = await sendMessage('transcribe', { audio: audioData, language }) as { text?: string; segments?: unknown[] } | null;
    
    if (result && 'text' in result && result.text) {
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