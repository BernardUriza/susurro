// Absolute imports
import { MatrixNavigation, MatrixRain, BackendStatus } from './components';
import { NeuralProvider } from './contexts/NeuralContext';
import { ErrorBoundary } from './components/ErrorBoundary';

export function App() {
  return (
    <ErrorBoundary>
      <div
        style={{ position: 'relative', width: '100%', minHeight: '100vh', background: '#000000' }}
      >
        {/* Always use Deepgram backend for best performance */}
        <NeuralProvider
          onNeuralProgressLog={(message, type) => {
            console.log(`[Neural ${type}] ${message}`);
          }}
        >
          <MatrixRain density={50} speed={50} opacity={0.08} fontSize={16} color="#00ff41" />
          <BackendStatus selectedModel="deepgram" />
          <MatrixNavigation initialModel="deepgram" />
        </NeuralProvider>
      </div>
    </ErrorBoundary>
  );
}
