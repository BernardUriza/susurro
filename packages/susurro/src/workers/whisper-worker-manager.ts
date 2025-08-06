/**
 * WhisperWorkerManager
 * Manages communication with Whisper Web Worker
 * Provides clean API for main thread components
 */

import type { WhisperProgress } from '../lib/whisper-types';

export interface TranscriptionResult {
  text: string;
  chunks?: Array<{
    text: string;
    timestamp: [number, number];
  }>;
}

export interface WorkerStatus {
  loaded: boolean;
  loading: boolean;
}

export type LogCallback = (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
export type ProgressCallback = (progress: number, message: string) => void;

export class WhisperWorkerManager {
  private worker: Worker | null = null;
  private messageQueue = new Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timeout: NodeJS.Timeout;
  }>();
  
  private logCallback: LogCallback | null = null;
  private progressCallback: ProgressCallback | null = null;
  private isInitialized = false;
  
  // Singleton pattern for global instance
  private static instance: WhisperWorkerManager | null = null;
  
  static getInstance(): WhisperWorkerManager {
    if (!WhisperWorkerManager.instance) {
      WhisperWorkerManager.instance = new WhisperWorkerManager();
    }
    return WhisperWorkerManager.instance;
  }
  
  private constructor() {
    // Private constructor for singleton
  }
  
  /**
   * Set callback for WhisperEchoLog updates
   */
  setLogCallback(callback: LogCallback): void {
    this.logCallback = callback;
  }
  
  /**
   * Set callback for progress updates
   */
  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }
  
  /**
   * Initialize the worker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logCallback?.('⚠️ Worker ya inicializado', 'warning');
      return;
    }
    
    try {
      this.logCallback?.('🏗️ Creando Web Worker para Whisper...', 'info');
      
      // Create worker with module type
      this.worker = new Worker(
        new URL('./whisper.worker.ts', import.meta.url),
        { 
          type: 'module',
          name: 'whisper-worker'
        }
      );
      
      // Setup message handler
      this.worker.onmessage = this.handleMessage.bind(this);
      
      // Setup error handler
      this.worker.onerror = (error) => {
        console.error('[WhisperWorkerManager] Worker error:', error);
        this.logCallback?.(`❌ Error en Worker: ${error.message}`, 'error');
      };
      
      // Send init message
      await this.sendMessage('INIT', {});
      
      this.isInitialized = true;
      this.logCallback?.('✅ Web Worker inicializado correctamente', 'success');
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      this.logCallback?.(`❌ Error al crear Worker: ${errorMsg}`, 'error');
      throw error;
    }
  }
  
  /**
   * Load the Whisper model in the worker
   */
  async loadModel(modelPath: string = 'Xenova/whisper-tiny'): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    this.logCallback?.('📦 Solicitando carga de modelo en Worker...', 'info');
    
    try {
      await this.sendMessage('LOAD_MODEL', { modelPath });
      this.logCallback?.('✅ Modelo cargado exitosamente en Worker', 'success');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      this.logCallback?.(`❌ Error al cargar modelo: ${errorMsg}`, 'error');
      throw error;
    }
  }
  
  /**
   * Transcribe audio data
   */
  async transcribe(audioData: Float32Array, language: string = 'es'): Promise<TranscriptionResult> {
    if (!this.isInitialized) {
      throw new Error('Worker not initialized');
    }
    
    // Check if model is loaded
    const status = await this.getStatus();
    if (!status.loaded) {
      throw new Error('Model not loaded');
    }
    
    return await this.sendMessage<TranscriptionResult>('TRANSCRIBE', {
      audioData,
      language
    });
  }
  
  /**
   * Get worker status
   */
  async getStatus(): Promise<WorkerStatus> {
    if (!this.isInitialized) {
      return { loaded: false, loading: false };
    }
    
    return await this.sendMessage<WorkerStatus>('GET_STATUS', {});
  }
  
  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.logCallback?.('🛑 Terminando Web Worker...', 'info');
      
      // Clear all pending messages
      this.messageQueue.forEach(({ reject, timeout }) => {
        clearTimeout(timeout);
        reject(new Error('Worker terminated'));
      });
      this.messageQueue.clear();
      
      // Terminate worker
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      
      this.logCallback?.('✅ Web Worker terminado', 'success');
    }
  }
  
  /**
   * Send message to worker and wait for response
   */
  private async sendMessage<T = any>(type: string, payload: any): Promise<T> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }
    
    const id = crypto.randomUUID();
    
    return new Promise((resolve, reject) => {
      // Set timeout for response (30 seconds for model loading, 10 for others)
      const timeoutMs = type === 'LOAD_MODEL' ? 30000 : 10000;
      
      const timeout = setTimeout(() => {
        this.messageQueue.delete(id);
        reject(new Error(`Worker timeout for ${type}`));
      }, timeoutMs);
      
      // Store in queue
      this.messageQueue.set(id, { resolve, reject, timeout });
      
      // Send message
      this.worker!.postMessage({ id, type, payload });
    });
  }
  
  /**
   * Handle messages from worker
   */
  private handleMessage(event: MessageEvent): void {
    const { id, type, payload, error, logMessage, logType, progress } = event.data;
    
    // Handle log messages for WhisperEchoLog
    if (type === 'LOG' && logMessage) {
      this.logCallback?.(logMessage, logType || 'info');
      return;
    }
    
    // Handle progress updates
    if (type === 'PROGRESS' && typeof progress === 'number') {
      this.progressCallback?.(progress, logMessage || '');
      if (logMessage) {
        this.logCallback?.(logMessage, 'info');
      }
      return;
    }
    
    // Handle response messages
    const pending = this.messageQueue.get(id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.messageQueue.delete(id);
      
      if (type === 'ERROR') {
        pending.reject(new Error(error || 'Unknown error'));
      } else {
        pending.resolve(payload);
      }
    }
  }
  
  /**
   * Check if workers are supported
   */
  static isSupported(): boolean {
    return typeof Worker !== 'undefined';
  }
}

// Export singleton instance getter
export const getWhisperWorker = () => WhisperWorkerManager.getInstance();