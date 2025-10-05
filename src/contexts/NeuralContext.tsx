import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { useSusurro, AUDIO_CONFIG } from '@susurro/core';
import type { UseSusurroReturn } from '@susurro/core';
import {
  whisperBackend,
  type BackendHealthStatus,
  WhisperBackendError,
} from '../services/whisper-backend';

interface NeuralContextType extends UseSusurroReturn {
  // Backend integration (simplified - always backend)
  backendStatus: 'unknown' | 'available' | 'unavailable' | 'checking';
  backendHealth: BackendHealthStatus | null;
  checkBackendHealth: () => Promise<void>;
}

const NeuralContext = createContext<NeuralContextType | null>(null);

interface NeuralProviderProps {
  children: ReactNode;
  onNeuralProgressLog?: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
}

export const NeuralProvider: React.FC<NeuralProviderProps> = ({
  children,
  onNeuralProgressLog,
}) => {
  const susurroInstance = useSusurro({
    chunkDurationMs: AUDIO_CONFIG.RECORDING.DEFAULT_CHUNK_DURATION_MS, // 20000ms - UNIFIED chunk size
    initialModel: 'deepgram',
    onWhisperProgressLog: onNeuralProgressLog,
    engineConfig: {
      ...AUDIO_CONFIG.ENGINE_PRESETS.BALANCED, // Balanced quality preset
      enableMetrics: true,
    },
  });

  // Backend integration state (simplified - always backend)
  const [backendStatus, setBackendStatus] = useState<
    'unknown' | 'available' | 'unavailable' | 'checking'
  >('unknown');
  const [backendHealth, setBackendHealth] = useState<BackendHealthStatus | null>(null);

  // Check backend health
  const checkBackendHealth = useCallback(async () => {
    setBackendStatus('checking');
    try {
      const health = await whisperBackend.healthCheck();
      setBackendHealth(health);
      setBackendStatus('available');

      onNeuralProgressLog?.(`🌐 Backend Neural disponible (${health.model_size} model)`, 'success');
    } catch (error) {
      setBackendHealth(null);
      setBackendStatus('unavailable');

      if (error instanceof WhisperBackendError) {
        onNeuralProgressLog?.(`🌐 Backend no disponible: ${error.message}`, 'warning');
      } else {
        onNeuralProgressLog?.('🌐 Backend Neural no disponible', 'warning');
      }
    }
  }, [onNeuralProgressLog]);

  // Initialize backend status on mount
  useEffect(() => {
    checkBackendHealth();
  }, [checkBackendHealth]);

  const contextValue: NeuralContextType = {
    // Original useSusurro functionality
    ...susurroInstance,

    // Backend integration (simplified)
    backendStatus,
    backendHealth,
    checkBackendHealth,
  };

  return <NeuralContext.Provider value={contextValue}>{children}</NeuralContext.Provider>;
};

// Custom hook to use the Neural context
export const useNeural = () => {
  const context = useContext(NeuralContext);
  if (!context) {
    throw new Error('useNeural must be used within a NeuralProvider');
  }
  return context;
};
