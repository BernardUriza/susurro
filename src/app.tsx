// React and external libraries
import { useState } from 'react';

// Absolute imports (using aliases)
import { MatrixNavigation, MatrixRain, ModelSelector } from './components';
import { WhisperProvider } from './contexts/WhisperContext';
import { ErrorBoundary } from './components/ErrorBoundary';

export function App() {
  const [selectedModel, setSelectedModel] = useState<'tiny' | 'base' | 'medium' | null>(null);

  // eslint-disable-next-line no-console
  console.log('[App] Rendering, selectedModel:', selectedModel);

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
            <WhisperProvider initialModel={selectedModel}>
              <MatrixRain density={50} speed={50} opacity={0.08} fontSize={16} color="#00ff41" />
              <MatrixNavigation initialModel={selectedModel} />
            </WhisperProvider>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}
