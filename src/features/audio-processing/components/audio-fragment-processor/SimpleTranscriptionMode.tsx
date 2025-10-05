/**
 * SimpleTranscriptionMode - Clean, productive transcription UI
 * Extracted from AudioFragmentProcessor for better code organization
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import type { StreamingSusurroChunk } from '@susurro/core';
import { useDualTranscription } from '@susurro/core';
import { useNeural } from '../../../../contexts/NeuralContext';
import styles from './audio-fragment-processor.module.css';

// Mini waveform component
const MiniWaveform: React.FC<{ stream: MediaStream | null }> = ({ stream }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyzerRef = useRef<AnalyserNode>();

  useEffect(() => {
    console.log('[MiniWaveform] Stream:', stream ? 'Available' : 'NULL', stream);
    if (!stream || !canvasRef.current) {
      console.log('[MiniWaveform] Not rendering - stream or canvas missing');
      return;
    }

    const audioContext = new AudioContext();
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 256;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyzer);
    analyzerRef.current = analyzer;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyzerRef.current || !ctx) return;

      animationRef.current = requestAnimationFrame(draw);
      analyzer.getByteTimeDomainData(dataArray);

      // Clear with semi-transparent black for trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00ff41';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      audioContext.close();
    };
  }, [stream]);

  if (!stream) return null;

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={40}
      style={{
        background: 'rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(0, 255, 65, 0.3)',
        borderRadius: '4px',
      }}
    />
  );
};

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

    console.log('[SimpleMode] Starting recording, current stream:', neural.currentStream);

    await neural.startStreamingRecording(
      async (chunk: StreamingSusurroChunk) => {
        console.log('[SimpleMode] Chunk received:', {
          hasText: !!chunk.transcriptionText,
          text: chunk.transcriptionText,
          isVoiceActive: chunk.isVoiceActive,
          vadScore: chunk.vadScore
        });

        // Send ALL chunks to Deepgram, not just voice-active ones
        if (chunk.transcriptionText?.trim()) {
          deepgramChunksRef.current.push(chunk.transcriptionText);
          dual.addDeepgramChunk?.(chunk);

          console.log('[SimpleMode] Deepgram chunk transcribed! Now refining with Claude...');

          // PROGRESSIVE REFINEMENT: When Deepgram returns a transcription,
          // send both Web Speech AND Deepgram to Claude for refinement
          const webSpeechCurrent = dual.webSpeechText || '';
          const deepgramCurrent = deepgramChunksRef.current.join(' ');

          if (webSpeechCurrent || deepgramCurrent) {
            // Trigger Claude refinement with both sources
            await dual.refineWithClaude(webSpeechCurrent, deepgramCurrent);

            console.log('[SimpleMode] ✨ Claude refinement complete!');
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
      if (e.code === 'Space' && e.target === document.body) {
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

  // Debug: Log deepgram text changes
  useEffect(() => {
    console.log('[SimpleMode] dual.deepgramText changed:', dual.deepgramText);
  }, [dual.deepgramText]);

  // Current text display
  const currentText = isRecording
    ? (dual.refinedText || dual.deepgramText || dual.webSpeechText)
    : (dual.refinedText || dual.deepgramText || dual.webSpeechText || '');

  // Placeholder text based on state
  const placeholderText = isInitializing
    ? 'Starting Web Speech recognition...'
    : isRecording
    ? 'Listening... speak now'
    : 'Press SPACE to start recording';

  return (
    <div className={styles.simpleMode}>
      <div className={styles.simpleTextArea}>
        <textarea
          className={styles.simpleTextbox}
          value={currentText}
          placeholder={placeholderText}
          readOnly
        />

        {/* Live indicators - redesigned */}
        {(isRecording || isInitializing) && (
          <div className={styles.liveIndicators}>
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

            {/* Mini waveform - show when we have a stream */}
            {isRecording && neural.currentStream && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>🎙️ Recording:</span>
                <MiniWaveform stream={neural.currentStream} />
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
          disabled={!neural.isEngineInitialized}
        >
          {isRecording ? '⏹ Stop (ESC)' : '🎤 Record (SPACE)'}
        </button>

        {currentText && (
          <button
            onClick={() => copyToClipboard(currentText)}
            className={styles.simpleCopyButton}
          >
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
        )}
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
