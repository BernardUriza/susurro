// RNNoise Web Worker - Handles audio processing in separate thread
// 2025 best practices: Zero-copy transfers, robust error handling, proper WASM loading

import { RNNoiseEngine } from '../engines/rnnoise-engine';

interface WorkerMessage {
  type: 'init' | 'process' | 'destroy';
  id?: string;
  data?: {
    buffer: Float32Array;
    sampleRate: number;
  };
}

interface WorkerResponse {
  type: 'initialized' | 'processed' | 'error' | 'destroyed';
  id?: string;
  success?: boolean;
  error?: string;
  data?: {
    buffer: Float32Array;
  };
}

class RNNoiseWorker {
  private engine: RNNoiseEngine | null = null;
  private isInitialized = false;
  private isInitializing = false;

  constructor() {
    console.log('[RNNoiseWorker] Worker started');
    self.addEventListener('message', this.handleMessage.bind(this));
  }

  private async handleMessage(event: MessageEvent<WorkerMessage>): Promise<void> {
    const { type, id, data } = event.data;

    try {
      switch (type) {
        case 'init':
          await this.initialize();
          break;
        case 'process':
          if (id && data) {
            await this.processAudio(id, data.buffer, data.sampleRate);
          }
          break;
        case 'destroy':
          await this.destroy();
          break;
        default:
          this.postError('unknown-message', `Unknown message type: ${type}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.postError(id || 'unknown', errorMessage);
    }
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) {
      this.postMessage({
        type: 'initialized',
        success: this.isInitialized,
        error: this.isInitializing ? 'Already initializing' : undefined
      });
      return;
    }

    this.isInitializing = true;

    try {
      console.log('[RNNoiseWorker] Initializing RNNoise engine...');
      
      this.engine = new RNNoiseEngine({
        wasmPath: '/wasm/rnnoise.wasm',
        scriptPath: '' // Not needed for direct WASM usage
      });

      await this.engine.initialize();
      this.isInitialized = true;
      this.isInitializing = false;

      console.log('[RNNoiseWorker] Engine initialized successfully');
      
      this.postMessage({
        type: 'initialized',
        success: true
      });
    } catch (error) {
      this.isInitializing = false;
      const errorMessage = error instanceof Error ? error.message : 'Engine initialization failed';
      console.error('[RNNoiseWorker] Initialization failed:', errorMessage);
      
      this.postMessage({
        type: 'initialized',
        success: false,
        error: errorMessage
      });
    }
  }

  private async processAudio(id: string, buffer: Float32Array, sampleRate: number): Promise<void> {
    if (!this.isInitialized || !this.engine) {
      this.postError(id, 'Worker not initialized');
      return;
    }

    try {
      // Process the audio buffer (RNNoiseEngine.process is synchronous)
      const processedBuffer = this.engine.process(buffer);
      
      // Transfer the processed buffer back to main thread
      this.postMessage({
        type: 'processed',
        id,
        data: {
          buffer: processedBuffer
        }
      }, [processedBuffer.buffer]); // Transfer ownership for zero-copy
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      console.error('[RNNoiseWorker] Processing failed:', errorMessage);
      this.postError(id, errorMessage);
    }
  }

  private async destroy(): Promise<void> {
    console.log('[RNNoiseWorker] Destroying worker...');
    
    try {
      if (this.engine) {
        this.engine.cleanup();
        this.engine = null;
      }
      
      this.isInitialized = false;
      this.isInitializing = false;
      
      this.postMessage({
        type: 'destroyed'
      });
      
      console.log('[RNNoiseWorker] Worker destroyed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Destroy failed';
      console.error('[RNNoiseWorker] Destroy failed:', errorMessage);
      this.postError('destroy', errorMessage);
    }
  }

  private postMessage(message: WorkerResponse, transfer?: Transferable[]): void {
    if (transfer && transfer.length > 0) {
      // Use the Worker-specific postMessage with transfer list
      (self as any).postMessage(message, transfer);
    } else {
      self.postMessage(message);
    }
  }

  private postError(id: string, error: string): void {
    this.postMessage({
      type: 'error',
      id,
      error
    });
  }
}

// Initialize worker
new RNNoiseWorker();