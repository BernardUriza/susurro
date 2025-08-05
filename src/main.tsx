import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import './styles/reset.css';
import './styles/tokens.css';
import './styles/matrix-theme.css';
import './styles/scroll-animations.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
