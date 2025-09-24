// Configure ONNX Runtime BEFORE any other imports
// This suppresses the "Removing initializer" warnings
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).ort = { env: { logLevel: 'error', debug: false } };
}

import ReactDOM from 'react-dom/client';
import { App } from './app';
import './styles/reset.css';
import './styles/tokens.css';
import './styles/matrix-theme.css';
import './styles/scroll-animations.css';

// Note: HuggingFace models are loaded directly without tokens
// Local Whisper models work without authentication

// eslint-disable-next-line no-console
console.log('[MAIN] Starting React app...');
const rootElement = document.getElementById('root');
// eslint-disable-next-line no-console
console.log('[MAIN] Root element:', rootElement);

if (rootElement) {
  try {
    ReactDOM.createRoot(rootElement).render(<App />);
    // eslint-disable-next-line no-console
    console.log('[MAIN] React app mounted');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[MAIN] Error mounting React app:', error);
  }
} else {
  // eslint-disable-next-line no-console
  console.error('[MAIN] Root element not found!');
}
