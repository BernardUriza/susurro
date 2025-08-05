import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import './styles/reset.css';
import './styles/tokens.css';
import './styles/matrix-theme.css';
import './styles/scroll-animations.css';

// Set HuggingFace token globally for the Whisper model
// This is read from VITE_HUGGINGFACE_TOKEN env variable
if (import.meta.env.VITE_HUGGINGFACE_TOKEN) {
  (window as any).VITE_HUGGINGFACE_TOKEN = import.meta.env.VITE_HUGGINGFACE_TOKEN;
  console.log('[MAIN] HuggingFace token set in window object');
} else {
  // Fallback for development - this should be replaced with proper env var in production
  (window as any).VITE_HUGGINGFACE_TOKEN = '***REMOVED***';
  console.log('[MAIN] Using fallback HuggingFace token');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
