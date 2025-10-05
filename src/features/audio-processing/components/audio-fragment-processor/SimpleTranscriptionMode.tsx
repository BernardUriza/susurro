/**
 * SimpleTranscriptionMode - Clean, productive transcription UI
 * Extracted from AudioFragmentProcessor for better code organization
 */

import React, { useCallback, useState, useEffect } from 'react';
import type { StreamingSusurroChunk } from '@susurro/core';
import {
  useDualTranscription,
  useTranscriptionWorker,
  useAudioWorker,
  AUDIO_CONFIG,
} from '@susurro/core';
import { SimpleWaveformAnalyzer } from 'murmuraba';
import { useNeural } from '../../../../contexts/NeuralContext';
import styles from './audio-fragment-processor.module.css';

interface SimpleTranscriptionModeProps {
  onLog?: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
  useWorkerForAudio?: boolean; // EXPERIMENTAL: Move RNNoise to worker to prevent UI blocking
}

export const SimpleTranscriptionMode: React.FC<SimpleTranscriptionModeProps> = ({
  onLog,
  useWorkerForAudio = false, // Disabled by default - enable with useWorkerForAudio={true}
}) => {
  const neural = useNeural();

  // Separate stream for waveform visualization (raw microphone audio)
  const [visualizerStream, setVisualizerStream] = useState<MediaStream | null>(null);

  // EXPERIMENTAL: Audio worker for non-blocking RNNoise processing
  const audioWorker = useAudioWorker({
    sampleRate: 48000,
    channelCount: 1,
    denoiseStrength: 0.3,
    vadThreshold: 0.2,
  });

  // Web Worker for non-blocking chunk processing
  const worker = useTranscriptionWorker({
    claudeConfig: {
      enabled: true,
      apiUrl: 'http://localhost:8001/refine',
    },
  });

  // Dual transcription hook
  const dual = useDualTranscription({
    language: 'es-ES',
    autoRefine: false, // Disable auto-refine, we'll use worker
    claudeConfig: {
      enabled: false, // Worker handles Claude
      apiUrl: 'http://localhost:8001/refine',
    },
  });

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refinedTextFromWorker, setRefinedTextFromWorker] = useState('');
  const [lastUpdate, setLastUpdate] = useState<{
    source: 'web-speech' | 'deepgram' | 'claude';
    text: string;
    timestamp: number;
  } | null>(null);
  const deepgramChunksRef = React.useRef<string[]>([]);

  // NEW: Preserve final transcription when stopping
  const [finalTranscription, setFinalTranscription] = useState('');

  // Setup transcription worker event handlers
  useEffect(() => {
    if (!worker.isReady) return;

    worker.onTextRefined = (refinedText) => {
      setRefinedTextFromWorker(refinedText);
      setLastUpdate({
        source: 'claude',
        text: refinedText,
        timestamp: Date.now(),
      });
      onLog?.('🧠 Claude refined text (via worker)', 'success');
    };

    worker.onError = (error) => {
      onLog?.(`Transcription worker error: ${error}`, 'error');
    };
  }, [worker.isReady, onLog]);

  // Setup audio worker event handlers (if enabled)
  useEffect(() => {
    if (!useWorkerForAudio || !audioWorker.isReady) return;

    audioWorker.onAudioProcessed = (chunk) => {
      // Audio processed in worker - no UI blocking!
      // This is where we'd handle processed audio chunks
      console.log('[AudioWorker] Processed chunk:', {
        vadScore: chunk.vadScore,
        isVoiceActive: chunk.isVoiceActive,
        rms: chunk.rms,
      });
    };

    audioWorker.onError = (error) => {
      onLog?.(`Audio worker error: ${error}`, 'error');
    };

    onLog?.('⚡ Audio worker ready - RNNoise will not block UI', 'success');
  }, [useWorkerForAudio, audioWorker.isReady, onLog]);

  // Start recording with dual transcription
  const startRecording = useCallback(async () => {
    // Show initializing state immediately for user feedback
    setIsInitializing(true);

    if (!neural.isEngineInitialized) {
      await neural.initializeAudioEngine();
    }

    setIsRecording(true);
    deepgramChunksRef.current = [];
    setFinalTranscription(''); // Clear previous session
    dual.resetTranscription();
    dual.startTranscription();

    // Create separate stream for waveform visualizer (raw microphone audio)
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, // Raw audio for visualization
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      setVisualizerStream(micStream);
      console.log('🎨 [Visualizer] Created raw microphone stream for waveform');
    } catch (err) {
      console.warn('⚠️ [Visualizer] Failed to create visualizer stream:', err);
    }

    // Clear initializing state after a short delay (Web Speech should have started by then)
    setTimeout(() => setIsInitializing(false), 500);

    await neural.startStreamingRecording(
      async (chunk: StreamingSusurroChunk) => {
        // Send ALL chunks to Deepgram, not just voice-active ones
        if (chunk.transcriptionText?.trim()) {
          deepgramChunksRef.current.push(chunk.transcriptionText);
          dual.addDeepgramChunk?.(chunk);

          // WORKER-BASED REFINEMENT (non-blocking!)
          const webSpeechCurrent = dual.webSpeechText || '';
          const deepgramCurrent = deepgramChunksRef.current.join(' ');

          if ((webSpeechCurrent || deepgramCurrent) && worker.isReady) {
            // Send to worker for processing (doesn't block UI!)
            worker.refineText(webSpeechCurrent, deepgramCurrent);
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
        // UNIFIED: 20 seconds minimum, cut at first VAD=0 after 20 sec
        chunkDuration: AUDIO_CONFIG.RECORDING.DEFAULT_CHUNK_DURATION_MS / 1000, // 20 segundos
        vadThreshold: AUDIO_CONFIG.RECORDING.VAD_CUT_THRESHOLD, // 0.0 - solo silencio total
        enableRealTimeTranscription: true,
        enableNoiseReduction: true,
      }
    );

    // Debug: Check stream state after recording starts
    setTimeout(() => {
      const streamDebug = {
        exists: !!neural.currentStream,
        id: neural.currentStream?.id,
        totalTracks: neural.currentStream?.getTracks().length || 0,
        audioTracks: neural.currentStream?.getAudioTracks().length || 0,
        videoTracks: neural.currentStream?.getVideoTracks().length || 0,
        active: neural.currentStream?.active,
        audioTrackEnabled: neural.currentStream?.getAudioTracks()[0]?.enabled,
        audioTrackMuted: neural.currentStream?.getAudioTracks()[0]?.muted,
        audioTrackReadyState: neural.currentStream?.getAudioTracks()[0]?.readyState,
      };
      console.log('🔍 [STREAM DEBUG]', streamDebug);
    }, 100);

    onLog?.('🎤 Recording started', 'success');
  }, [neural, dual, onLog, worker]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    try {
      // PRESERVE TRANSCRIPTION BEFORE STOPPING
      const currentText = refinedTextFromWorker || dual.deepgramText || dual.webSpeechText || '';
      if (currentText) {
        setFinalTranscription(currentText);
        onLog?.(`💾 Preserved transcription: ${currentText.substring(0, 50)}...`, 'success');
      }

      // Stop and cleanup visualizer stream
      if (visualizerStream) {
        visualizerStream.getTracks().forEach((track) => track.stop());
        setVisualizerStream(null);
        console.log('🧹 [Visualizer] Cleaned up raw microphone stream');
      }

      setIsInitializing(false); // Clear any lingering initialization state

      // Stop transcription first
      await dual.stopTranscription();

      // Stop streaming recording (this will stop MediaRecorder and release audio resources)
      await neural.stopStreamingRecording();

      // Wait a bit for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update state AFTER all cleanup is complete
      setIsRecording(false);

      // Don't clear deepgramChunksRef immediately - let UI update first
      onLog?.('✅ Recording stopped and resources released', 'success');
    } catch (error) {
      console.error('Error stopping recording:', error);
      // Even if there's an error, update the state
      setIsRecording(false);
      setIsInitializing(false);
      onLog?.('⚠️ Recording stopped with errors', 'warning');
    }
  }, [neural, dual, onLog, refinedTextFromWorker, visualizerStream]);

  // Toggle recording
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Copy to clipboard
  const copyToClipboard = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        onLog?.('📋 Copied to clipboard', 'success');
        setTimeout(() => setCopied(false), 2000);
      });
    },
    [onLog]
  );

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

  // REAL-TIME TEXT FLOW:
  // 1. Web Speech appears instantly (yellow/gold color)
  // 2. Deepgram refines it after processing (blue color)
  // 3. Claude polishes both (green color)
  // 4. After STOP: show final preserved text

  const liveText = isRecording ? dual.webSpeechText || '' : ''; // Real-time Web Speech
  const confirmedText = isRecording ? refinedTextFromWorker || '' : finalTranscription; // Claude refined
  const deepgramPending = isRecording ? dual.deepgramText || '' : ''; // Deepgram processing

  // Show refinement status (reserved for future use)
  // const showDeepgramDiff =
  //   deepgramPending &&
  //   liveText &&
  //   deepgramPending !== liveText &&
  //   !deepgramPending.includes(liveText);

  // Show processing indicator when worker is refining
  const isRefining = worker.isProcessing;

  // Placeholder text based on state
  const placeholderText = isInitializing
    ? 'Iniciando reconocimiento...'
    : isRecording
      ? 'Escuchando... habla ahora'
      : 'Presiona SPACE para grabar';

  return (
    <div className={styles.simpleMode}>
      {/* Waveform header - ultra-compact minimal design */}
      {isRecording && (
        <div
          style={{
            padding: '1px 8px',
            background: 'rgba(0, 0, 0, 0.2)',
            borderBottom: '1px solid rgba(0, 255, 65, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>🎙️</span>
          {/* Render SimpleWaveformAnalyzer with raw microphone stream */}
          {visualizerStream ? (
            <div style={{ height: '12px', width: '120px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ transform: 'scale(0.06)', transformOrigin: 'center center', width: '2000px', height: '200px' }}>
                <SimpleWaveformAnalyzer stream={visualizerStream} isActive={isRecording} />
              </div>
            </div>
          ) : (
            <div
              style={{
                height: '12px',
                width: '120px',
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.45rem',
                color: '#ffc800',
                opacity: 0.5,
              }}
            >
              ⏳ Loading...
            </div>
          )}
        </div>
      )}

      <div className={styles.simpleTextArea}>
        {/* Real-time text display */}
        <div className={styles.simpleTextbox}>
          {/* Priority: Claude refined > Web Speech live > Saved final text > Placeholder */}
          {confirmedText ? (
            // Show Claude refined text (green) when available
            <span style={{ color: '#00ff41' }}>{confirmedText}</span>
          ) : liveText ? (
            // Show Web Speech live text (yellow/gold) during recording
            <span style={{ color: '#ffc800' }}>{liveText}</span>
          ) : (
            // Placeholder when not recording and no saved text
            <span style={{ opacity: 0.5, fontStyle: 'italic' }}>{placeholderText}</span>
          )}

          {/* Recording indicator */}
          {isRecording && (liveText || confirmedText) && (
            <span
              style={{
                color: '#00ff41',
                opacity: 0.5,
                animation: 'pulse 1.5s infinite',
                marginLeft: '0.5ch',
              }}
            >
              ●
            </span>
          )}
        </div>

        {/* Live indicators - HIDDEN ON MOBILE, only show recording status */}
        {(isRecording || isInitializing) && (
          <div
            className={styles.liveIndicators}
            style={{
              display: window.innerWidth <= 768 ? 'none' : 'flex',
            }}
          >
            {/* Initialization indicator */}
            {isInitializing && !dual.webSpeechText && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  background: 'rgba(255, 200, 0, 0.2)',
                  border: '1px solid #ffc800',
                  borderRadius: '4px',
                }}
              >
                <span style={{ fontSize: '0.8rem', color: '#ffc800' }}>
                  ⏳ Initializing Web Speech...
                </span>
              </div>
            )}

            {/* System status */}
            <div style={{ display: 'flex', gap: '10px', fontSize: '0.75rem' }}>
              <span
                style={{
                  padding: '4px 8px',
                  background: dual.webSpeechText
                    ? 'rgba(255, 200, 0, 0.2)'
                    : 'rgba(100, 100, 100, 0.2)',
                  border: `1px solid ${dual.webSpeechText ? '#ffc800' : '#666'}`,
                  color: dual.webSpeechText ? '#ffc800' : '#666',
                }}
              >
                🎤 Web Speech {dual.webSpeechText ? '✓' : isInitializing ? '⏳' : '○'}
              </span>
              <span
                style={{
                  padding: '4px 8px',
                  background: dual.deepgramText
                    ? 'rgba(0, 150, 255, 0.2)'
                    : 'rgba(100, 100, 100, 0.2)',
                  border: `1px solid ${dual.deepgramText ? '#0096ff' : '#666'}`,
                  color: dual.deepgramText ? '#0096ff' : '#666',
                }}
              >
                🌐 Deepgram {dual.deepgramText ? '✓' : '○'}
              </span>
              {dual.isRefining && (
                <span
                  style={{
                    padding: '4px 8px',
                    background: 'rgba(0, 255, 65, 0.2)',
                    border: '1px solid #00ff41',
                    color: '#00ff41',
                    animation: 'pulse 2s infinite',
                  }}
                >
                  🧠 Claude ⚙️
                </span>
              )}
            </div>
          </div>
        )}

        {/* Last update indicator */}
        {lastUpdate && isRecording && (
          <div
            style={{
              position: 'absolute',
              bottom: '15px',
              left: '15px',
              padding: '8px 12px',
              background: 'rgba(0, 0, 0, 0.9)',
              border: '1px solid rgba(0, 255, 65, 0.3)',
              fontSize: '0.7rem',
              opacity: 0.8,
            }}
          >
            Last update:{' '}
            {lastUpdate.source === 'web-speech'
              ? '🎤 Web Speech'
              : lastUpdate.source === 'deepgram'
                ? '🌐 Deepgram'
                : '🧠 Claude'}{' '}
            • {new Date(lastUpdate.timestamp).toLocaleTimeString()}
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
              {(deepgramPending || isRefining) && (
                <span style={{ fontSize: '0.75rem', marginLeft: '6px', opacity: 0.8 }}>
                  ● {isRefining ? 'Claude...' : 'Deepgram...'}
                </span>
              )}
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

      {dual.error && <div className={styles.simpleError}>⚠️ {dual.error}</div>}
    </div>
  );
};
