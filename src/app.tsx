// React and external libraries
import { useState } from 'react';

// Relative imports - components
import { MatrixNavigation } from './components/MatrixNavigation';
import { MatrixRain } from './components/MatrixRain';
import { ModelSelector } from './components/ModelSelector';

function App() {
  const [selectedModel, setSelectedModel] = useState<'tiny' | 'base' | 'medium' | null>(null);

  // eslint-disable-next-line no-console
  console.log('[App] Rendering, selectedModel:', selectedModel);

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', background: '#000000' }}>
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
          <MatrixRain density={50} speed={50} opacity={0.08} fontSize={16} color="#00ff41" />
          <MatrixNavigation initialModel={selectedModel} />
        </>
      )}
    </div>
  );
}

export default App;
