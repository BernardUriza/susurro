/**
 * useAudioEngineManager Hook
 *
 * Provides React integration for the AudioEngineManager singleton.
 * This is the ONLY way components should interact with the audio engine.
 *
 * @author The Tech Lead Inquisitor
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useMurmubaraEngine } from 'murmuraba';
import { getAudioEngineManager } from '../lib/audio-engine-manager';
import type { AudioEngineManager } from '../lib/audio-engine-manager';

interface UseAudioEngineManagerReturn {
  // State
  isReady: boolean;
  isInitializing: boolean;
  isDestroying: boolean;
  hasError: boolean;
  state: string;

  // Health metrics
  healthMetrics: {
    initializationAttempts: number;
    lastErrorTimestamp?: number;
    lastSuccessfulInit?: number;
    consecutiveFailures: number;
    isHealthy: boolean;
  };

  // Actions
  initialize: () => Promise<void>;
  destroy: () => Promise<void>;
  reset: () => Promise<void>;

  // Engine access (only when ready)
  getEngine: () => any;
}

export function useAudioEngineManager(): UseAudioEngineManagerReturn {
  const managerRef = useRef<AudioEngineManager | null>(null);
  const [state, setState] = useState('uninitialized');
  const [healthMetrics, setHealthMetrics] = useState({
    initializationAttempts: 0,
    consecutiveFailures: 0,
    isHealthy: false,
  });

  // Use the actual Murmuraba hook
  const murmubaraEngine = useMurmubaraEngine({
    autoInitialize: false,
  });

  // Store engine ref to avoid re-registering on every render
  const murmubaraEngineRef = useRef(murmubaraEngine);
  murmubaraEngineRef.current = murmubaraEngine;

  // Initialize manager on first mount
  useEffect(() => {
    if (!managerRef.current) {
      managerRef.current = getAudioEngineManager({
        autoRecover: true,
        maxRetries: 3,
        retryDelayMs: 1000,
        healthCheckIntervalMs: 30000,
      });
    }

    const manager = managerRef.current;

    // Register the Murmuraba engine with the manager
    manager.registerEngine(murmubaraEngineRef.current);

    // Set initial state
    setState(manager.getState());
    setHealthMetrics(manager.getHealthMetrics());

    // Listen for state changes
    const handleEvent = (event: { type: string; data: any }) => {
      switch (event.type) {
        case 'state-change':
          setState(event.data.newState);
          break;
        case 'health-update':
          setHealthMetrics(manager.getHealthMetrics());
          break;
        case 'error':
          setHealthMetrics(manager.getHealthMetrics());
          break;
      }
    };

    manager.addEventListener(handleEvent);

    return () => {
      manager.removeEventListener(handleEvent);
    };
  }, []); // Remove murmubaraEngine dependency to prevent infinite loops

  // Actions
  const initialize = useCallback(async () => {
    if (!managerRef.current) return;

    try {
      // First let manager do its destroy/cleanup cycle
      await managerRef.current.initialize();

      // Then initialize the Murmuraba hook
      if (murmubaraEngineRef.current.initialize) {
        await murmubaraEngineRef.current.initialize();
      }
      
      // Force state update after successful initialization
      setState('ready');
      const metrics = managerRef.current.getHealthMetrics();
      setHealthMetrics({
        ...metrics,
        isHealthy: true  // Ensure isHealthy is true after successful init
      });

      // Re-register the engine after initialization
      managerRef.current.registerEngine(murmubaraEngineRef.current);
    } catch (error) {
      throw error;
    }
  }, []); // Remove dependency on murmubaraEngine

  const destroy = useCallback(async () => {
    if (!managerRef.current) return;

    try {
      await managerRef.current.destroy();
    } catch (error) {
      throw error;
    }
  }, []);

  const reset = useCallback(async () => {
    if (!managerRef.current) return;

    try {
      await managerRef.current.reset();
    } catch (error) {
      throw error;
    }
  }, []);

  const getEngine = useCallback(() => {
    if (!managerRef.current) {
      throw new Error('AudioEngineManager not initialized');
    }
    return managerRef.current.getEngine();
  }, []);

  return {
    // State
    isReady: state === 'ready' && healthMetrics.isHealthy,
    isInitializing: state === 'initializing',
    isDestroying: state === 'destroying',
    hasError: state === 'error',
    state,

    // Health metrics
    healthMetrics,

    // Actions
    initialize,
    destroy,
    reset,
    getEngine,
  };
}
