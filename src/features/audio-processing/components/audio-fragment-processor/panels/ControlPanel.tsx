import React from 'react';
import styles from '../audio-fragment-processor.module.css';

interface ControlPanelProps {
  isRecording: boolean;
  recordingDuration: number;
  chunksProcessed: number;
  engineStatus: {
    isInitialized: boolean;
    isInitializing: boolean;
    error: string | null;
  };
  whisperStatus: {
    ready: boolean;
    progress: number;
  };
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isRecording,
  recordingDuration,
  chunksProcessed,
  engineStatus,
  whisperStatus,
  onStart,
  onStop,
  onReset,
}) => {
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusDotClass = () => {
    if (engineStatus.error) return `${styles.statusDot} ${styles.error}`;
    if (engineStatus.isInitializing) return `${styles.statusDot} ${styles.initializing}`;
    if (engineStatus.isInitialized) return `${styles.statusDot} ${styles.ready}`;
    return styles.statusDot;
  };

  const getStatusText = () => {
    if (engineStatus.error) return `Error: ${engineStatus.error}`;
    if (engineStatus.isInitializing) return 'Initializing engine...';
    if (!engineStatus.isInitialized) return 'Engine not ready';
    if (!whisperStatus.ready) return `Loading Whisper: ${whisperStatus.progress}%`;
    if (isRecording) return 'Recording active';
    return 'Ready to record';
  };

  return (
    <div className={`${styles.panel} ${styles.controlPanel}`}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>🎮 Control Center</h3>
      </div>

      {/* Status Section */}
      <div className={styles.statusSection}>
        <div className={styles.statusIndicator}>
          <span className={getStatusDotClass()}></span>
          <span>{getStatusText()}</span>
        </div>
        
        {/* Whisper Progress Bar */}
        {!whisperStatus.ready && whisperStatus.progress > 0 && (
          <div style={{ 
            marginTop: '10px',
            background: 'rgba(0, 255, 65, 0.1)',
            border: '1px solid rgba(0, 255, 65, 0.3)',
            height: '20px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${whisperStatus.progress}%`,
              background: 'linear-gradient(90deg, #00ff41 0%, #00cc33 100%)',
              transition: 'width 0.3s ease'
            }}></div>
            <span style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '0.8rem',
              color: '#fff',
              textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
            }}>
              {whisperStatus.progress}%
            </span>
          </div>
        )}
      </div>

      {/* Recording Timer */}
      {isRecording && (
        <div className={styles.recordingTimer}>
          {formatDuration(recordingDuration)}
        </div>
      )}

      {/* Control Buttons */}
      <div className={styles.controlButtons}>
        <button
          onClick={isRecording ? onStop : onStart}
          disabled={!engineStatus.isInitialized || !!engineStatus.error || engineStatus.isInitializing}
          className={`${styles.primaryButton} ${isRecording ? styles.stop : ''}`}
        >
          {isRecording ? '■ STOP' : '● START RECORDING'}
        </button>

        <button
          onClick={onReset}
          disabled={isRecording || engineStatus.isInitializing}
          className={styles.secondaryButton}
        >
          ↻ Reset Engine
        </button>
      </div>

      {/* Metrics Grid */}
      <div className={styles.metricsGrid}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Chunks</div>
          <div className={styles.metricValue}>{chunksProcessed}</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Status</div>
          <div className={styles.metricValue} style={{ fontSize: '0.9rem' }}>
            {isRecording ? '🔴 REC' : '⭕ IDLE'}
          </div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Whisper</div>
          <div className={styles.metricValue} style={{ fontSize: '0.9rem' }}>
            {whisperStatus.ready ? '✅' : `${whisperStatus.progress}%`}
          </div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Engine</div>
          <div className={styles.metricValue} style={{ fontSize: '0.9rem' }}>
            {engineStatus.isInitialized ? '✅' : engineStatus.isInitializing ? '⏳' : '❌'}
          </div>
        </div>
      </div>
    </div>
  );
};