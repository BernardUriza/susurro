/**
 * AudioFragmentProcessor
 *
 * Main transcription UI - CLEAN TRIPLE SYSTEM ONLY
 * All dual/simple legacy code removed
 */

import React from 'react';
import { ErrorBoundary } from '../../../../components/ErrorBoundary';
import { TripleTranscriptionMode } from './TripleTranscriptionMode';
import styles from './audio-fragment-processor.module.css';

export interface AudioFragmentProcessorProps {
  onBack: () => void;
  onLog?: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
}

export const AudioFragmentProcessor: React.FC<AudioFragmentProcessorProps> = ({
  onBack,
  onLog,
}) => {
  return (
    <ErrorBoundary>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <button onClick={onBack} className={styles.backButton}>
            ← Back
          </button>
          <h1 className={styles.title}>Triple Transcription System</h1>
          <div className={styles.badge}>
            <span>🎤 WebSpeech</span>
            <span>🧠 Whisper</span>
            <span>🌐 Deepgram</span>
            <span>✨ AI Refined</span>
          </div>
        </div>

        {/* Triple Transcription Mode */}
        <TripleTranscriptionMode onLog={onLog} />
      </div>
    </ErrorBoundary>
  );
};
