'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSusurro } from '@susurro/core';
import type { StreamingSusurroChunk, CompleteAudioResult } from '@susurro/core';

// Interface for visualization metrics
interface VisualizationMetrics {
  vad: number;
  duration: number;
  latency: number;
  isHealthy: boolean;
}

// Interface for real-time waveform data
interface WaveformData {
  samples: number[];
  timestamp: number;
}

export const SimplifiedSusurro: React.FC = () => {
  // Minimal state management - React 19 best practices
  const [isActive, setIsActive] = useState(false);
  const [transcriptions, setTranscriptions] = useState<string[]>([]);
  const [currentWaveform, setCurrentWaveform] = useState<WaveformData>({
    samples: new Array(100).fill(0),
    timestamp: 0,
  });
  const [metrics, setMetrics] = useState<VisualizationMetrics>({
    vad: 0,
    duration: 0,
    latency: 0,
    isHealthy: true,
  });
  const [error, setError] = useState<string | null>(null);

  // Consolidated useSusurro hook - all functionality in one place
  const {
    startStreamingRecording,
    stopStreamingRecording,
    processAndTranscribeFile,
    whisperReady,
    initializeAudioEngine,
    isEngineInitialized,
  } = useSusurro({
    chunkDurationMs: 3000, // 3-second chunks for optimal balance
    whisperConfig: {
      language: 'auto', // Auto-detect language
    },
  });

  // Canvas reference for waveform visualization
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  // Convert audio buffer to waveform visualization data
  const processAudioBuffer = useCallback((buffer: ArrayBuffer): number[] => {
    try {
      const float32Array = new Float32Array(buffer);
      const downsampleRate = Math.max(1, Math.floor(float32Array.length / 100));
      const waveform: number[] = [];

      for (let i = 0; i < float32Array.length; i += downsampleRate) {
        waveform.push(Math.max(-1, Math.min(1, float32Array[i])));
        if (waveform.length >= 100) break;
      }

      // Ensure exactly 100 samples
      while (waveform.length < 100) {
        waveform.push(0);
      }

      return waveform;
    } catch (error) {
      console.warn('Failed to process audio buffer:', error);
      return new Array(100).fill(0);
    }
  }, []);

  // Draw waveform on canvas with requestAnimationFrame
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;

    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, width, height);

    // Draw waveform
    ctx.strokeStyle = '#00ff41';
    ctx.lineWidth = 2;
    ctx.beginPath();

    currentWaveform.samples.forEach((sample, index) => {
      const x = (index / currentWaveform.samples.length) * width;
      const y = height / 2 + ((sample * height) / 2) * 0.8;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Add glow effect
    ctx.shadowColor = '#00ff41';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Continue animation
    animationFrameRef.current = requestAnimationFrame(drawWaveform);
  }, [currentWaveform]);

  // Start animation when waveform changes
  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(drawWaveform);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [drawWaveform]);

  // Single action handler with comprehensive error handling
  const handleAction = useCallback(async () => {
    try {
      setError(null);

      if (!isActive) {
        // Ensure engines are ready before starting
        if (!isEngineInitialized) {
          await initializeAudioEngine();
        }

        if (!whisperReady) {
          throw new Error('Whisper model not ready. Please wait for initialization.');
        }

        // Start streaming with real-time chunk processing
        await startStreamingRecording(
          (chunk: StreamingSusurroChunk) => {
            try {
              // Update transcription with latest chunks (keep last 5)
              if (chunk.transcriptionText) {
                setTranscriptions((prev) => {
                  const newTranscriptions = [...prev.slice(-4), chunk.transcriptionText];
                  return newTranscriptions;
                });
              }

              // Update real-time metrics
              setMetrics({
                vad: chunk.vadScore || 0,
                duration: chunk.timestamp ? chunk.timestamp / 1000 : 0,
                latency: chunk.processingTime || 0,
                isHealthy: (chunk.processingTime || 0) < 500, // Healthy if under 500ms
              });

              // Process and update waveform visualization
              if (chunk.audioBuffer) {
                const waveformSamples = processAudioBuffer(chunk.audioBuffer);
                setCurrentWaveform({
                  samples: waveformSamples,
                  timestamp: Date.now(),
                });
              }
            } catch (chunkError) {
              console.warn('Error processing chunk:', chunkError);
              // Continue operation even if individual chunk fails
            }
          },
          {
            chunkDuration: 3, // 3-second chunks
            vadThreshold: 0.3, // More sensitive for better UX
            enableRealTimeTranscription: true,
            enableNoiseReduction: true,
          }
        );

        setIsActive(true);
      } else {
        // Stop recording and get final results
        const finalChunks = await stopStreamingRecording();
        setIsActive(false);

        // Optional: Process any remaining chunks
        console.log(`Recording complete. Processed ${finalChunks.length} chunks.`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Operation failed';
      setError(errorMessage);
      setIsActive(false);
      console.error('Action failed:', error);
    }
  }, [
    isActive,
    isEngineInitialized,
    whisperReady,
    initializeAudioEngine,
    startStreamingRecording,
    stopStreamingRecording,
    processAudioBuffer,
  ]);

  // File drag-and-drop handler with comprehensive processing
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();

      try {
        setError(null);
        const file = e.dataTransfer.files[0];

        if (!file) {
          throw new Error('No file provided');
        }

        // Validate file type
        if (!file.type.startsWith('audio/')) {
          throw new Error('Please drop an audio file (.wav, .mp3, .m4a, etc.)');
        }

        // File size validation (e.g., max 50MB)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
          throw new Error('File too large. Maximum size is 50MB.');
        }

        // Process file with comprehensive error handling
        const result: CompleteAudioResult = await processAndTranscribeFile(file);

        // Update UI with file processing results
        setTranscriptions([result.transcriptionText]);
        setMetrics({
          vad: result.vadAnalysis.averageVad,
          duration: result.metadata.duration,
          latency: result.processingTime,
          isHealthy: result.processingTime < 5000, // Healthy if under 5 seconds
        });

        // Generate waveform from processed audio
        if (result.processedAudioUrl) {
          try {
            const response = await fetch(result.processedAudioUrl);
            const arrayBuffer = await response.arrayBuffer();
            const waveformSamples = processAudioBuffer(arrayBuffer);
            setCurrentWaveform({
              samples: waveformSamples,
              timestamp: Date.now(),
            });
          } catch (waveformError) {
            console.warn('Failed to generate waveform from processed audio:', waveformError);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'File processing failed';
        setError(errorMessage);
        console.error('File drop failed:', error);
      }
    },
    [processAndTranscribeFile, processAudioBuffer]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      style={{
        width: '600px',
        margin: '50px auto',
        padding: '30px',
        background: '#000',
        border: '1px solid #00ff41',
        borderRadius: '8px',
        fontFamily: 'monospace',
        color: '#00ff41',
      }}
    >
      {/* Title */}
      <h1
        style={{
          textAlign: 'center',
          fontSize: '2rem',
          marginBottom: '30px',
        }}
      >
        SUSURRO v3.0
      </h1>

      {/* Single Button */}
      <button
        onClick={handleAction}
        disabled={!whisperReady}
        style={{
          display: 'block',
          width: '200px',
          margin: '0 auto 30px',
          padding: '15px',
          fontSize: '1.2rem',
          background: isActive ? '#ff0041' : '#00ff41',
          color: '#000',
          border: 'none',
          borderRadius: '4px',
          cursor: whisperReady ? 'pointer' : 'not-allowed',
          fontWeight: 'bold',
          transition: 'all 0.3s',
        }}
      >
        {isActive ? 'STOP' : 'START'}
      </button>

      {/* Error Display */}
      {error && (
        <div
          style={{
            padding: '10px',
            background: 'rgba(255, 0, 0, 0.1)',
            border: '1px solid #ff0041',
            borderRadius: '4px',
            marginBottom: '20px',
            color: '#ff0041',
            fontSize: '0.9rem',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Live Transcription */}
      <div
        style={{
          minHeight: '120px',
          padding: '15px',
          background: 'rgba(0, 255, 65, 0.05)',
          border: '1px solid rgba(0, 255, 65, 0.3)',
          borderRadius: '4px',
          marginBottom: '20px',
        }}
      >
        <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', opacity: 0.7 }}>
          LIVE TRANSCRIPTION
        </h3>
        {transcriptions.length > 0 ? (
          transcriptions.map((text, i) => (
            <div
              key={i}
              style={{
                marginBottom: '5px',
                opacity: 1 - i * 0.2,
              }}
            >
              &gt; {text}
            </div>
          ))
        ) : (
          <div style={{ opacity: 0.5 }}>
            {isActive ? 'Listening...' : 'Click START or drop an audio file'}
          </div>
        )}
      </div>

      {/* Waveform Canvas */}
      <canvas
        ref={canvasRef}
        width={550}
        height={60}
        style={{
          width: '100%',
          height: '60px',
          marginBottom: '20px',
          borderRadius: '4px',
          background: 'rgba(0, 0, 0, 0.8)',
          border: '1px solid rgba(0, 255, 65, 0.3)',
        }}
      />

      {/* Single Line Metrics */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.9rem',
          opacity: 0.8,
        }}
      >
        <span>
          VAD:{' '}
          {Array(10)
            .fill('█')
            .map((bar, i) => (
              <span key={i} style={{ opacity: i < metrics.vad * 10 ? 1 : 0.2 }}>
                {bar}
              </span>
            ))}{' '}
          {(metrics.vad * 100).toFixed(0)}%
        </span>
        <span>{metrics.duration.toFixed(1)}s</span>
        <span
          style={{
            color: metrics.isHealthy ? '#00ff41' : '#ffff00',
          }}
        >
          {metrics.latency}ms
        </span>
      </div>

      {/* Drop Zone Indicator */}
      <div
        style={{
          marginTop: '20px',
          padding: '10px',
          background: 'rgba(0, 255, 65, 0.02)',
          border: '1px dashed rgba(0, 255, 65, 0.2)',
          borderRadius: '4px',
          textAlign: 'center',
          fontSize: '0.8rem',
          opacity: 0.5,
        }}
      >
        📁 Drop audio files here for instant processing
      </div>
    </div>
  );
};
