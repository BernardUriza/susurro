import { useState, useEffect } from 'react';
import styles from './MatrixNavigation.module.css';
import { MatrixScrollArea } from '../MatrixScrollArea';
import { 
  WhisperMatrixTerminal, 
  AudioFragmentProcessor 
} from '../../features/audio-processing/components';
import type { MatrixNavigationProps as NavProps } from './types';

export const MatrixNavigation = ({ initialView = 'terminal' }: NavProps) => {
  const [currentView, setCurrentView] = useState(initialView);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const views = {
    terminal: {
      component: <WhisperMatrixTerminal />,
      title: '[WHISPER_MATRIX_TERMINAL]',
      key: 'F1'
    },
    processor: {
      component: <AudioFragmentProcessor onBack={() => setCurrentView('terminal')} />,
      title: '[AUDIO_FRAGMENT_PROCESSOR]',
      key: 'F2'
    },
    analytics: {
      component: (
        <div className={styles.placeholder}>
          <h2>[ANALYTICS_MODULE]</h2>
          <p>COMING SOON</p>
          <div className={styles.icon}>📊</div>
        </div>
      ),
      title: '[ANALYTICS]',
      key: 'F3'
    },
    settings: {
      component: (
        <div className={styles.placeholder}>
          <h2>[SETTINGS_PANEL]</h2>
          <p>CONFIGURATION</p>
          <div className={styles.icon}>⚙️</div>
        </div>
      ),
      title: '[SETTINGS]',
      key: 'F4'
    },
    export: {
      component: (
        <div className={styles.placeholder}>
          <h2>[EXPORT_CENTER]</h2>
          <p>EXPORT OPTIONS</p>
          <div className={styles.icon}>💾</div>
        </div>
      ),
      title: '[EXPORT]',
      key: 'F5'
    },
    history: {
      component: (
        <div className={styles.placeholder}>
          <h2>[HISTORY_LOG]</h2>
          <p>TRANSCRIPTION HISTORY</p>
          <div className={styles.icon}>📜</div>
        </div>
      ),
      title: '[HISTORY]',
      key: 'F6'
    }
  } as const;

  const handleViewChange = (viewKey: keyof typeof views) => {
    if (isTransitioning || viewKey === currentView) return;
    
    setIsTransitioning(true);
    setCurrentView(viewKey);
    
    // Simple transition timing
    setTimeout(() => setIsTransitioning(false), 200);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const keyMap = {
        'F1': 'terminal',
        'F2': 'processor', 
        'F3': 'analytics',
        'F4': 'settings',
        'F5': 'export',
        'F6': 'history'
      } as const;
      
      const viewKey = keyMap[e.key as keyof typeof keyMap];
      if (viewKey) {
        e.preventDefault();
        handleViewChange(viewKey);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className={styles.container}>
      {/* Navigation Grid */}
      <nav className={styles.navigation}>
        {Object.entries(views).map(([key, view]) => (
          <button
            key={key}
            onClick={() => handleViewChange(key as keyof typeof views)}
            className={`
              ${styles.navButton} 
              ${currentView === key ? styles.active : ''}
              ${isTransitioning ? styles.disabled : ''}
            `}
            disabled={isTransitioning}
            aria-label={view.title}
          >
            <span className={styles.keyHint}>{view.key}</span>
            <span className={styles.title}>{view.title}</span>
          </button>
        ))}
      </nav>

      {/* Content Area with MatrixScrollArea */}
      <main 
        className={`${styles.content} ${isTransitioning ? styles.transitioning : ''}`}
        role="main"
        aria-live="polite"
      >
        <MatrixScrollArea 
          height="100%" 
          fadeEdges={true}
          className={styles.scrollArea}
        >
          <div className={styles.contentInner}>
            {views[currentView].component}
          </div>
        </MatrixScrollArea>
      </main>

      {/* Status Bar */}
      <footer className={styles.statusBar}>
        <span>[ACTIVE: {views[currentView].title}]</span>
        <span>[USE F1-F6 TO NAVIGATE]</span>
        <span>[SYSTEM: ONLINE]</span>
      </footer>
    </div>
  );
};