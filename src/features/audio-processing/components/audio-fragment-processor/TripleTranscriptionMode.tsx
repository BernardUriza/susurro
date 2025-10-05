/**
 * TripleTranscriptionMode
 *
 * Main transcription UI using the triple stream system
 * All logic is in @susurro/core, this is just the UI shell
 */

import React, { useCallback, useState } from 'react';
import { useTripleTranscription, AUDIO_CONFIG } from '@susurro/core';
import { SimpleWaveformAnalyzer } from 'murmuraba';
import { TripleTranscriptionPanel } from './TripleTranscriptionPanel';
import { useNeural } from '../../../../contexts/NeuralContext';
import styles from './audio-fragment-processor.module.css';

export interface TripleTranscriptionModeProps {
  onLog?: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
}

export const TripleTranscriptionMode: React.FC<TripleTranscriptionModeProps> = ({ onLog }) => {
  const neural = useNeural();

  // Triple transcription hook from core package
  const triple = useTripleTranscription({
    language: 'es-ES',
    enableWebSpeech: true,
    enableWhisper: true,
    enableDeepgram: true,
    autoRefine: true,
    refineDebounceMs: 500,
    claudeConfig: {
      enabled: true,
      apiUrl: 'http://localhost:8001/refine',
    },
  });

  // UI states
  const [isRecording, setIsRecording] = useState(false);
  const [visualizerStream, setVisualizerStream] = useState<MediaStream | null>(null);

  // Start recording with all 3 streams
  const startRecording = useCallback(async () => {
    if (!neural.isEngineInitialized) {
      await neural.initializeAudioEngine();
    }

    setIsRecording(true);

    // Create visualizer stream
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      setVisualizerStream(micStream);
      onLog?.('🎨 Visualizer stream created', 'info');
    } catch (err) {
      onLog?.('⚠️ Failed to create visualizer stream', 'warning');
    }

    // Start triple transcription (WebSpeech + Whisper + Deepgram)
    await triple.startTranscription();

    // Start neural recording for audio chunks
    await neural.startStreamingRecording(
      async (chunk) => {
        // Send chunk to Deepgram via triple.addDeepgramChunk
        if (chunk.transcriptionText && triple.addDeepgramChunk) {
          triple.addDeepgramChunk(chunk);
        }

        // TODO: Send chunk to Whisper via triple.addWhisperChunk
        // if (chunk.audioBlob && triple.addWhisperChunk) {
        //   const whisperResult = await processWithWhisper(chunk.audioBlob);
        //   triple.addWhisperChunk(whisperResult.text);
        // }
      },
      {
        chunkDuration: AUDIO_CONFIG.RECORDING.DEFAULT_CHUNK_DURATION_MS / 1000,
        vadThreshold: AUDIO_CONFIG.RECORDING.VAD_CUT_THRESHOLD,
        enableRealTimeTranscription: true,
        enableNoiseReduction: true,
      }
    );

    onLog?.('🎤 Recording started with 3 streams', 'success');
  }, [neural, triple, onLog]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    // Stop in correct order
    await neural.stopStreamingRecording();
    await triple.stopTranscription();

    // Cleanup visualizer
    if (visualizerStream) {
      visualizerStream.getTracks().forEach((track) => track.stop());
      setVisualizerStream(null);
    }

    setIsRecording(false);
    onLog?.('✅ Recording stopped', 'success');
  }, [neural, triple, visualizerStream, onLog]);

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
        onLog?.('📋 Copied to clipboard', 'success');
      });
    },
    [onLog]
  );

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  return (
    <div className={styles.tripleMode}>
      {/* Waveform header */}
      {isRecording && visualizerStream && (
        <div className={styles.waveformHeader}>
          <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>🎙️</span>
          <div style={{ height: '24px', width: '1290px', overflow: 'hidden' }}>
            <div style={{ transform: 'scale(0.92)', transformOrigin: 'center center' }}>
              <SimpleWaveformAnalyzer stream={visualizerStream} isActive={isRecording} />
            </div>
          </div>
        </div>
      )}

      {/* Triple Transcription Panels */}
      <TripleTranscriptionPanel
        webSpeechText={triple.webSpeechText}
        whisperText={triple.whisperText}
        deepgramText={triple.deepgramText}
        refinedText={triple.refinedText}
        isRecording={isRecording}
      />

      {/* Controls */}
      <div className={styles.tripleControls}>
        <button
          onClick={toggleRecording}
          className={`${styles.recordButton} ${isRecording ? styles.recording : ''}`}
          disabled={!neural.isEngineInitialized}
        >
          {isRecording ? '⏹ PARAR' : '🎤 GRABAR'}
          {triple.isRefining && (
            <span style={{ fontSize: '0.75rem', marginLeft: '6px', opacity: 0.8 }}>
              ● Refining...
            </span>
          )}
        </button>

        <button
          onClick={() => copyToClipboard(triple.refinedText)}
          className={styles.copyButton}
          disabled={!triple.refinedText}
        >
          📋 COPIAR
        </button>
      </div>

      {/* Shortcuts */}
      <div className={styles.shortcuts}>
        <span>SPACE: Record</span>
        <span>ESC: Stop</span>
        <span>⚡ Triple mode - 3 engines for maximum accuracy</span>
      </div>

      {/* Errors */}
      {triple.error && (
        <div className={styles.error}>⚠️ {triple.error}</div>
      )}
    </div>
  );
};
