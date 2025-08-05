'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSusurro } from '@susurro/core';
import type { CompleteAudioResult, StreamingSusurroChunk } from '@susurro/core';
// import { TemporalSegmentSelector } from '../temporal-segment-selector';
import { ConversationalChatFeed } from '../conversational-chat-feed';

export interface AudioFragmentProcessorProps {
  onBack: () => void;
}

// Real-time visualization data structure
interface VisualizationData {
  waveform: number[];
  frequency: number[];
  vadHistory: number[];
  chunkHistory: StreamingSusurroChunk[];
  realTimeMetrics: {
    currentVAD: number;
    averageLatency: number;
    chunksProcessed: number;
    activeFrequency: number;
  };
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

  // UI State
  const [viewMode, setViewMode] = useState<'visualizer' | 'processor' | 'conversational'>(
    'visualizer'
  );
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [chunkDuration] = useState(2);
  const [fileResult, setFileResult] = useState<CompleteAudioResult | null>(null);

  // Visualization state
  const [visualData, setVisualData] = useState<VisualizationData>({
    waveform: new Array(100).fill(0),
    frequency: new Array(50).fill(0),
    vadHistory: new Array(50).fill(0),
    chunkHistory: [],
    realTimeMetrics: {
      currentVAD: 0,
      averageLatency: 0,
      chunksProcessed: 0,
      activeFrequency: 0,
    },
  });

  // Canvas refs for visualizations
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const frequencyCanvasRef = useRef<HTMLCanvasElement>(null);
  const vadCanvasRef = useRef<HTMLCanvasElement>(null);

