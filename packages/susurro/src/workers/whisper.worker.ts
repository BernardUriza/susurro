/**
 * Whisper Web Worker
 * Handles model loading and transcription in a separate thread
 * Communicates progress to main thread via WhisperEchoLog
 */

import type { Pipeline } from '@xenova/transformers';

// Worker state
let pipeline: Pipeline | null = null;
let isLoading = false;

// Message types
interface WorkerMessage {
  id: string;
  type: 'INIT' | 'LOAD_MODEL' | 'TRANSCRIBE' | 'GET_STATUS';
  payload?: any;
}

interface WorkerResponse {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'PROGRESS' | 'LOG';
  payload?: any;
  error?: string;
  progress?: number;
  logMessage?: string;
  logType?: 'info' | 'success' | 'warning' | 'error';
}

// Send log message to WhisperEchoLog
function sendLog(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  self.postMessage({
    type: 'LOG',
    logMessage: message,
    logType: type,
    id: 'log-' + Date.now()
  } as WorkerResponse);
}

// Send progress update
function sendProgress(progress: number, message: string) {
  self.postMessage({
    type: 'PROGRESS',
    progress,
    logMessage: message,
    logType: 'info',
    id: 'progress-' + Date.now()
  } as WorkerResponse);
}

// Load model with progress tracking
async function loadModel(modelPath: string): Promise<void> {
  if (isLoading) {
    sendLog('⚠️ Modelo ya está cargando...', 'warning');
    return;
  }

  if (pipeline) {
    sendLog('✅ Modelo ya cargado y listo', 'success');
    return;
  }

  isLoading = true;
  sendLog('🚀 [Worker] Iniciando carga del modelo en thread separado...', 'info');

  try {
    // Dynamic import to avoid loading in main thread
    const { pipeline: createPipeline, env } = await import('@xenova/transformers');
    
    sendProgress(10, '📦 [Worker] Transformers.js cargado');
    
    // Configure for local models
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.remoteURL = '/models/';
    env.localURL = '/models/';
    
    // Use WASM backend for better compatibility
    env.backends = {
      onnx: {
        wasm: {
          wasmPaths: '/wasm/',
          numThreads: 2 // Use 2 threads in worker
        }
      }
    };
    
    sendProgress(20, '⚙️ [Worker] Configuración completa');
    
    // Create pipeline with progress callback
    pipeline = await createPipeline(
      'automatic-speech-recognition',
      modelPath,
      {
        quantized: false,
        device: 'wasm',
        local_files_only: true,
        progress_callback: (progress: any) => {
          if (progress.status && progress.file) {
            const percent = Math.round(progress.progress || 0);
            const fileName = progress.file.split('/').pop();
            sendProgress(
              20 + (percent * 0.7), // Scale to 20-90%
              `📥 [Worker] Cargando ${fileName}... ${percent}%`
            );
          }
        }
      }
    );
    
    sendProgress(90, '🔄 [Worker] Finalizando inicialización...');
    
    // Test the pipeline
    const testAudio = new Float32Array(16000); // 1 second of silence
    await pipeline(testAudio);
    
    sendProgress(100, '✅ [Worker] Modelo cargado y verificado');
    sendLog('🎤 [Worker] Sistema listo para transcripción', 'success');
    
    isLoading = false;
  } catch (error) {
    isLoading = false;
    pipeline = null;
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    sendLog(`❌ [Worker] Error al cargar modelo: ${errorMsg}`, 'error');
    throw error;
  }
}

// Transcribe audio
async function transcribe(audioData: Float32Array, language?: string): Promise<any> {
  if (!pipeline) {
    throw new Error('Model not loaded');
  }
  
  sendLog('🎙️ [Worker] Iniciando transcripción...', 'info');
  
  try {
    const result = await pipeline(audioData, {
      language: language || 'es',
      task: 'transcribe',
      chunk_length_s: 30,
      return_timestamps: true
    });
    
    sendLog('✅ [Worker] Transcripción completada', 'success');
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    sendLog(`❌ [Worker] Error en transcripción: ${errorMsg}`, 'error');
    throw error;
  }
}

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;
  
  try {
    switch (type) {
      case 'INIT':
        sendLog('👷 [Worker] Worker inicializado correctamente', 'success');
        self.postMessage({
          id,
          type: 'SUCCESS',
          payload: { ready: true }
        } as WorkerResponse);
        break;
        
      case 'LOAD_MODEL':
        await loadModel(payload.modelPath || 'Xenova/whisper-tiny');
        self.postMessage({
          id,
          type: 'SUCCESS',
          payload: { loaded: true }
        } as WorkerResponse);
        break;
        
      case 'TRANSCRIBE':
        const result = await transcribe(payload.audioData, payload.language);
        self.postMessage({
          id,
          type: 'SUCCESS',
          payload: result
        } as WorkerResponse);
        break;
        
      case 'GET_STATUS':
        self.postMessage({
          id,
          type: 'SUCCESS',
          payload: {
            loaded: !!pipeline,
            loading: isLoading
          }
        } as WorkerResponse);
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      id,
      type: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as WorkerResponse);
  }
};

// Log worker start
sendLog('🏗️ [Worker] Whisper Worker creado y esperando comandos', 'info');