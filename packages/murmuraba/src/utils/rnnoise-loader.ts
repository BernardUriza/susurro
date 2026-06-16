// Removed wasm-loader import - using direct implementation
import { WASMLogger } from './logger';
import { ErrorFactory, ErrorType } from './error-handler';

export interface RNNoiseModule {
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  _rnnoise_create: (model: number) => number;
  _rnnoise_destroy: (state: number) => void;
  _rnnoise_process_frame: (state: number, output: number, input: number) => number;
  HEAPU8: Uint8Array;
  HEAPF32: Float32Array;
}

let modulePromise: Promise<RNNoiseModule> | null = null;
// Direct WASM loading implementation

export async function loadRNNoiseModule({
  fallbackImplementation,
  retryCount = 2
}: {
  fallbackImplementation?: () => Promise<RNNoiseModule>,
  retryCount?: number
} = {}): Promise<RNNoiseModule> {
  if (!modulePromise) {
    modulePromise = loadWASMOptimized(retryCount);
  }

  try {
    return await modulePromise;
  } catch (error) {
    WASMLogger.error('Primary WASM load failed', error);
    
    if (fallbackImplementation) {
      WASMLogger.warn('Attempting fallback implementation');
      return fallbackImplementation();
    }
    
    throw ErrorFactory.wrapError(error as Error, ErrorType.WASM_MODULE, 'Failed to load RNNoise module');
  }
}

// Modified to support retry mechanism
async function loadWASMOptimized(retriesLeft = 2): Promise<RNNoiseModule> {
  try {
    // Import only the async function to avoid bundling the 1.9MB sync version
    const { createRNNWasmModule } = await import('@jitsi/rnnoise-wasm') as any;
    
    const module = await createRNNWasmModule({
      locateFile: (filename: string) => {
        if (filename.endsWith('.wasm')) {
          const wasmPath = getOptimizedWASMPath(filename);
          WASMLogger.debug('Loading WASM from path', { wasmPath });
          return wasmPath;
        }
        return filename;
      },
      instantiateWasm: async (imports: any, successCallback: any) => {
        try {
          const wasmPath = getOptimizedWASMPath('rnnoise.wasm');
          const response = await fetch(wasmPath);
          
          if (!response.ok) {
            throw ErrorFactory.wasmModuleLoadFailed(
              new Error(`HTTP ${response.status}`), 
              { url: wasmPath, status: response.status }
            );
          }
          
          if ('instantiateStreaming' in WebAssembly) {
            const result = await WebAssembly.instantiateStreaming(response, imports);
            successCallback(result.instance, result.module);
          } else {
            const buffer = await response.arrayBuffer();
            const result = await WebAssembly.instantiate(buffer, imports);
            successCallback(result.instance, result.module);
          }
          return {}; // Return empty object to satisfy TypeScript
        } catch (error) {
          if (retriesLeft > 0) {
            console.warn(`[RNNoise] WASM load failed, retrying... (${retriesLeft} attempts left)`);
            return loadWASMOptimized(retriesLeft - 1);
          }
          console.error('[RNNoise Loader] WASM instantiation failed:', error);
          throw error;
        }
      }
    });
    
    return module as unknown as RNNoiseModule;
  } catch (error) {
    console.error('[RNNoise] Complete WASM module load failed:', error);
    throw error;
  }
}


// Centralized WASM path resolution - SINGLE SOURCE OF TRUTH
function getOptimizedWASMPath(filename: string): string {
  if (typeof window === 'undefined') {
    return filename;
  }
  
  // ONE location for ALL environments - no duplication
  return `/wasm/${filename}`;
}

// Lazy loader for RNNoise module
export const lazyLoadRNNoise = () => loadRNNoiseModule();

// Preload WASM for better performance
// Performance tracking for WASM loading
const WASM_SIZE_THRESHOLD_KB = 200; // Adjust based on actual file size
const WASM_LOAD_TIMEOUT_MS = 5000;

export async function preloadRNNoiseWASM(options: { 
  force?: boolean, 
  timeout?: number 
} = {}): Promise<void> {
  const { force = false, timeout = WASM_LOAD_TIMEOUT_MS } = options;

  // Only preload if file is larger than threshold or force is true
  const shouldPreload = force || (await isWASMSizeLarge());

  if (shouldPreload) {
    const preloadStart = performance.now();
    try {
      // Use Promise.race to prevent indefinite loading
      await Promise.race([
        loadRNNoiseModule(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('WASM load timeout')), timeout)
        )
      ]);
      
      const loadTime = performance.now() - preloadStart;
      WASMLogger.info('WASM module preloaded', { loadTime: `${loadTime.toFixed(2)}ms` });
    } catch (error) {
      console.warn('[RNNoise] Preload failed:', error);
    }
  }
}

async function isWASMSizeLarge(): Promise<boolean> {
  try {
    const response = await fetch('/wasm/rnnoise.wasm', { method: 'HEAD' });
    const size = Number(response.headers.get('Content-Length') || 0) / 1024;
    return size > WASM_SIZE_THRESHOLD_KB;
  } catch {
    return false;
  }
}