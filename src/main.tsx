import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import './styles/reset.css';
import './styles/tokens.css';
import './styles/matrix-theme.css';
import './styles/scroll-animations.css';

// Set HuggingFace token from environment
if (import.meta.env.VITE_HUGGINGFACE_TOKEN) {
  (window as any).VITE_HUGGINGFACE_TOKEN = import.meta.env.VITE_HUGGINGFACE_TOKEN;
  console.log('[MAIN] HuggingFace token configured from environment');
} else {
  console.warn('[MAIN] No HuggingFace token configured - model loading may be restricted');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
