/**
 * useWhisperPipeline Hook
 * Clean implementation based on Hugging Face's react-translator pattern
 * Manages Web Worker for Whisper transcription
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface ProgressItem {
  file: string;
  progress: number;
  loaded?: number;
  total?: number;
}

interface UseWhisperPipelineOptions {
  onLog?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  autoLoad?: boolean;
  language?: string;
}

interface UseWhisperPipelineReturn {
  // State
  ready: boolean;
  loading: boolean;
  progressItems: ProgressItem[];
  
  // Methods
  transcribe: (audioData: Float32Array) => Promise<any>;
  loadModel: () => void;
}

export function useWhisperPipeline({
  onLog,
  autoLoad = true,
  language = 'es'
}: UseWhisperPipelineOptions = {}): UseWhisperPipelineReturn {
  // State
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  
  // Refs
  const worker = useRef<Worker | null>(null);
  const messageId = useRef(0);
  const pendingMessages = useRef(new Map<number, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }>());
  
  // Track last log time and percentage for throttling
  const lastLogTime = useRef<{ [key: string]: number }>({});
  const lastLogPercent = useRef<{ [key: string]: number }>({});

  // Initialize worker
  useEffect(() => {
    // Create worker if it doesn't exist
    if (!worker.current) {
      onLog?.('🏗️ Creando Web Worker para Whisper Pipeline...', 'info');
      
      worker.current = new Worker(
        new URL('../workers/whisper-pipeline.worker.js', import.meta.url),
        { type: 'module' }
      );
    }

    // Message handler
    const onMessageReceived = (e: MessageEvent) => {
      const { id, status, ...data } = e.data;
      
      // Handle responses to specific messages
      if (id !== undefined) {
        const pending = pendingMessages.current.get(id);
        if (pending) {
          if (status === 'error') {
            pending.reject(new Error(data.error));
            onLog?.(`❌ Error: ${data.error}`, 'error');
          } else {
            pending.resolve({ status, ...data });
          }
          pendingMessages.current.delete(id);
        }
      }

      // Handle status updates
      switch (status) {
        case 'worker_ready':
          onLog?.('✅ Worker listo', 'success');
          break;

        case 'initiate':
          // Model file start load
          setLoading(true);
          setProgressItems(prev => [...prev, { 
            file: data.file, 
            progress: 0,
            loaded: data.loaded,
            total: data.total
          }]);
          onLog?.(`📦 Iniciando descarga: ${data.file}`, 'info');
          break;

        case 'progress':
          // Model file progress
          setProgressItems(prev =>
            prev.map(item => {
              if (item.file === data.file) {
                const percent = Math.round(data.progress || 0);
                const now = Date.now();
                const lastTime = lastLogTime.current[data.file] || 0;
                const lastPercent = lastLogPercent.current[data.file] || 0;
                
                // Log only if:
                // 1. 2+ seconds have passed since last log OR
                // 2. Progress increased by 10% or more OR  
                // 3. Reached 100%
                const timeDiff = now - lastTime;
                const percentDiff = percent - lastPercent;
                
                if (percent > 0 && (
                  timeDiff >= 2000 || // 2 seconds
                  percentDiff >= 10 || // 10% increment
                  percent === 100 // Completed
                )) {
                  onLog?.(`📥 ${data.file}: ${percent}%`, 'info');
                  lastLogTime.current[data.file] = now;
                  lastLogPercent.current[data.file] = percent;
                }
                
                return { 
                  ...item, 
                  progress: data.progress,
                  loaded: data.loaded,
                  total: data.total
                };
              }
              return item;
            })
          );
          break;

        case 'done':
          // Model file loaded
          setProgressItems(prev =>
            prev.filter(item => item.file !== data.file)
          );
          onLog?.(`✅ Cargado: ${data.file}`, 'success');
          break;

        case 'ready':
          // Pipeline ready
          setReady(true);
          setLoading(false);
          onLog?.('🎤 Modelo Whisper listo para transcripción', 'success');
          break;

        case 'loaded':
          // Model fully loaded
          setReady(true);
          setLoading(false);
          setProgressItems([]);
          onLog?.('✅ Modelo completamente cargado', 'success');
          break;

        case 'transcribe_start':
          onLog?.('🎙️ Iniciando transcripción...', 'info');
          break;

        case 'transcribe_complete':
          if (data.result?.text) {
            onLog?.(`✅ Transcripción: "${data.result.text}"`, 'success');
          }
          break;
      }
    };

    // Attach event listener
    worker.current.addEventListener('message', onMessageReceived);

    // Cleanup
    return () => {
      worker.current?.removeEventListener('message', onMessageReceived);
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

      // Set timeout
      setTimeout(() => {
        if (pendingMessages.current.has(id)) {
          pendingMessages.current.delete(id);
          reject(new Error(`Worker timeout for ${type}`));
        }
      }, 60000); // 60 second timeout for model loading

      worker.current.postMessage({ id, type, data });
    });
  }, []);

  // Load model
  const loadModel = useCallback(() => {
    if (loading || ready) {
      onLog?.('⚠️ Modelo ya cargado o cargando', 'warning');
      return;
    }

    setLoading(true); // Set loading immediately to prevent duplicate calls
    onLog?.('🚀 Iniciando carga del modelo Whisper...', 'info');
    sendMessage('load').catch(error => {
      onLog?.(`❌ Error al cargar modelo: ${error.message}`, 'error');
      setLoading(false);
    });
  }, [loading, ready, sendMessage, onLog]);

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad && !ready && !loading) {
      loadModel();
    }
  }, [autoLoad, ready, loading, loadModel]);

  // Transcribe audio
  const transcribe = useCallback(async (audioData: Float32Array): Promise<any> => {
    if (!ready) {
      throw new Error('Model not ready');
    }

    try {
      const response = await sendMessage('transcribe', { 
        audio: audioData,
        language 
      });
      
      if (response.status === 'transcribe_complete') {
        return response.result;
      }
      
      throw new Error('Transcription failed');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      onLog?.(`❌ Error en transcripción: ${errorMsg}`, 'error');
      throw error;
    }
  }, [ready, language, sendMessage, onLog]);

  return {
    ready,
    loading,
    progressItems,
    transcribe,
    loadModel
  };
}