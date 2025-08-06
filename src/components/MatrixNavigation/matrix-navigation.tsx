// 1. React and external libraries
import { useState, useEffect, useCallback } from 'react';

// 2. Absolute imports (internal modules)
import { MatrixScrollArea } from '../MatrixScrollArea';
import {
  WhisperMatrixTerminal,
  AudioFragmentProcessor,
} from '../../features/audio-processing/components';
import { WhisperEchoLogs } from '../../features/visualization/components/whisper-echo-logs';
import { useSusurro } from '../../../packages/susurro/src/hooks/use-susurro';

// 3. Type imports
import type { MatrixNavigationProps as NavProps } from './types';

// 4. Style imports
import styles from './matrix-navigation.module.css';

export const MatrixNavigation = ({ initialView = 'terminal' }: NavProps) => {
  const [currentView, setCurrentView] = useState(initialView);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Whisper logs state
  const [whisperLogs, setWhisperLogs] = useState<
    Array<{
      id: string;
      timestamp: Date;
      message: string;
      type: 'info' | 'warning' | 'error' | 'success';
    }>
  >([]);

  // REFACTOR: Stable callback to survive re-renders and StrictMode cycles
  const addWhisperLog = useCallback((
    message: string,
    type: 'info' | 'warning' | 'error' | 'success' = 'info'
  ) => {
    // Debug trace for progress logging issues - development only
    if (process.env.NODE_ENV === 'development') {
      console.log('[MATRIX_NAVIGATION_LOG]', { message, type, timestamp: Date.now() });
    }
    
    setWhisperLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        message,
        type,
      },
    ]);
  }, []);

  // Get Whisper status from useSusurro (unused vars are for future functionality)
  const { whisperReady, whisperProgress, whisperError } = useSusurro({
    onWhisperProgressLog: addWhisperLog,
  });

  // Suppress unused variable warnings - these are used by the logging system
  void whisperReady;
  void whisperProgress;
  void whisperError;

  const views = {
    terminal: {
      component: <WhisperMatrixTerminal />,
      title: '[WHISPER_MATRIX_TERMINAL]',
      key: 'F1',
    },
    processor: {
      component: <AudioFragmentProcessor onBack={() => setCurrentView('terminal')} />,
      title: '[AUDIO_FRAGMENT_PROCESSOR]',
      key: 'F2',
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
      key: 'F3',
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
      key: 'F4',
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
      key: 'F5',
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
      key: 'F6',
    },
  } as const;

  const handleViewChange = useCallback((viewKey: keyof typeof views) => {
    if (isTransitioning || viewKey === currentView) return;

    setIsTransitioning(true);
    setCurrentView(viewKey);

    // Log view change
    const viewName = views[viewKey].title;
    addWhisperLog(`🔀 Navegando a ${viewName}`, 'info');

    // Simple transition timing
    setTimeout(() => setIsTransitioning(false), 200);
  }, [isTransitioning, currentView, addWhisperLog]);

  // Add initial system status log and preload dependencies
  useEffect(() => {
    addWhisperLog('👋 Bienvenido a Susurro Whisper AI', 'success');
    addWhisperLog('🔄 Inicializando sistema de transcripción...', 'info');

    // Add system info after a short delay
    setTimeout(() => {
      addWhisperLog('🧠 Preparando modelo de IA para transcripción', 'info');
      addWhisperLog('📡 Conectando con sistema de audio...', 'info');

      // Preload heavy dependencies for better UX
      import('../../../packages/susurro/src/lib/dynamic-loaders').then(
        ({ preloadCriticalDependencies }) => {
          preloadCriticalDependencies();
          addWhisperLog('📦 Pre-cargando dependencias en segundo plano...', 'info');
        }
      );
    }, 500);
  }, [addWhisperLog]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const keyMap = {
        F1: 'terminal',
        F2: 'processor',
        F3: 'analytics',
        F4: 'settings',
        F5: 'export',
        F6: 'history',
      } as const;

      const viewKey = keyMap[e.key as keyof typeof keyMap];
      if (viewKey) {
        e.preventDefault();
        handleViewChange(viewKey);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleViewChange]);

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
        <MatrixScrollArea height="100%" fadeEdges={true} className={styles.scrollArea}>
          <div className={styles.contentInner}>
            {views[currentView as keyof typeof views].component}
          </div>
        </MatrixScrollArea>
      </main>

      {/* Status Bar with Whisper Logs */}
      <footer className={styles.statusBar}>
        <div className={styles.statusInfo}>
          <span>[ACTIVE: {views[currentView as keyof typeof views].title}]</span>
          <span>[USE F1-F6 TO NAVIGATE]</span>
          <span>[SYSTEM: ONLINE]</span>
        </div>
        <div className={styles.whisperLogsContainer}>
          <WhisperEchoLogs logs={whisperLogs} maxLogs={50} autoScroll={true} />
        </div>
      </footer>
    </div>
  );
};
