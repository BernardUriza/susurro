/**
 * useWhisperHybrid Hook
 * Temporary hook that allows switching between worker and legacy implementation
 * Will be removed after full migration
 */

import { useWhisperWorker } from './use-whisper-worker';
import { useWhisperDirect } from './use-whisper-direct';

export interface UseWhisperHybridOptions {
  useWorker?: boolean; // Flag to enable worker mode
  autoLoad?: boolean;
  model?: string;
  language?: string;
  onProgressLog?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onProgress?: (progress: number) => void;
}

/**
 * Hybrid hook that can use either Worker or Direct implementation
 * Defaults to Worker if supported, falls back to Direct
 */
export function useWhisperHybrid(options: UseWhisperHybridOptions = {}) {
  const {
    useWorker = typeof Worker !== 'undefined', // Auto-detect worker support
    ...restOptions
  } = options;
  
  // Log which implementation is being used
  if (restOptions.onProgressLog) {
    const implementation = useWorker ? 'Web Worker' : 'Main Thread (Legacy)';
    restOptions.onProgressLog(
      `🔧 Usando implementación: ${implementation}`,
      'info'
    );
  }
  
  // Use worker implementation if enabled and supported
  if (useWorker) {
    return useWhisperWorker(restOptions);
  }
  
  // Fall back to legacy implementation
  // Note: This will be removed after migration
  const directResult = useWhisperDirect({
    language: restOptions.language || 'es',
    model: restOptions.model,
    onProgressLog: restOptions.onProgressLog
  });
  
  // Map to consistent API
  return {
    isReady: directResult.modelReady,
    isLoading: directResult.loadingProgress > 0 && directResult.loadingProgress < 100,
    error: directResult.error,
    progress: directResult.loadingProgress,
    loadModel: async () => {
      // Legacy implementation auto-loads
      if (!directResult.modelReady) {
        throw new Error('Model loading in progress');
      }
    },
    transcribe: directResult.transcribeAudio,
    
    // Compatibility
    whisperReady: directResult.modelReady,
    whisperProgress: directResult.loadingProgress,
    whisperError: directResult.error
  };
}