  // 🎨 REAL-TIME WAVEFORM VISUALIZATION
  const drawWaveform = useCallback((canvas: HTMLCanvasElement, data: number[]) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#00ff41';
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((value, index) => {
      const x = (index / data.length) * width;
      const y = height / 2 + value * (height / 2);

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
  }, []);

  // 📊 FREQUENCY SPECTRUM VISUALIZATION
  const drawFrequency = useCallback((canvas: HTMLCanvasElement, data: number[]) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, width, height);

    const barWidth = width / data.length;

    data.forEach((value, index) => {
      const barHeight = value * height;
      const hue = value * 120 + 120; // Green to yellow based on intensity

      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.fillRect(index * barWidth, height - barHeight, barWidth - 1, barHeight);

      // Add glow effect for high values
      if (value > 0.7) {
        ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
        ctx.shadowBlur = 15;
        ctx.fillRect(index * barWidth, height - barHeight, barWidth - 1, barHeight);
        ctx.shadowBlur = 0;
      }
    });
  }, []);

  // 📈 VAD HISTORY VISUALIZATION
  const drawVADHistory = useCallback((canvas: HTMLCanvasElement, data: number[]) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = 'rgba(0, 255, 65, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const y = (i / 10) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw VAD line
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 3;
    ctx.beginPath();

    data.forEach((value, index) => {
      const x = (index / data.length) * width;
      const y = height - value * height;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Highlight voice activity areas
    ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
    data.forEach((value, index) => {
      if (value > 0.5) {
        const x = (index / data.length) * width;
        const barWidth = width / data.length;
        ctx.fillRect(x, 0, barWidth, height);
      }
    });
  }, []);

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
    setVisualData((prev) => ({
      ...prev,
      waveform: new Array(100).fill(0),
      frequency: new Array(50).fill(0),
      vadHistory: new Array(50).fill(0),
      chunkHistory: [],
      realTimeMetrics: {
        currentVAD: 0,
        averageLatency: 0,
        chunksProcessed: 0,
        activeFrequency: 0,
      },
    }));

    // REAL-TIME CHUNK PROCESSOR WITH VISUALIZATIONS
    const onChunkProcessed = (chunk: StreamingSusurroChunk) => {
      // TODO: Replace with real audio data from chunk.audioBuffer
      // For now, using minimal placeholder until real data integration
      const waveformData = new Array(100).fill(0);
      const frequencyData = new Array(50).fill(0);

      setVisualData((prev) => ({
        waveform: waveformData,
        frequency: frequencyData,
        vadHistory: [...prev.vadHistory.slice(1), chunk.vadScore],
        chunkHistory: [...prev.chunkHistory.slice(-19), chunk], // Keep last 20 chunks
        realTimeMetrics: {
          currentVAD: chunk.vadScore,
          averageLatency: chunk.duration / 2,
          chunksProcessed: prev.realTimeMetrics.chunksProcessed + 1,
          activeFrequency: 0, // Will be calculated from real frequency data
        },
      }));
    };

    try {
      await startStreamingRecording(onChunkProcessed, {
        chunkDuration: chunkDuration,
        vadThreshold: 0.2, // Sensitive for visualization
        enableRealTimeTranscription: true,
        enableNoiseReduction: true,
      });
    } catch (error) {
      setIsRecording(false);
      setStatus(`[ERROR] ${error}`);
    }
  }, [
    isEngineInitialized,
    whisperReady,
    initializeAudioEngine,
    startStreamingRecording,
    chunkDuration,
  ]);

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
        // TODO: Extract real waveform data from result.processedAudioUrl
        const placeholderWaveform = new Array(100).fill(0);
        const placeholderFrequency = new Array(50).fill(0);

        setVisualData((prev) => ({
          ...prev,
          waveform: placeholderWaveform,
          frequency: placeholderFrequency,
          vadHistory: result.vadAnalysis.vadScores.slice(-50),
          realTimeMetrics: {
            ...prev.realTimeMetrics,
            currentVAD: result.vadAnalysis.averageVad,
          },
        }));

        setStatus(`[FILE_ANALYSIS_COMPLETE] ${result.processingTime.toFixed(0)}ms`);
      } catch (error) {
        setStatus(`[ERROR] File processing failed: ${error}`);
      }
    },
    [processAndTranscribeFile]
  );

  // Draw visualizations using requestAnimationFrame for smooth 60fps
  useEffect(() => {
    let animationFrameId: number;

    const animate = () => {
      if (waveformCanvasRef.current) {
        drawWaveform(waveformCanvasRef.current, visualData.waveform);
      }
      if (frequencyCanvasRef.current) {
        drawFrequency(frequencyCanvasRef.current, visualData.frequency);
      }
      if (vadCanvasRef.current) {
        drawVADHistory(vadCanvasRef.current, visualData.vadHistory);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [visualData, drawWaveform, drawFrequency, drawVADHistory]);

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

        {/* View Mode Toggle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '30px',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          {['visualizer', 'processor', 'conversational'].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode as 'visualizer' | 'processor' | 'conversational')}
              className="matrix-button"
              style={{
                padding: '10px 20px',
                background: viewMode === mode ? '#00ff41' : 'rgba(0, 255, 65, 0.1)',
                color: viewMode === mode ? '#000' : '#00ff41',
                border: '2px solid #00ff41',
                cursor: 'pointer',
                textTransform: 'uppercase',
                fontWeight: 'bold',
              }}
            >
              [{mode.replace('_', '_')}]
            </button>
          ))}
        </div>

        {/* VISUALIZER VIEW - Real-time Audio Visualization */}
        {viewMode === 'visualizer' && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Real-time Metrics Dashboard */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '15px',
                  marginBottom: '30px',
                }}
              >
                <div
                  style={{
                    background: 'rgba(0, 255, 65, 0.05)',
                    border: '1px solid #00ff41',
                    padding: '15px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>CURRENT VAD</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                    {(visualData.realTimeMetrics.currentVAD * 100).toFixed(1)}%
                  </div>
                </div>
                <div
                  style={{
                    background: 'rgba(255, 255, 0, 0.05)',
                    border: '1px solid #ffff00',
                    padding: '15px',
                    textAlign: 'center',
                    color: '#ffff00',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>CHUNKS PROCESSED</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                    {visualData.realTimeMetrics.chunksProcessed}
                  </div>
                </div>
                <div
                  style={{
                    background: 'rgba(0, 100, 255, 0.05)',
                    border: '1px solid #0064ff',
                    padding: '15px',
                    textAlign: 'center',
                    color: '#0064ff',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>AVG LATENCY</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                    {visualData.realTimeMetrics.averageLatency.toFixed(0)}ms
                  </div>
                </div>
                <div
                  style={{
                    background: 'rgba(255, 0, 255, 0.05)',
                    border: '1px solid #ff00ff',
                    padding: '15px',
                    textAlign: 'center',
                    color: '#ff00ff',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>FREQUENCY ACTIVITY</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                    {(visualData.realTimeMetrics.activeFrequency * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Visualization Canvases */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: '20px',
                  marginBottom: '30px',
                }}
              >
                {/* Waveform */}
                <div>
                  <h3 style={{ marginBottom: '10px', color: '#00ff41' }}>
                    &gt; REAL_TIME_WAVEFORM
                  </h3>
                  <canvas
                    ref={waveformCanvasRef}
                    width={800}
                    height={150}
                    style={{
                      width: '100%',
                      height: '150px',
                      background: 'rgba(0, 0, 0, 0.8)',
                      border: '1px solid #00ff41',
                    }}
                  />
                </div>

                {/* Frequency Spectrum */}
                <div>
                  <h3 style={{ marginBottom: '10px', color: '#ffff00' }}>
                    &gt; FREQUENCY_SPECTRUM
                  </h3>
                  <canvas
                    ref={frequencyCanvasRef}
                    width={800}
                    height={120}
                    style={{
                      width: '100%',
                      height: '120px',
                      background: 'rgba(0, 0, 0, 0.8)',
                      border: '1px solid #ffff00',
                    }}
                  />
                </div>

                {/* VAD History */}
                <div>
                  <h3 style={{ marginBottom: '10px', color: '#ffff00' }}>
                    &gt; VAD_ACTIVITY_HISTORY
                  </h3>
                  <canvas
                    ref={vadCanvasRef}
                    width={800}
                    height={100}
                    style={{
                      width: '100%',
                      height: '100px',
                      background: 'rgba(0, 0, 0, 0.8)',
                      border: '1px solid #ffff00',
                    }}
                  />
                </div>
              </div>

              {/* Controls */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ marginTop: '20px' }}>
                  <button
                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                    disabled={!isEngineInitialized || !whisperReady}
                    className="matrix-button"
                    style={{
                      padding: '15px 40px',
                      fontSize: '1.2rem',
                      background: isRecording ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 255, 65, 0.1)',
                      borderColor: isRecording ? '#ff0041' : '#00ff41',
                      color: isRecording ? '#ff0041' : '#00ff41',
                      opacity: !isEngineInitialized || !whisperReady ? 0.5 : 1,
                      marginRight: '15px',
                    }}
                  >
                    {isRecording ? '⏹️ [STOP_VISUALIZATION]' : '🎨 [START_REAL_TIME_VIZ]'}
                  </button>

                  {!whisperReady && (
                    <div style={{ marginTop: '10px', fontSize: '0.9rem' }}>
                      [LOADING_WHISPER: {(whisperProgress * 100).toFixed(0)}%]
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Chunks History */}
              {visualData.chunkHistory.length > 0 && (
                <div
                  style={{
                    background: 'rgba(0, 255, 65, 0.05)',
                    border: '1px solid #00ff41',
                    padding: '20px',
                    maxHeight: '300px',
                    overflow: 'auto',
                  }}
                >
                  <h3 style={{ marginBottom: '15px' }}>
                    &gt; RECENT_CHUNKS_HISTORY ({visualData.chunkHistory.length})
                  </h3>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {visualData.chunkHistory.slice(-5).map((chunk, index) => (
                      <div
                        key={chunk.id}
                        style={{
                          background: 'rgba(0, 255, 65, 0.05)',
                          border: '1px solid rgba(0, 255, 65, 0.3)',
                          padding: '10px',
                          fontSize: '0.9rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ opacity: 0.7 }}>
                            [CHUNK_{visualData.chunkHistory.length - 4 + index}]
                          </span>
                          <span style={{ color: '#ffff00' }}>
                            VAD: {(chunk.vadScore * 100).toFixed(1)}%
                          </span>
                          <span style={{ opacity: 0.7 }}>{chunk.duration}ms</span>
                        </div>
                        <div style={{ marginTop: '5px' }}>
                          {chunk.transcriptionText || '[PROCESSING...]'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* PROCESSOR VIEW - File Analysis */}
        {viewMode === 'processor' && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* File Upload */}
              <div
                style={{
                  marginBottom: '30px',
                  padding: '30px',
                  border: '2px dashed #00ff41',
                  textAlign: 'center',
                  background: 'rgba(0, 255, 65, 0.05)',
                }}
              >
                <h3 style={{ marginBottom: '15px' }}>&gt; COMPLETE_FILE_ANALYSIS_PIPELINE</h3>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  style={{
                    padding: '10px',
                    background: 'rgba(0, 0, 0, 0.8)',
                    border: '1px solid #00ff41',
                    color: '#00ff41',
                    marginBottom: '15px',
                  }}
                />
                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                  Upload any audio file for complete Susurro analysis
                  <br />
                  (Original + Processed URLs + Transcription + VAD + Metadata)
                </div>
              </div>

              {/* File Analysis Results */}
              {fileResult && (
                <div
                  style={{
                    background: 'rgba(0, 255, 65, 0.05)',
                    border: '2px solid #00ff41',
                    padding: '25px',
                    marginBottom: '20px',
                  }}
                >
                  <h3 style={{ marginBottom: '20px', color: '#00ff41' }}>
                    &gt; COMPLETE_ANALYSIS_RESULTS
                  </h3>

                  {/* Audio Players */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '20px',
                      marginBottom: '20px',
                    }}
                  >
                    <div>
                      <h4 style={{ color: '#ffff00', marginBottom: '10px' }}>ORIGINAL AUDIO:</h4>
                      <audio src={fileResult.originalAudioUrl} controls style={{ width: '100%' }} />
                    </div>
                    <div>
                      <h4 style={{ color: '#00ff41', marginBottom: '10px' }}>
                        MURMURABA PROCESSED:
                      </h4>
                      <audio
                        src={fileResult.processedAudioUrl}
                        controls
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '15px',
                      marginBottom: '20px',
                    }}
                  >
                    <div
                      style={{
                        background: 'rgba(0, 0, 0, 0.5)',
                        padding: '15px',
                        border: '1px solid #00ff41',
                      }}
                    >
                      <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>PROCESSING TIME</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                        {fileResult.processingTime.toFixed(0)}ms
                      </div>
                    </div>
                    <div
                      style={{
                        background: 'rgba(0, 0, 0, 0.5)',
                        padding: '15px',
                        border: '1px solid #ffff00',
                      }}
                    >
                      <div style={{ fontSize: '0.8rem', opacity: 0.7, color: '#ffff00' }}>
                        AVERAGE VAD
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffff00' }}>
                        {(fileResult.vadAnalysis.averageVad * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div
                      style={{
                        background: 'rgba(0, 0, 0, 0.5)',
                        padding: '15px',
                        border: '1px solid #0064ff',
                      }}
                    >
                      <div style={{ fontSize: '0.8rem', opacity: 0.7, color: '#0064ff' }}>
                        DURATION
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0064ff' }}>
                        {fileResult.metadata.duration.toFixed(2)}s
                      </div>
                    </div>
                    <div
                      style={{
                        background: 'rgba(0, 0, 0, 0.5)',
                        padding: '15px',
                        border: '1px solid #ff00ff',
                      }}
                    >
                      <div style={{ fontSize: '0.8rem', opacity: 0.7, color: '#ff00ff' }}>
                        FILE SIZE
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ff00ff' }}>
                        {(fileResult.metadata.fileSize / 1024).toFixed(1)}KB
                      </div>
                    </div>
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
                      <h4 style={{ color: '#00ff41', marginBottom: '10px' }}>
                        WHISPER TRANSCRIPTION:
                      </h4>
                      <div style={{ fontSize: '1rem', lineHeight: '1.6' }}>
                        {fileResult.transcriptionText}
                      </div>
                    </div>
                  )}

                  {/* Voice Segments */}
                  {fileResult.vadAnalysis.voiceSegments.length > 0 && (
                    <div
                      style={{
                        marginTop: '20px',
                        background: 'rgba(0, 0, 0, 0.8)',
                        padding: '20px',
                        border: '1px solid #ffff00',
                      }}
                    >
                      <h4 style={{ color: '#ffff00', marginBottom: '10px' }}>
                        VOICE SEGMENTS DETECTED ({fileResult.vadAnalysis.voiceSegments.length}):
                      </h4>
                      <div style={{ display: 'grid', gap: '5px', fontSize: '0.9rem' }}>
                        {fileResult.vadAnalysis.voiceSegments.slice(0, 5).map((segment, i) => (
                          <div key={i} style={{ opacity: 0.8 }}>
                            [{segment.startTime.toFixed(1)}s - {segment.endTime.toFixed(1)}s] VAD:{' '}
                            {(segment.vadScore * 100).toFixed(1)}%
                          </div>
                        ))}
                        {fileResult.vadAnalysis.voiceSegments.length > 5 && (
                          <div style={{ opacity: 0.6 }}>
                            ... and {fileResult.vadAnalysis.voiceSegments.length - 5} more segments
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* CONVERSATIONAL VIEW */}
        {viewMode === 'conversational' && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ConversationalChatFeed
                style={{
                  height: 'calc(100vh - 200px)',
                  minHeight: '600px',
                }}
              />
            </motion.div>
          </AnimatePresence>
        )}

        {/* Instructions */}
        <div
          style={{
            marginTop: '30px',
            padding: '20px',
            background: 'rgba(0, 255, 65, 0.05)',
            fontSize: '0.9rem',
            opacity: 0.8,
            border: '1px solid rgba(0, 255, 65, 0.3)',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
            &gt; SUSURRO_ECOSYSTEM_SHOWCASE:
          </div>
          <div style={{ lineHeight: '1.6' }}>
            🎨 <strong>VISUALIZER:</strong> Real-time waveform, frequency spectrum, and VAD analysis
            <br />
            📊 <strong>PROCESSOR:</strong> Complete file analysis with one method call
            (processAndTranscribeFile)
            <br />
            💬 <strong>CONVERSATIONAL:</strong> Live chat interface with streaming recording
            <br />
            <br />
            <span style={{ color: '#ffff00' }}>
              All powered by the consolidated useSusurro hook - No direct murmuraba calls!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
