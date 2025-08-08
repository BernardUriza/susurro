// React and external libraries
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Absolute imports (using aliases)
import { MatrixScrollArea } from '../MatrixScrollArea';
import {
  WhisperMatrixTerminal,
  AudioFragmentProcessor,
} from '../../features/audio-processing/components';
import { WhisperEchoLogs } from '../../features/visualization/components/whisper-echo-logs';
import { useSusurro } from '@susurro/core';

// Type imports
import type { MatrixNavigationProps as NavProps } from './types';

// Style imports
import styles from './matrix-navigation.module.css';

export const MatrixNavigation = ({ initialView = 'terminal', initialModel = 'tiny' }: NavProps) => {
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

  // Track recent messages to avoid duplicates
  const recentMessagesRef = useRef<Set<string>>(new Set());

  // REFACTOR: Stable callback to survive re-renders and StrictMode cycles
  const addWhisperLog = useCallback(
    (message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') => {
      // Create a key for duplicate detection (message + type + timestamp within 500ms)
      const now = Date.now();
      const messageKey = `${message}-${type}`;

      // Only block exact duplicates within 500ms (much shorter window)
      // This prevents StrictMode duplicates but allows legitimate progress updates
      const isDuplicateStrictMode = recentMessagesRef.current.has(messageKey);

      if (isDuplicateStrictMode) {
        return; // Skip StrictMode duplicate
      }

      // Add to recent messages with shorter cleanup window
      recentMessagesRef.current.add(messageKey);
      setTimeout(() => {
        recentMessagesRef.current.delete(messageKey);
      }, 500); // Reduced from 1000ms to 500ms

      setWhisperLogs((prev) => [
        ...prev,
        {
          id: `log-${now}-${Math.random()}`,
          timestamp: new Date(),
          message,
          type,
        },
      ]);
    },
    []
  );

  // Get Whisper status from useSusurro with selected model
  const { whisperReady, whisperProgress, whisperError } = useSusurro({
    onWhisperProgressLog: addWhisperLog,
    initialModel: initialModel,
  });

  // Suppress unused variable warnings - these are used by the logging system
  void whisperReady;
  void whisperProgress;
  void whisperError;

  const views = useMemo(
    () =>
      ({
        terminal: {
          component: <WhisperMatrixTerminal />,
          title: '[WHISPER_MATRIX_TERMINAL]',
          key: 'F1',
        },
        processor: {
          component: <AudioFragmentProcessor 
            onBack={() => setCurrentView('terminal')} 
            onLog={addWhisperLog}
          />,
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
      }) as const,
    [addWhisperLog]
  );

  const handleViewChange = useCallback(
    (viewKey: keyof typeof views) => {
      if (isTransitioning || viewKey === currentView) return;

      setIsTransitioning(true);
      setCurrentView(viewKey);

      // Log view change
      const viewName = views[viewKey].title;
      addWhisperLog(`🔀 Navegando a ${viewName}`, 'info');

      // Simple transition timing
      setTimeout(() => setIsTransitioning(false), 200);
    },
    [isTransitioning, currentView, addWhisperLog, views]
  );

  // Add initial system status log and preload dependencies
  useEffect(() => {
    // Use a flag to prevent duplicate initialization in StrictMode
    let initialized = false;
    
    const initializeLogs = () => {
      if (initialized) return;
      initialized = true;
      
      addWhisperLog('👋 Bienvenido a Susurro Whisper AI', 'success');
      addWhisperLog(`🔄 Inicializando sistema de transcripción con modelo: ${initialModel}`, 'info');
      addWhisperLog(`📊 Versión: 2.0.0 | Modo: ${process.env.NODE_ENV || 'production'}`, 'info');
    };
    
    initializeLogs();

    // Add system info after a short delay
    setTimeout(() => {
      addWhisperLog('🧠 Preparando motor de IA para transcripción en tiempo real', 'info');
      addWhisperLog('📡 Conectando con sistema de captura de audio...', 'info');
      addWhisperLog('🛡️ Verificando permisos del navegador...', 'info');

      // Check browser capabilities
      if (typeof AudioContext !== 'undefined') {
        addWhisperLog('✅ AudioContext disponible - audio processing habilitado', 'success');
      }
      
      if (typeof MediaRecorder !== 'undefined') {
        addWhisperLog('✅ MediaRecorder disponible - grabación habilitada', 'success');
      }

      // Preload heavy dependencies for better UX
      import('../../../packages/susurro/src/lib/dynamic-loaders').then(
        ({ preloadCriticalDependencies }) => {
          preloadCriticalDependencies();
          addWhisperLog('📦 Pre-cargando dependencias críticas en segundo plano...', 'info');
          addWhisperLog('⚡ Optimizando rendimiento para procesamiento en tiempo real', 'info');
        }
      ).catch((error) => {
        addWhisperLog(`⚠️ Error pre-cargando dependencias: ${error.message}`, 'warning');
      });
    }, 500);

    // Check Whisper status after a delay
    setTimeout(() => {
      if (whisperError) {
        addWhisperLog(`❌ Error en modelo Whisper: ${whisperError}`, 'error');
      } else if (whisperReady) {
        addWhisperLog('✅ Modelo Whisper listo y operativo', 'success');
      } else if (whisperProgress > 0) {
        addWhisperLog(`⏳ Cargando modelo Whisper: ${whisperProgress}%`, 'info');
      }
    }, 1500);
  }, [addWhisperLog, initialModel, whisperError, whisperReady, whisperProgress]);

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
