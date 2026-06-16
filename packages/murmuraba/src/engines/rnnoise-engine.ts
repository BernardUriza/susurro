import { AudioEngine } from './types';

export interface RNNoiseConfig {
  wasmPath?: string;
  scriptPath?: string;
}

export class RNNoiseEngine implements AudioEngine {
  name = 'RNNoise';
  description = 'Neural network-based noise suppression';
  isInitialized = false;
  
  private module: any = null;
  private state: any = null;
  private inputPtr: number = 0;
  private outputPtr: number = 0;
  private lastVad: number = 0;
  private config: RNNoiseConfig;
  
  constructor(config?: RNNoiseConfig) {
    this.config = {
      wasmPath: config?.wasmPath || '',
      scriptPath: config?.scriptPath || ''
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('[RNNoiseEngine] Starting initialization...');
    
    // Check WebAssembly support first
    if (typeof WebAssembly === 'undefined') {
      throw new Error('WebAssembly is not supported in this environment');
    }
    
    const errors: string[] = [];
    
    try {
      // Use the bundled RNNoise loader
      const { loadRNNoiseModule } = await import('../utils/rnnoise-loader');
      this.module = await loadRNNoiseModule();
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('[RNNoiseEngine] Failed to load RNNoise:', errorMsg);
      throw new Error(`Failed to initialize RNNoise: ${errorMsg}`);
    }
    
    // Create state if not already created
    if (!this.state) {
      this.state = this.module._rnnoise_create(0);
      if (!this.state) {
        throw new Error('Failed to create RNNoise state');
      }
    }
    
    // Allocate memory for float32 samples
    this.inputPtr = this.module._malloc(480 * 4);
    this.outputPtr = this.module._malloc(480 * 4);
    
    // Warm up
    const silentFrame = new Float32Array(480);
    for (let i = 0; i < 10; i++) {
      this.module.HEAPF32.set(silentFrame, this.inputPtr >> 2);
      this.module._rnnoise_process_frame(this.state, this.outputPtr, this.inputPtr);
    }
    
    this.isInitialized = true;
    console.log('[RNNoiseEngine] Initialization complete!');
  }
  
  process(inputBuffer: Float32Array): Float32Array {
    if (!this.isInitialized) {
      throw new Error('RNNoiseEngine not initialized');
    }
    
    if (inputBuffer.length !== 480) {
      throw new Error('RNNoise requires exactly 480 samples per frame');
    }
    
    // Copy to WASM heap
    this.module.HEAPF32.set(inputBuffer, this.inputPtr >> 2);
    
    // Process with RNNoise and capture VAD
    const vad = this.module._rnnoise_process_frame(
      this.state, 
      this.outputPtr, 
      this.inputPtr
    );
    
    // Get output
    const outputData = new Float32Array(480);
    for (let i = 0; i < 480; i++) {
      outputData[i] = this.module.HEAPF32[(this.outputPtr >> 2) + i];
    }
    
    // Store VAD for later use if needed
    this.lastVad = vad || 0;
    
    // Return audio data only
    return outputData;
  }
  
  cleanup(): void {
    if (this.module && this.state) {
      this.module._free(this.inputPtr);
      this.module._free(this.outputPtr);
      this.module._rnnoise_destroy(this.state);
      this.state = null;
      this.module = null;
      this.isInitialized = false;
    }
  }
}