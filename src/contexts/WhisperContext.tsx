import React, { createContext, useContext, ReactNode } from 'react';
import { useSusurro } from '@susurro/core';
import type { UseSusurroReturn } from '@susurro/core';

interface WhisperContextType extends UseSusurroReturn {
  // Any additional context-specific properties can go here
}

const WhisperContext = createContext<WhisperContextType | null>(null);

interface WhisperProviderProps {
  children: ReactNode;
  initialModel?: 'tiny' | 'base' | 'medium'; // Match the type from useSusurro
  onWhisperProgressLog?: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
}

export const WhisperProvider: React.FC<WhisperProviderProps> = ({
  children,
  initialModel = 'base',
  onWhisperProgressLog,
}) => {
  console.log('[WhisperProvider] Initializing with model:', initialModel);

  // SINGLE INSTANCE of useSusurro for the entire app
  const susurroInstance = useSusurro({
    chunkDurationMs: 8000,
    initialModel,
    onWhisperProgressLog,
  });

  console.log('[WhisperProvider] susurroInstance created:', !!susurroInstance);

  return <WhisperContext.Provider value={susurroInstance}>{children}</WhisperContext.Provider>;
};

// Custom hook to use the Whisper context
export const useWhisper = () => {
  const context = useContext(WhisperContext);
  console.log('[useWhisper] Context value:', !!context);
  if (!context) {
    console.error(
      '[useWhisper] ERROR: Context is null! Make sure component is wrapped in WhisperProvider'
    );
    throw new Error('useWhisper must be used within a WhisperProvider');
  }
  return context;
};
