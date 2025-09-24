import React, { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
import { useSusurro } from '@susurro/core';
import type { UseSusurroReturn } from '@susurro/core';
import {
  whisperBackend,
  shouldUseBackend,
  transcribeAudio,
  type BackendTranscriptionResult,
  type BackendHealthStatus,
  WhisperBackendError
} from '../services/whisper-backend';

interface TranscriptionMethod {
  type: 'client' | 'backend' | 'auto';
  description: string;
}

interface EnhancedWhisperContextType extends UseSusurroReturn {
  // Backend integration
  backendStatus: 'unknown' | 'available' | 'unavailable' | 'checking';
  backendHealth: BackendHealthStatus | null;
  transcriptionMethod: TranscriptionMethod;
  setTranscriptionMethod: (method: 'client' | 'backend' | 'auto') => void;
  checkBackendHealth: () => Promise<void>;

  // Enhanced transcription with backend support
  transcribeWithEnhancedWhisper: (
    blob: Blob,
    options?: {
      language?: string;
      responseFormat?: 'text' | 'detailed';
      forceMethod?: 'client' | 'backend';
      onProgress?: (progress: number) => void;
    }
  ) => Promise<BackendTranscriptionResult | null>;

  // Backend-specific methods
  getBackendModels: () => Promise<any>;
  isBackendAvailable: () => Promise<boolean>;
}

const EnhancedWhisperContext = createContext<EnhancedWhisperContextType | null>(null);

interface EnhancedWhisperProviderProps {
  children: ReactNode;
  initialModel?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  onWhisperProgressLog?: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
  defaultTranscriptionMethod?: 'client' | 'backend' | 'auto';
}

export const EnhancedWhisperProvider: React.FC<EnhancedWhisperProviderProps> = ({
  children,
  initialModel = 'base',
  onWhisperProgressLog,
  defaultTranscriptionMethod = 'auto',
}) => {
  // Original useSusurro instance
  const susurroInstance = useSusurro({
    chunkDurationMs: 8000,
    initialModel,
    onWhisperProgressLog,
  });

  // Backend integration state
  const [backendStatus, setBackendStatus] = useState<'unknown' | 'available' | 'unavailable' | 'checking'>('unknown');
  const [backendHealth, setBackendHealth] = useState<BackendHealthStatus | null>(null);
  const [transcriptionMethod, setTranscriptionMethodState] = useState<TranscriptionMethod>({
    type: defaultTranscriptionMethod,
    description: getMethodDescription(defaultTranscriptionMethod)
  });

  function getMethodDescription(method: 'client' | 'backend' | 'auto'): string {
    switch (method) {
      case 'client':
        return 'Client-side Whisper (browser processing)';
      case 'backend':
        return 'Backend Whisper (server processing)';
      case 'auto':
        return 'Auto-detect (backend if available, client otherwise)';
      default:
        return 'Unknown method';
    }
  }

  const setTranscriptionMethod = useCallback((method: 'client' | 'backend' | 'auto') => {
    setTranscriptionMethodState({
      type: method,
      description: getMethodDescription(method)
    });
  }, []);

  // Check backend health
  const checkBackendHealth = useCallback(async () => {
    setBackendStatus('checking');
    try {
      const health = await whisperBackend.healthCheck();
      setBackendHealth(health);
      setBackendStatus('available');

      onWhisperProgressLog?.(
        `🌐 Backend Whisper disponible (${health.model_size} model)`,
        'success'
      );
    } catch (error) {
      setBackendHealth(null);
      setBackendStatus('unavailable');

      if (error instanceof WhisperBackendError) {
        onWhisperProgressLog?.(
          `🌐 Backend no disponible: ${error.message}`,
          'warning'
        );
      } else {
        onWhisperProgressLog?.(
          '🌐 Backend Whisper no disponible',
          'warning'
        );
      }
    }
  }, [onWhisperProgressLog]);

  // Initialize backend status on mount
  useEffect(() => {
    checkBackendHealth();
  }, [checkBackendHealth]);

  // Enhanced transcription with backend support
  const transcribeWithEnhancedWhisper = useCallback(async (
    blob: Blob,
    options: {
      language?: string;
      responseFormat?: 'text' | 'detailed';
      forceMethod?: 'client' | 'backend';
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<BackendTranscriptionResult | null> => {
    const { forceMethod, onProgress, ...transcribeOptions } = options;

    // Determine which method to use
    let useBackend: boolean;

    if (forceMethod === 'client') {
      useBackend = false;
    } else if (forceMethod === 'backend') {
      useBackend = true;
    } else {
      // Auto-detect or use current method setting
      if (transcriptionMethod.type === 'client') {
        useBackend = false;
      } else if (transcriptionMethod.type === 'backend') {
        useBackend = true;
      } else {
        // Auto mode - check if backend should be used
        useBackend = await shouldUseBackend();
      }
    }

    try {
      return await transcribeAudio(blob, {
        ...transcribeOptions,
        useBackend,
        onProgress,
        clientTranscriber: async (audioBlob: Blob) => {
          // Use the original useSusurro transcription method
          return await susurroInstance.transcribeWithWhisper(audioBlob);
        }
      });
    } catch (error) {
      onWhisperProgressLog?.(
        `❌ Error en transcripción: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        'error'
      );
      return null;
    }
  }, [transcriptionMethod.type, susurroInstance.transcribeWithWhisper, onWhisperProgressLog]);

  // Backend-specific methods
  const getBackendModels = useCallback(async () => {
    return await whisperBackend.getModels();
  }, []);

  const isBackendAvailable = useCallback(async () => {
    return await whisperBackend.isAvailable();
  }, []);

  const contextValue: EnhancedWhisperContextType = {
    // Original useSusurro functionality
    ...susurroInstance,

    // Enhanced backend integration
    backendStatus,
    backendHealth,
    transcriptionMethod,
    setTranscriptionMethod,
    checkBackendHealth,
    transcribeWithEnhancedWhisper,
    getBackendModels,
    isBackendAvailable,
  };

  return (
    <EnhancedWhisperContext.Provider value={contextValue}>
      {children}
    </EnhancedWhisperContext.Provider>
  );
};

// Custom hook to use the Enhanced Whisper context
export const useEnhancedWhisper = () => {
  const context = useContext(EnhancedWhisperContext);
  if (!context) {
    throw new Error('useEnhancedWhisper must be used within an EnhancedWhisperProvider');
  }
  return context;
};

// Backward compatibility - you can still use the original WhisperContext
export { WhisperProvider, useWhisper } from './WhisperContext';