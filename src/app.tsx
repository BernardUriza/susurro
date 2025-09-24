// React and external libraries
import { useState } from 'react';

// Absolute imports (using aliases)
import { MatrixNavigation, MatrixRain, ModelSelector, BackendStatus } from './components';
import { WhisperProvider } from './contexts/WhisperContext';
import { EnhancedWhisperProvider } from './contexts/EnhancedWhisperContext';
import { ErrorBoundary } from './components/ErrorBoundary';

export function App() {
  // Auto-select Deepgram if configured as default
  const getDefaultModel = (): 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'deepgram' | null => {
    // Check for force Deepgram flag
    if (import.meta.env.VITE_FORCE_DEEPGRAM === 'true') {
      return 'deepgram';
    }

    // Check for default model setting
    const defaultModel = import.meta.env.VITE_DEFAULT_WHISPER_MODEL;
    if (defaultModel === 'deepgram') {
      return 'deepgram';
    }

    // If using Render deployment, default to deepgram
    if (import.meta.env.VITE_USE_RENDER === 'true') {
      return 'deepgram';
    }

    return null;
  };

  const [selectedModel, setSelectedModel] = useState<
    'tiny' | 'base' | 'small' | 'medium' | 'large' | 'deepgram' | null
  >(getDefaultModel);

  // eslint-disable-next-line no-console
  console.log('[App] Rendering, selectedModel:', selectedModel, 'Auto-selected:', getDefaultModel() !== null);

  return (
    <ErrorBoundary>
      <div
        style={{ position: 'relative', width: '100%', minHeight: '100vh', background: '#000000' }}
      >
        {!selectedModel ? (
          <ModelSelector
            onModelSelect={(modelId) => {
              // eslint-disable-next-line no-console
              console.log('[App] Model selected:', modelId);
              setSelectedModel(modelId);
            }}
          />
        ) : (
          <>
            {/* Use EnhancedWhisperProvider for backend support (Deepgram, remote Whisper) */}
            {selectedModel === 'deepgram' || import.meta.env.VITE_USE_RENDER === 'true' ? (
              <EnhancedWhisperProvider
                initialModel={selectedModel === 'deepgram' ? 'base' : (selectedModel as 'tiny' | 'base' | 'small' | 'medium' | 'large')}
                defaultTranscriptionMethod={selectedModel === 'deepgram' ? 'backend' : 'auto'}
                onWhisperProgressLog={(message, type) => {
                  console.log(`[Whisper ${type}] ${message}`);
                }}
              >
                <MatrixRain density={50} speed={50} opacity={0.08} fontSize={16} color="#00ff41" />
                <BackendStatus selectedModel={selectedModel} />
                <MatrixNavigation initialModel={selectedModel} />
              </EnhancedWhisperProvider>
            ) : (
              <WhisperProvider initialModel={selectedModel}>
                <MatrixRain density={50} speed={50} opacity={0.08} fontSize={16} color="#00ff41" />
                <BackendStatus selectedModel={selectedModel} />
                <MatrixNavigation initialModel={selectedModel} />
              </WhisperProvider>
            )}
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}
