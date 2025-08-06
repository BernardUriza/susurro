/**
 * useAudioEngine Hook
 * Manages audio engine initialization and lifecycle
 * Extracted from the monolithic useSusurro hook for better separation of concerns
 */

import { useState, useCallback } from 'react';
import { AUDIO_CONFIG, ERROR_MESSAGES } from '../lib/audio-constants';
import { logAudioError, getErrorMessage } from '../lib/error-utils';

interface UseAudioEngineReturn {
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  reset: () => Promise<void>;
}

export function useAudioEngine(): UseAudioEngineReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) {
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      // The useMurmubaraEngine hook handles initialization internally
      // We just mark it as initialized for our state tracking
      setIsInitialized(true);
      setError(null);

      if (process.env.NODE_ENV === 'development') {
        console.log('[useAudioEngine] Audio engine initialized');
      }
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      setIsInitialized(false);
      logAudioError(err, 'audio-engine-init');
      throw new Error(ERROR_MESSAGES.ENGINE_INIT_FAILED);
    } finally {
      setIsInitializing(false);
    }
  }, [isInitialized, isInitializing]);

  const reset = useCallback(async () => {
    setIsInitialized(false);
    setIsInitializing(false);
    setError(null);

    // Optionally reinitialize after a short delay
    setTimeout(async () => {
      try {
        await initialize();
      } catch (err) {
        logAudioError(err, 'audio-engine-reset');
      }
    }, AUDIO_CONFIG.TIMEOUTS.ENGINE_RESET_DELAY_MS);
  }, [initialize]);

  return {
    isInitialized,
    isInitializing,
    error,
    initialize,
    reset,
  };
}
