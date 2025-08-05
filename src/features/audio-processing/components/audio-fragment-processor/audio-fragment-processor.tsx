'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useSusurro } from '@susurro/core';
import type { CompleteAudioResult, StreamingSusurroChunk } from '@susurro/core';

export interface AudioFragmentProcessorProps {
  onBack: () => void;
}

// Simplified visualization data
interface VisualizationData {
  waveform: number[];
  vadHistory: number[];
  chunkHistory: StreamingSusurroChunk[];
  chunksProcessed: number;
}

export const AudioFragmentProcessor: React.FC<AudioFragmentProcessorProps> = ({ onBack }) => {
  // 🚀 CONSOLIDATED SUSURRO - Real-time visualization powerhouse
  const {
    // File processing
    processAndTranscribeFile,

    // Streaming recording with visualizations
    startStreamingRecording,
    stopStreamingRecording,

    // Engine status
    isEngineInitialized,
    whisperReady,
    whisperProgress,
    initializeAudioEngine,
  } = useSusurro({
    chunkDurationMs: 1000, // 1-second chunks for real-time visualization
    whisperConfig: {
      language: 'en',
    },
  });

  // Simplified UI State - No modes, everything unified
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [fileResult, setFileResult] = useState<CompleteAudioResult | null>(null);

  // Minimal visualization state
  const [visualData, setVisualData] = useState<VisualizationData>({
    waveform: new Array(100).fill(0),
    vadHistory: new Array(50).fill(0),
    chunkHistory: [],
    chunksProcessed: 0,
  });

  // Single unified canvas for all visualizations
  const unifiedCanvasRef = useRef<HTMLCanvasElement>(null);

  // 🎨 UNIFIED VISUALIZATION - Single canvas for all data
  const drawUnifiedVisualization = useCallback(() => {
    const canvas = unifiedCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;

    // Clear canvas with subtle fade effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(0, 0, width, height);

    // Draw waveform in the center
    const waveformHeight = height * 0.6;
    const waveformY = height * 0.2;

    ctx.strokeStyle = '#00ff41';
    ctx.lineWidth = 2;
    ctx.beginPath();

    visualData.waveform.forEach((value, index) => {
      const x = (index / visualData.waveform.length) * width;
      const y = waveformY + waveformHeight / 2 + value * (waveformHeight / 2);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw VAD as a simple progress bar at the bottom
    const vadHeight = 4;
    const vadY = height - vadHeight - 10;
    const currentVad = visualData.vadHistory[visualData.vadHistory.length - 1] || 0;

    // VAD background
    ctx.fillStyle = 'rgba(0, 255, 65, 0.2)';
    ctx.fillRect(10, vadY, width - 20, vadHeight);

    // VAD progress
    ctx.fillStyle = currentVad > 0.5 ? '#ffff00' : '#00ff41';
    ctx.fillRect(10, vadY, (width - 20) * currentVad, vadHeight);

    // Simple text metrics
    ctx.fillStyle = '#00ff41';
    ctx.font = '12px monospace';
    ctx.fillText(`VAD: ${(currentVad * 100).toFixed(0)}%`, 10, 15);
    ctx.fillText(`Chunks: ${visualData.chunksProcessed}`, width - 80, 15);
  }, [visualData]);

  // 🎤 STREAMING RECORDING WITH REAL-TIME VISUALIZATION
  const handleStartRecording = useCallback(async () => {
    if (!isEngineInitialized || !whisperReady) {
      if (!isEngineInitialized) {
        try {
          await initializeAudioEngine();
        } catch (error) {
          setStatus(`[ERROR] Engine initialization failed: ${error}`);
          return;
        }
      }
      return;
    }

    setIsRecording(true);
    setStatus('[REAL_TIME_VISUALIZATION_ACTIVE]');

    // Reset visualization data
    setVisualData({
      waveform: new Array(100).fill(0),
      vadHistory: new Array(50).fill(0),
      chunkHistory: [],
      chunksProcessed: 0,
    });

    // REAL-TIME CHUNK PROCESSOR
    const onChunkProcessed = (chunk: StreamingSusurroChunk) => {
      // TODO: Extract real waveform from chunk.audioBuffer
      const waveformData = new Array(100).fill(0);

      setVisualData((prev) => ({
        waveform: waveformData,
        vadHistory: [...prev.vadHistory.slice(1), chunk.vadScore],
        chunkHistory: [...prev.chunkHistory.slice(-19), chunk], // Keep last 20 chunks
        chunksProcessed: prev.chunksProcessed + 1,
      }));
    };

    try {
      await startStreamingRecording(onChunkProcessed, {
        chunkDuration: 2, // Fixed 2-second chunks
        vadThreshold: 0.2, // Sensitive for visualization
        enableRealTimeTranscription: true,
        enableNoiseReduction: true,
      });
    } catch (error) {
      setIsRecording(false);
      setStatus(`[ERROR] ${error}`);
    }
  }, [isEngineInitialized, whisperReady, initializeAudioEngine, startStreamingRecording]);

  const handleStopRecording = useCallback(async () => {
    const allChunks = await stopStreamingRecording();
    setIsRecording(false);
    setStatus(`[VISUALIZATION_COMPLETE] Processed ${allChunks.length} chunks`);
  }, [stopStreamingRecording]);

  // 📁 FILE PROCESSING WITH FULL ANALYSIS
  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file) return;

      setFileResult(null);
      setStatus('[PROCESSING_FILE_WITH_COMPLETE_ANALYSIS]');

      try {
        // ONE METHOD CALL - Everything included
        const result = await processAndTranscribeFile(file);
        setFileResult(result);

        // Update visualization with file analysis
        setVisualData((prev) => ({
          ...prev,
          waveform: new Array(100).fill(0), // TODO: Extract from result
          vadHistory: result.vadAnalysis.vadScores.slice(-50),
        }));

        setStatus(`[FILE_ANALYSIS_COMPLETE] ${result.processingTime.toFixed(0)}ms`);
      } catch (error) {
        setStatus(`[ERROR] File processing failed: ${error}`);
      }
    },
    [processAndTranscribeFile]
  );

  // Draw unified visualization using requestAnimationFrame for smooth 60fps
  useEffect(() => {
    let animationFrameId: number;

    const animate = () => {
      drawUnifiedVisualization();
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [drawUnifiedVisualization]);

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        color: '#00ff41',
        padding: '20px',
        background:
          'radial-gradient(ellipse at center, rgba(0, 20, 0, 0.9) 0%, rgba(0, 0, 0, 0.95) 100%)',
      }}
    >
      <button className="matrix-back-button" onClick={onBack}>
        [&lt; BACK_TO_MATRIX]
      </button>

      <div className="matrix-grid" />

      <div
        style={{
          maxWidth: '1200px',
          margin: '40px auto',
          background: 'rgba(0, 0, 0, 0.9)',
          border: '2px solid #00ff41',
          padding: '30px',
          backdropFilter: 'blur(15px)',
          boxShadow: '0 0 40px rgba(0, 255, 65, 0.3)',
        }}
      >
        {/* Header */}
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            fontSize: '2.5rem',
            marginBottom: '20px',
            textAlign: 'center',
            textShadow: '0 0 20px #00ff41',
            background: 'linear-gradient(45deg, #00ff41, #00cc33)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          &gt; SUSURRO_REAL_TIME_VISUALIZER &lt;
        </motion.h1>

        {/* Status */}
        {status && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`matrix-status ${status.includes('ERROR') ? 'error' : ''}`}
            style={{
              marginBottom: '20px',
              padding: '12px',
              background: status.includes('ERROR')
                ? 'rgba(255, 0, 0, 0.1)'
                : 'rgba(0, 255, 65, 0.1)',
              border: `1px solid ${status.includes('ERROR') ? '#ff0041' : '#00ff41'}`,
              textAlign: 'center',
            }}
          >
            &gt; {status}
          </motion.div>
        )}

        {/* UNIFIED VIEW - Everything in one */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Unified Visualization Canvas */}
          <div style={{ marginBottom: '30px' }}>
            <canvas
              ref={unifiedCanvasRef}
              width={800}
              height={200}
              style={{
                width: '100%',
                height: '200px',
                background: 'rgba(0, 0, 0, 0.95)',
                border: '1px solid #00ff41',
                borderRadius: '4px',
              }}
            />
          </div>

          {/* Controls */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                disabled={!isEngineInitialized || !whisperReady}
                className="matrix-button"
                style={{
                  padding: '20px 60px',
                  fontSize: '1.5rem',
                  background: isRecording ? '#ff0041' : '#00ff41',
                  border: 'none',
                  color: '#000',
                  opacity: !isEngineInitialized || !whisperReady ? 0.5 : 1,
                  cursor: 'pointer',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  display: 'block',
                  margin: '0 auto',
                }}
              >
                {isRecording ? 'STOP' : 'START'}
              </button>

              {!whisperReady && (
                <div style={{ marginTop: '10px', fontSize: '0.9rem' }}>
                  [LOADING_WHISPER: {(whisperProgress * 100).toFixed(0)}%]
                </div>
              )}
            </div>
          </div>

          {/* Live Transcription */}
          {visualData.chunkHistory.length > 0 && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.95)',
                border: '1px solid #00ff41',
                padding: '15px',
                maxHeight: '150px',
                overflow: 'auto',
                borderRadius: '4px',
                marginTop: '20px',
              }}
            >
              {visualData.chunkHistory.slice(-3).map((chunk) => (
                <div key={chunk.id} style={{ marginBottom: '5px', opacity: 0.9 }}>
                  {chunk.transcriptionText || '...'}
                </div>
              ))}
            </div>
          )}

          {/* Drag & Drop Zone */}
          <div
            style={{
              margin: '20px 0',
              padding: '20px',
              border: '2px dashed rgba(0, 255, 65, 0.3)',
              borderRadius: '4px',
              textAlign: 'center',
              fontSize: '0.9rem',
              opacity: 0.7,
            }}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file && file.type.startsWith('audio/')) {
                handleFileUpload(file);
              }
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            Drop audio file here or use START button to record
          </div>

          {/* File Analysis Results - Simplified */}
          {fileResult && (
            <div
              style={{
                background: 'rgba(0, 255, 65, 0.05)',
                border: '1px solid #00ff41',
                padding: '20px',
                marginBottom: '20px',
                borderRadius: '4px',
              }}
            >
              {/* Single Audio Player */}
              <audio
                src={fileResult.processedAudioUrl}
                controls
                style={{ width: '100%', marginBottom: '15px' }}
              />

              {/* Simple Metrics Line */}
              <div style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '15px' }}>
                Duration: {fileResult.metadata.duration.toFixed(1)}s | VAD:{' '}
                {(fileResult.vadAnalysis.averageVad * 100).toFixed(0)}% | Processing:{' '}
                {fileResult.processingTime.toFixed(0)}ms
              </div>

              {/* Transcription */}
              {fileResult.transcriptionText && (
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.8)',
                    padding: '20px',
                    border: '1px solid #00ff41',
                  }}
                >
                  <h4 style={{ color: '#00ff41', marginBottom: '10px' }}>WHISPER TRANSCRIPTION:</h4>
                  <div style={{ fontSize: '1rem', lineHeight: '1.6' }}>
                    {fileResult.transcriptionText}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
