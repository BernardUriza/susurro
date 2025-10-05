/**
 * TripleTranscriptionPanel
 *
 * Displays 3 separate transcription engines in real-time:
 * - WebSpeech (instant, gold color)
 * - Whisper (local processing, purple color)
 * - Deepgram (backend, blue color)
 *
 * Below: Final refined text combining all 3 inputs (green color)
 */

import React from 'react';
import styles from './triple-transcription-panel.module.css';

export interface TripleTranscriptionPanelProps {
  webSpeechText: string;
  whisperText: string;
  deepgramText: string;
  refinedText: string;
  isRecording: boolean;
}

export const TripleTranscriptionPanel: React.FC<TripleTranscriptionPanelProps> = ({
  webSpeechText,
  whisperText,
  deepgramText,
  refinedText,
  isRecording,
}) => {
  return (
    <div className={styles.container} data-testid="triple-panel-container">
      {/* Top Row: 3 Engine Panels */}
      <div className={styles.engineGrid}>
        {/* WebSpeech Panel */}
        <div
          className={`${styles.enginePanel} ${styles.webspeech} ${webSpeechText && isRecording ? styles.active : ''}`}
          data-testid="webspeech-panel"
        >
          <div className={styles.panelHeader}>
            <span className={styles.engineIcon}>🎤</span>
            <span className={styles.engineLabel}>Web Speech</span>
            {webSpeechText && isRecording && <span className={styles.liveIndicator}>●</span>}
          </div>
          <div className={styles.panelContent}>
            {webSpeechText || (
              <span className={styles.placeholder}>
                {isRecording ? 'Listening...' : 'Not active'}
              </span>
            )}
          </div>
        </div>

        {/* Whisper Panel */}
        <div
          className={`${styles.enginePanel} ${styles.whisper} ${whisperText && isRecording ? styles.active : ''}`}
          data-testid="whisper-panel"
        >
          <div className={styles.panelHeader}>
            <span className={styles.engineIcon}>🧠</span>
            <span className={styles.engineLabel}>Whisper</span>
            {whisperText && isRecording && <span className={styles.liveIndicator}>●</span>}
          </div>
          <div className={styles.panelContent}>
            {whisperText || (
              <span className={styles.placeholder}>
                {isRecording ? 'Processing...' : 'Not active'}
              </span>
            )}
          </div>
        </div>

        {/* Deepgram Panel */}
        <div
          className={`${styles.enginePanel} ${styles.deepgram} ${deepgramText && isRecording ? styles.active : ''}`}
          data-testid="deepgram-panel"
        >
          <div className={styles.panelHeader}>
            <span className={styles.engineIcon}>🌐</span>
            <span className={styles.engineLabel}>Deepgram</span>
            {deepgramText && isRecording && <span className={styles.liveIndicator}>●</span>}
          </div>
          <div className={styles.panelContent}>
            {deepgramText || (
              <span className={styles.placeholder}>
                {isRecording ? 'Processing...' : 'Not active'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Final Refined Text */}
      <div
        className={`${styles.refinedPanel} ${refinedText ? styles.refined : ''}`}
        data-testid="refined-panel"
      >
        <div className={styles.refinedHeader}>
          <span className={styles.refinedIcon}>✨</span>
          <span className={styles.refinedLabel}>Final Refined Text</span>
          {refinedText && <span className={styles.refinedBadge}>AI Enhanced</span>}
        </div>
        <div className={styles.refinedContent}>
          {refinedText || (
            <span className={styles.placeholder}>
              {isRecording
                ? 'Refining transcriptions...'
                : 'Start recording to see refined output'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
