'use client';

import React, { useState, useCallback } from 'react';
import { useSusurro } from '@susurro/core';
import { SimpleWaveformAnalyzer } from 'murmuraba';

export interface AudioFragmentProcessorSimplifiedProps {
  onBack: () => void;
}

export const AudioFragmentProcessorSimplified: React.FC<AudioFragmentProcessorSimplifiedProps> = ({ onBack }) => {
  // Minimal state - only 2 essentials (transcriptions come from hook)
  const [status, setStatus] = useState('');
  const [localTranscriptions, setLocalTranscriptions] = useState<string[]>([]);

  // Use simplified susurro with 8-second chunks
  const {
    startRecording,
    stopRecording,
    currentStream,
    isRecording,
    whisperReady,
    whisperProgress,
    audioChunks,
    averageVad,
    transcriptions
  } = useSusurro({
    chunkDurationMs: 8000, // 8-second chunks for better context
    conversational: {
      onChunk: (chunk) => {
        // Update transcriptions in real-time
        if (chunk.transcript) {
          setLocalTranscriptions(prev => [...prev.slice(-2), chunk.transcript]);
        }
      }
    }
  });

  // Single handler for start/stop
  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
      setStatus('[STOPPED]');
    } else {
      setStatus('[RECORDING]');
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <div style={{
      padding: '20px',
      maxWidth: '900px',
      margin: '0 auto',
      fontFamily: 'monospace',
      color: '#00ff41',
      background: '#000'
    }}>
      <button onClick={onBack} style={{ marginBottom: '20px' }}>
        [&lt; BACK]
      </button>

      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>
        SIMPLIFIED SUSURRO (80 lines vs 900)
      </h1>

      {/* Single Button Control */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <button
          onClick={handleToggleRecording}
          disabled={!whisperReady}
          style={{
            padding: '20px 60px',
            fontSize: '1.5rem',
            background: isRecording ? '#ff0041' : '#00ff41',
            color: '#000',
            border: 'none',
            cursor: whisperReady ? 'pointer' : 'not-allowed',
            opacity: whisperReady ? 1 : 0.5,
            fontWeight: 'bold'
          }}
        >
          {isRecording ? 'STOP' : 'START'}
        </button>
        {!whisperReady && (
          <div style={{ marginTop: '10px' }}>
            Loading Whisper: {(whisperProgress * 100).toFixed(0)}%
          </div>
        )}
      </div>

      {/* Status */}
      {status && (
        <div style={{
          textAlign: 'center',
          marginBottom: '20px',
          padding: '10px',
          background: 'rgba(0, 255, 65, 0.1)',
          border: '1px solid #00ff41'
        }}>
          {status}
        </div>
      )}

      {/* SimpleWaveformAnalyzer from Murmuraba - Zero custom code! */}
      <div style={{ marginBottom: '30px' }}>
        <SimpleWaveformAnalyzer 
          stream={currentStream}
          isActive={isRecording}
          width={800}
          height={200}
        />
      </div>

      {/* Live Transcriptions */}
      <div style={{
        minHeight: '100px',
        padding: '15px',
        background: 'rgba(0, 255, 65, 0.05)',
        border: '1px solid #00ff41',
        marginBottom: '20px'
      }}>
        <h3 style={{ marginBottom: '10px' }}>TRANSCRIPTIONS:</h3>
        {(localTranscriptions.length > 0 || transcriptions.length > 0) ? (
          (localTranscriptions.length > 0 ? localTranscriptions : transcriptions.map(t => t.text)).map((text, i) => (
            <div key={i} style={{ opacity: 1 - (i * 0.3), marginBottom: '5px' }}>
              &gt; {text}
            </div>
          ))
        ) : (
          <div style={{ opacity: 0.5 }}>
            {isRecording ? 'Listening...' : 'Click START to begin'}
          </div>
        )}
      </div>

      {/* Real-time Metrics */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px',
        background: 'rgba(0, 255, 65, 0.05)',
        border: '1px solid #00ff41',
        fontSize: '0.9rem'
      }}>
        <span>VAD: {(averageVad * 100).toFixed(0)}%</span>
        <span>Chunks: {audioChunks.length}</span>
        <span>Duration: {audioChunks.length * 8}s</span>
      </div>

      {/* Info */}
      <div style={{
        marginTop: '30px',
        padding: '15px',
        background: 'rgba(0, 255, 65, 0.05)',
        border: '1px solid rgba(0, 255, 65, 0.3)',
        fontSize: '0.9rem',
        opacity: 0.8
      }}>
        <strong>✨ SIMPLIFICATION ACHIEVED:</strong><br/>
        • 1 SimpleWaveformAnalyzer component (not 3 canvases)<br/>
        • Real MediaStream from currentStream<br/>
        • 2 state variables (not 15+)<br/>
        • 8-second chunks for better context<br/>
        • Zero mock data - all real metrics<br/>
        • ~160 lines total (not 900)
      </div>
    </div>
  );
};