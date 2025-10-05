/**
 * SimpleTranscriptionMode - Clean, productive transcription UI
 * Extracted from AudioFragmentProcessor for better code organization
 */

import React, { useCallback, useState, useEffect } from 'react';
import type { StreamingSusurroChunk } from '@susurro/core';
import { useDualTranscription } from '@susurro/core';
import { SimpleWaveformAnalyzer } from 'murmuraba';
import { useNeural } from '../../../../contexts/NeuralContext';
import styles from './audio-fragment-processor.module.css';

interface SimpleTranscriptionModeProps {
  onLog?: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
}

export const SimpleTranscriptionMode: React.FC<SimpleTranscriptionModeProps> = ({ onLog }) => {
  const neural = useNeural();

  // Dual transcription hook
  const dual = useDualTranscription({
    language: 'es-ES',
    autoRefine: true,
    claudeConfig: {
      enabled: true,
      apiUrl: 'http://localhost:8001/refine',
    },
  });

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false); // NEW: Track initialization state
  const [copied, setCopied] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<{
    source: 'web-speech' | 'deepgram' | 'claude';
    text: string;
    timestamp: number;
  } | null>(null);
  const deepgramChunksRef = React.useRef<string[]>([]);

  // Start recording with dual transcription
  const startRecording = useCallback(async () => {
    // Show initializing state immediately for user feedback
    setIsInitializing(true);

    if (!neural.isEngineInitialized) {
      await neural.initializeAudioEngine();
    }

    setIsRecording(true);
    deepgramChunksRef.current = [];
    dual.resetTranscription();
    dual.startTranscription();

    // Clear initializing state after a short delay (Web Speech should have started by then)
    setTimeout(() => setIsInitializing(false), 500);

    await neural.startStreamingRecording(
      async (chunk: StreamingSusurroChunk) => {

        // Send ALL chunks to Deepgram, not just voice-active ones
        if (chunk.transcriptionText?.trim()) {
          deepgramChunksRef.current.push(chunk.transcriptionText);
          dual.addDeepgramChunk?.(chunk);

          // PROGRESSIVE REFINEMENT: When Deepgram returns a transcription,
          // send both Web Speech AND Deepgram to Claude for refinement
          const webSpeechCurrent = dual.webSpeechText || '';
          const deepgramCurrent = deepgramChunksRef.current.join(' ');

          if (webSpeechCurrent || deepgramCurrent) {
            // Trigger Claude refinement with both sources
            await dual.refineWithClaude(webSpeechCurrent, deepgramCurrent);
          }

          // Track Deepgram updates
          setLastUpdate({
            source: 'deepgram',
            text: chunk.transcriptionText,
            timestamp: Date.now(),
          });
        }
      },
      {
        chunkDuration: 3, // Aumentar a 3 segundos para chunks más grandes
        vadThreshold: 0.1, // Reducir threshold para capturar más audio
        enableRealTimeTranscription: true,
        enableNoiseReduction: false, // DESHABILITAR noise reduction temporalmente
      }
    );

    onLog?.('🎤 Recording started', 'success');
  }, [neural, dual, onLog]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    setIsInitializing(false); // Clear any lingering initialization state
    await neural.stopStreamingRecording();
    await dual.stopTranscription();
    deepgramChunksRef.current = [];
    onLog?.('✅ Recording stopped', 'success');
  }, [neural, dual, onLog]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Copy to clipboard
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      onLog?.('📋 Copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    });
  }, [onLog]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow Space to work unless user is typing in an input/textarea
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.code === 'Space' && !isTyping) {
        e.preventDefault();
        toggleRecording();
      }
      if (e.code === 'Escape' && isRecording) {
        e.preventDefault();
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleRecording, isRecording, stopRecording]);

  // Track Web Speech updates
  useEffect(() => {
    if (isRecording && dual.webSpeechText) {
      setLastUpdate({
        source: 'web-speech',
        text: dual.webSpeechText,
        timestamp: Date.now(),
      });
    }
  }, [dual.webSpeechText, isRecording]);

  // Track Claude updates
  useEffect(() => {
    if (dual.refinedText) {
      setLastUpdate({
        source: 'claude',
        text: dual.refinedText,
        timestamp: Date.now(),
      });
    }
  }, [dual.refinedText]);


  // Current text display - REFINED text (confirmed)
  const confirmedText = dual.refinedText || '';

  // Pending text - what's being processed (shown in gray)
  const pendingText = isRecording
    ? (dual.deepgramText || dual.webSpeechText || '')
    : '';

  // Show pending only if different from confirmed
  const showPending = pendingText && pendingText !== confirmedText && !confirmedText.includes(pendingText);

  // Placeholder text based on state
  const placeholderText = isInitializing
    ? 'Iniciando reconocimiento...'
    : isRecording
    ? 'Escuchando... habla ahora'
    : 'Presiona SPACE para grabar';

  return (
    <div className={styles.simpleMode}>
      {/* Waveform header - compact minimal design */}
      {isRecording && (
        <div style={{
          padding: '2px 15px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderBottom: '1px solid rgba(0, 255, 65, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>🎙️</span>
          {neural.currentStream ? (
            <div style={{ flex: 1, height: '22px' }}>
              <SimpleWaveformAnalyzer
                stream={neural.currentStream}
                isActive={isRecording}
              />
            </div>
          ) : (
            <div style={{
              flex: 1,
              height: '22px',
              background: 'rgba(255, 200, 0, 0.2)',
              border: '1px solid #ffc800',
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.6rem',
              color: '#ffc800',
            }}>
              ⏳ Waiting...
            </div>
          )}
        </div>
      )}

      <div className={styles.simpleTextArea}>
        {/* Text display with confirmed + pending preview */}
        <div className={styles.simpleTextbox}>
          {confirmedText || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>{placeholderText}</span>}

          {/* Pending text preview in gray */}
          {showPending && (
            <span style={{
              color: '#888',
              opacity: 0.6,
              fontStyle: 'italic',
              marginLeft: confirmedText ? '0.5ch' : '0'
            }}>
              {pendingText}
            </span>
          )}

          {/* Processing indicator */}
          {isRecording && !pendingText && confirmedText && (
            <span style={{
              color: '#00ff41',
              opacity: 0.5,
              animation: 'pulse 1.5s infinite',
              marginLeft: '0.5ch'
            }}>
              ●
            </span>
          )}
        </div>

        {/* Live indicators - HIDDEN ON MOBILE, only show recording status */}
        {(isRecording || isInitializing) && (
          <div className={styles.liveIndicators} style={{
            display: window.innerWidth <= 768 ? 'none' : 'flex'
          }}>
            {/* Initialization indicator */}
            {isInitializing && !dual.webSpeechText && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                background: 'rgba(255, 200, 0, 0.2)',
                border: '1px solid #ffc800',
                borderRadius: '4px',
              }}>
                <span style={{ fontSize: '0.8rem', color: '#ffc800' }}>⏳ Initializing Web Speech...</span>
              </div>
            )}

            {/* System status */}
            <div style={{ display: 'flex', gap: '10px', fontSize: '0.75rem' }}>
              <span style={{
                padding: '4px 8px',
                background: dual.webSpeechText ? 'rgba(255, 200, 0, 0.2)' : 'rgba(100, 100, 100, 0.2)',
                border: `1px solid ${dual.webSpeechText ? '#ffc800' : '#666'}`,
                color: dual.webSpeechText ? '#ffc800' : '#666',
              }}>
                🎤 Web Speech {dual.webSpeechText ? '✓' : isInitializing ? '⏳' : '○'}
              </span>
              <span style={{
                padding: '4px 8px',
                background: dual.deepgramText ? 'rgba(0, 150, 255, 0.2)' : 'rgba(100, 100, 100, 0.2)',
                border: `1px solid ${dual.deepgramText ? '#0096ff' : '#666'}`,
                color: dual.deepgramText ? '#0096ff' : '#666',
              }}>
                🌐 Deepgram {dual.deepgramText ? '✓' : '○'}
              </span>
              {dual.isRefining && (
                <span style={{
                  padding: '4px 8px',
                  background: 'rgba(0, 255, 65, 0.2)',
                  border: '1px solid #00ff41',
                  color: '#00ff41',
                  animation: 'pulse 2s infinite',
                }}>
                  🧠 Claude ⚙️
                </span>
              )}
            </div>
          </div>
        )}

        {/* Last update indicator */}
        {lastUpdate && isRecording && (
          <div style={{
            position: 'absolute',
            bottom: '15px',
            left: '15px',
            padding: '8px 12px',
            background: 'rgba(0, 0, 0, 0.9)',
            border: '1px solid rgba(0, 255, 65, 0.3)',
            fontSize: '0.7rem',
            opacity: 0.8,
          }}>
            Last update: {
              lastUpdate.source === 'web-speech' ? '🎤 Web Speech' :
              lastUpdate.source === 'deepgram' ? '🌐 Deepgram' :
              '🧠 Claude'
            } • {new Date(lastUpdate.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>

      <div className={styles.simpleControls}>
        <button
          onClick={toggleRecording}
          className={`${styles.simpleRecordButton} ${isRecording ? styles.recording : ''}`}
          disabled={!neural.isEngineInitialized || isInitializing}
        >
          {isInitializing ? (
            '⏳ INICIANDO...'
          ) : isRecording ? (
            <>
              ⏹ PARAR
              {showPending && <span style={{ fontSize: '0.75rem', marginLeft: '6px', opacity: 0.8 }}>● Procesando...</span>}
            </>
          ) : (
            '🎤 GRABAR'
          )}
        </button>

        <button
          onClick={() => copyToClipboard(confirmedText)}
          className={styles.simpleCopyButton}
          disabled={!confirmedText}
        >
          {copied ? '✓ COPIADO' : '📋 COPIAR'}
        </button>
      </div>

      <div className={styles.simpleShortcuts}>
        <span>SPACE: Record</span>
        <span>ESC: Stop</span>
        <span>⚡ Simple mode - instant transcription with dual verification</span>
      </div>

      {dual.error && (
        <div className={styles.simpleError}>⚠️ {dual.error}</div>
      )}
    </div>
  );
};
