// Configure ONNX Runtime BEFORE any other imports
// This suppresses the "Removing initializer" warnings
if (typeof window !== 'undefined') {
  (window as any).ort = { env: { logLevel: 'error', debug: false } };
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app'; // Restaurar app principal
import './styles/reset.css';
import './styles/tokens.css';
import './styles/matrix-theme.css';
import './styles/scroll-animations.css';

// Set HuggingFace token from environment
if (import.meta.env.VITE_HUGGINGFACE_TOKEN) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).VITE_HUGGINGFACE_TOKEN = import.meta.env.VITE_HUGGINGFACE_TOKEN;
  // eslint-disable-next-line no-console
  console.log('[MAIN] HuggingFace token configured from environment');
} else {
  // eslint-disable-next-line no-console
  console.warn('[MAIN] No HuggingFace token configured - model loading may be restricted');
}

// eslint-disable-next-line no-console
console.log('[MAIN] Starting React app...');
const rootElement = document.getElementById('root');
// eslint-disable-next-line no-console
console.log('[MAIN] Root element:', rootElement);

if (rootElement) {
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
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
