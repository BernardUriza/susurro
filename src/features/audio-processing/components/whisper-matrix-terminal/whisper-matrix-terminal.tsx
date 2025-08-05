'use client';

// React and external libraries
import React from 'react';
// Real Murmuraba v3 API imports
import type { MurmurabaConfig, MurmurabaResult } from '@susurro/core';
import { processFileWithMetrics as murmubaraProcessFile, initializeAudioEngine } from 'murmuraba';
import type { ProcessingMetrics } from 'murmuraba';

// Real Murmuraba VAD processing
const processFileWithMetrics = async (buffer: ArrayBuffer): Promise<MurmurabaResult> => {
  try {
    // Initialize engine if needed
    await initializeAudioEngine({
      enableVAD: true,
      enableNoiseSuppression: true
    });

    // Process with real Murmuraba VAD and noise reduction
    const result = await murmubaraProcessFile(buffer, (metrics: ProcessingMetrics) => {
      // Real-time metrics callback - VAD values from neural processing
      if (metrics.vad > 0.5) {
        console.log(`🎤 Voice detected: VAD=${metrics.vad.toFixed(3)}, Frame=${metrics.frame}`);
      }
    });
    
    return {
      processedBuffer: result.processedBuffer,
      metrics: result.metrics || [],
      averageVad: result.averageVad // Real VAD from Murmuraba engine
    };
  } catch (error) {
    console.warn('Murmuraba processing failed:', error);
    return {
      processedBuffer: buffer,
      metrics: [],
      averageVad: 0 // Failed processing
    };
  }
};

const initializeAudioEngineWrapper = async (config: MurmurabaConfig): Promise<void> => {
  try {
    await initializeAudioEngine({
      enableVAD: true,
      enableNoiseSuppression: true,
      ...config
    });
  } catch (error) {
    console.error('Failed to initialize Murmuraba engine:', error);
    throw error;
  }
};

const getEngineStatus = (): string => {
  // Status would come from the hook in real implementation
  return 'ready';
};

// Absolute imports
import { useSusurro } from '@susurro/core';

// Relative imports - components
import { WhisperEchoLogs } from '../../../visualization/components';
// TemporalSegmentSelector not needed for current implementation

// Relative imports - utilities
import { SilentThreadProcessor } from '../../../../shared/services';

// Styles (last)
import '../../../../styles/matrix-theme.css';
import '../../../../styles/improved-layout.css';
import styles from './whisper-matrix-terminal.module.css';

type CubeFace = 'front' | 'right' | 'back' | 'left';

export const WhisperMatrixTerminal: React.FC = () => {
  const [temporalSegmentDuration] = React.useState(15); // Default 15 seconds
  const [currentFace, setCurrentFace] = React.useState<CubeFace>('front');

  const {
    isProcessing,
    audioChunks,
    averageVad,
    clearTranscriptions,
    whisperReady,
    whisperProgress,
    whisperError,
    transcribeWithWhisper,
    transcriptions,
  } = useSusurro({
    chunkDurationMs: temporalSegmentDuration * 1000, // Convert to milliseconds
    whisperConfig: { 
      language: 'en',
      // Note: model configuration may need to be updated based on actual Whisper implementation
    },
  });

  const [originalUrl, setOriginalUrl] = React.useState('');
  const [status, setStatus] = React.useState('');

  // Additional state for component functionality
  const [chunkUrls, setChunkUrls] = React.useState<string[]>([]);
  const [chunkDuration, setChunkDuration] = React.useState(15);
  const [whisperTranscriptions, setWhisperTranscriptions] = React.useState<string[]>([]);
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  const [processedFileVad, setProcessedFileVad] = React.useState<number>(0);
  const [processedFileDuration, setProcessedFileDuration] = React.useState<number>(0);

  // State for audio engine
  const [engineInitialized, setEngineInitialized] = React.useState(false);
  const [engineError, setEngineError] = React.useState<string | null>(null);
  const [isInitializing, setIsInitializing] = React.useState(false);

  // Initialize murmuraba audio engine on mount
  React.useEffect(() => {
    const initEngine = async () => {
      setIsInitializing(true);
      setStatus('[SYSTEM] Initializing audio engine...');
      
      try {
        // Check if already initialized
        const status = getEngineStatus();
        if (status === 'ready') {
          setEngineInitialized(true);
          setStatus('[SYSTEM] Audio engine already initialized');
          return;
        }

        // Initialize the engine
        await initializeAudioEngineWrapper({
          enableNoiseSuppression: true,
          enableEchoCancellation: true,
        });
        
        setEngineInitialized(true);
        setEngineError(null);
        setStatus('[SYSTEM] Audio neural processor ready');
        addBackgroundLog('Audio engine initialized successfully', 'success');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        setEngineError(errorMsg);
        setStatus(`[ERROR] Audio engine initialization failed: ${errorMsg}`);
        addBackgroundLog(`Engine initialization failed: ${errorMsg}`, 'error');
      } finally {
        setIsInitializing(false);
      }
    };

    initEngine();
  }, []);

  // Direct values from useSusurro - no abstraction needed
  const [backgroundLogs, setBackgroundLogs] = React.useState<
    Array<{
      id: string;
      timestamp: Date;
      message: string;
      type: 'info' | 'warning' | 'error' | 'success';
    }>
  >([]);

  // Silent thread processor for non-blocking transcription
  const silentThreadProcessorRef = React.useRef<SilentThreadProcessor | null>(null);
  
  // Helper function to add background logs
  const addBackgroundLog = (message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') => {
    setBackgroundLogs(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      message,
      type
    }]);
  };

  React.useEffect(() => {
    silentThreadProcessorRef.current = new SilentThreadProcessor((message, type) => {
      setBackgroundLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          message,
          type,
        },
      ]);
    });
  }, []);

  // Create URLs for each audio chunk
  React.useEffect(() => {
    if (audioChunks && audioChunks.length > 0) {
      // Create URL for each chunk
      const urls = audioChunks.map((chunk) => URL.createObjectURL(chunk.blob));
      setChunkUrls(urls); // Set chunk URLs for audio playback

      return () => {
        // Cleanup old URLs
        urls.forEach((url) => URL.revokeObjectURL(url));
      };
    }
  }, [audioChunks]);

  const handleFileProcess = async (file: File) => {
    try {
      // Check if engine is initialized
      if (!engineInitialized) {
        setStatus('[ERROR] Audio engine not initialized. Please wait or refresh the page.');
        addBackgroundLog('Attempted to process file before engine initialization', 'error');
        return false;
      }

      setStatus('[INITIALIZING_NEURAL_PROCESSOR...]');
      setOriginalUrl(URL.createObjectURL(file));
      clearTranscriptions();

      // Convert file to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      setStatus('[PROCESSING_AUDIO_FILE...]');
      
      // Process the file with murmuraba's RNNoise
      const processedBuffer = await processFileWithMetrics(arrayBuffer);
      
      // Create a blob from the processed audio
      const processedData = processedBuffer.processedBuffer;
      if (!processedData) {
        throw new Error('No processed audio data received');
      }
      // Handle different types of processed data
      let blobData: BlobPart;
      if (processedData instanceof AudioBuffer) {
        // Convert AudioBuffer to ArrayBuffer
        const length = processedData.length * processedData.numberOfChannels * 2; // 16-bit audio
        const arrayBuffer = new ArrayBuffer(length);
        const view = new DataView(arrayBuffer);
        let offset = 0;
        
        for (let i = 0; i < processedData.length; i++) {
          for (let channel = 0; channel < processedData.numberOfChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, processedData.getChannelData(channel)[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
          }
        }
        blobData = arrayBuffer;
      } else {
        blobData = processedData;
      }
      
      const processedBlob = new Blob([blobData], { type: 'audio/wav' });
      
      // Log processing metrics
      // Metrics is an array, so we need to aggregate
      const vad = processedBuffer.metrics && processedBuffer.metrics.length > 0 ? 
        processedBuffer.metrics.reduce((sum: number, m: any) => sum + (m.vad || 0), 0) / processedBuffer.metrics.length : 0;
      
      // Calculate approximate duration from file size (fallback)
      const duration = file.size > 0 ? Math.round(file.size / 8000) : 0; // Rough estimate
      
      // Store metrics for display
      setProcessedFileVad(vad);
      setProcessedFileDuration(duration);
      
      addBackgroundLog(`File processed successfully - VAD: ${(vad * 100).toFixed(1)}%`, 'success');
      // Processing time not available in MurmurabaResult - could be calculated if needed
      addBackgroundLog('File processed with neural noise reduction', 'info');
      addBackgroundLog(`Audio duration: ${(duration / 1000).toFixed(2)}s`, 'info');
      
      // Set the processed audio URL for playback
      const processedUrl = URL.createObjectURL(processedBlob);
      setChunkUrls([processedUrl]);
      
      // Display VAD info in status
      setStatus(`[FILE_PROCESSING_COMPLETE] VAD: ${(vad * 100).toFixed(1)}%`);
      
      // Transcribe the processed audio if Whisper is ready
      if (whisperReady) {
        setStatus('[TRANSCRIBING_PROCESSED_AUDIO...]');
        try {
          const result = await transcribeWithWhisper(processedBlob);
          
          if (result) {
            setWhisperTranscriptions([result.text]);
            addBackgroundLog('Transcription completed', 'success');
          }
        } catch (error) {
          addBackgroundLog(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
      } else {
        addBackgroundLog('Whisper model not ready, skipping transcription', 'warning');
      }
      
      setStatus('[FILE_PROCESSING_COMPLETE]');
      return true;
    } catch (err) {
      setStatus(`[ERROR] ${err instanceof Error ? err.message : 'Unknown error'}`);
      addBackgroundLog(`File processing failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      return false;
    }
  };

  const loadExampleAudio = async () => {
    try {
      setStatus('[LOADING_SAMPLE_AUDIO...]');
      const res = await fetch('/sample.wav');
      if (!res.ok) {
        throw new Error(`Failed to load sample: ${res.status}`);
      }
      const blob = await res.blob();
      const file = new File([blob], 'sample.wav', { type: 'audio/wav' });
      await handleFileProcess(file);
    } catch (error) {
      // console.error('Error loading sample:', error);
      setStatus(`[ERROR] ${error instanceof Error ? error.message : 'Failed to load sample'}`);
    }
  };

  const getCubeClass = () => {
    console.log('Current face:', currentFace);
    switch (currentFace) {
      case 'right':
        return 'cube rotate-to-right';
      case 'back':
        return 'cube rotate-to-back';
      case 'left':
        return 'cube rotate-to-left';
      default:
        return 'cube';
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', background: 'transparent', overflow: 'auto' }}>
      
      {/* Version indicator in top-left corner */}
      <div
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          fontSize: '12px',
          fontFamily: 'monospace',
          color: '#00ff41',
          opacity: 0.8,
          zIndex: 1000,
          textShadow: '0 0 10px rgba(0, 255, 65, 0.5)',
          letterSpacing: '2px',
        }}
      >
        SUSURRO_MATRIX_v1.0
      </div>
      
      {/* Cube container */}
      <div className="cube-container">
        <div className={getCubeClass()}>
          {/* Front face - Main App */}
          <div className="cube-face cube-face-front">
            <div
              className="main-container improved-terminal-layout"
              style={{
                background: 'rgba(0, 0, 0, 0.8)',
                position: 'relative',
              }}
            >
        {/* Banner with advanced transparency effects */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            marginTop: 20,
            marginBottom: 30,
            overflow: 'hidden',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `
              radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.4) 50%, rgba(0, 0, 0, 0.8) 100%),
              linear-gradient(to bottom, rgba(0, 255, 65, 0.1) 0%, transparent 50%, rgba(0, 255, 65, 0.1) 100%)
            `,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />

          <div
            style={{
              position: 'relative',
              width: '100%',
              background: 'rgba(0, 0, 0, 0.5)',
              padding: '20px',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(0, 255, 65, 0.3)',
              boxShadow: `
              0 0 40px rgba(0, 255, 65, 0.2),
              inset 0 0 40px rgba(0, 255, 65, 0.1),
              0 0 80px rgba(0, 255, 65, 0.1)
            `,
            }}
          >
            <img
              src="/banner.png"
              alt="Susurro Banner"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                opacity: 0.9,
                filter: `
                  contrast(1.2) 
                  brightness(0.9) 
                  saturate(1.5)
                  drop-shadow(0 0 20px rgba(0, 255, 65, 0.5))
                `,
                mixBlendMode: 'screen',
                maskImage: `
                  linear-gradient(
                    to right,
                    transparent 0%,
                    black 10%,
                    black 90%,
                    transparent 100%
                  )
                `,
                WebkitMaskImage: `
                  linear-gradient(
                    to right,
                    transparent 0%,
                    black 10%,
                    black 90%,
                    transparent 100%
                  )
                `,
              }}
              onLoad={() => {
                // Banner loaded successfully
              }}
            />
          </div>

          {/* Animated scan line effect */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: 'linear-gradient(to right, transparent, #00ff41, transparent)',
              animation: 'matrix-scan-horizontal 4s linear infinite',
              zIndex: 3,
              opacity: 0.6,
            }}
          />

          {/* Glitch effect overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.03,
              mixBlendMode: 'overlay',
              animation: 'matrix-glitch 10s infinite',
              background: `
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(0, 255, 65, 0.03) 2px,
                rgba(0, 255, 65, 0.03) 4px
              )
            `,
              pointerEvents: 'none',
              zIndex: 4,
            }}
          />
        </div>
        <div className="section-divider"></div>
        
        {/* Status Display with Engine State */}
        <div className="status-section">
          <p style={{ marginBottom: 10, opacity: 0.8 }}>
            &gt; {status || 'SYSTEM READY'}
          </p>
          
          {/* Engine Status Indicator */}
          <div className="engine-status">
            <div className="engine-indicator">
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: engineInitialized ? '#00ff41' : (isInitializing ? '#ffff00' : '#ff0041'),
                boxShadow: engineInitialized ? '0 0 10px #00ff41' : '0 0 10px #ff0041',
                animation: isInitializing ? 'pulse 1s infinite' : 'none'
              }} />
              <span style={{ color: engineInitialized ? '#00ff41' : '#ff0041' }}>
                AUDIO_ENGINE: {isInitializing ? 'INITIALIZING...' : (engineInitialized ? 'ONLINE' : 'OFFLINE')}
              </span>
            </div>
          </div>
          
          {/* Error Message and Retry */}
          {engineError && !isInitializing && (
            <div style={{ marginTop: 10 }}>
              <p style={{ color: '#ff0041', fontSize: '12px', marginBottom: 5 }}>
                &gt; ENGINE_ERROR: {engineError}
              </p>
              <button
                onClick={async () => {
                  setEngineError(null);
                  const initEngine = async () => {
                    setIsInitializing(true);
                    setStatus('[SYSTEM] Retrying audio engine initialization...');
                    
                    try {
                      await initializeAudioEngine({
                        enableNoiseSuppression: true,
                        enableEchoCancellation: true,
                      });
                      
                      setEngineInitialized(true);
                      setEngineError(null);
                      setStatus('[SYSTEM] Audio neural processor ready');
                      addBackgroundLog('Audio engine initialized successfully on retry', 'success');
                    } catch (error) {
                      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                      setEngineError(errorMsg);
                      setStatus(`[ERROR] Audio engine initialization failed: ${errorMsg}`);
                      addBackgroundLog(`Engine initialization retry failed: ${errorMsg}`, 'error');
                    } finally {
                      setIsInitializing(false);
                    }
                  };
                  await initEngine();
                }}
                className="matrix-button"
                style={{ 
                  padding: '5px 15px', 
                  fontSize: '11px',
                  background: 'rgba(255, 0, 65, 0.1)',
                  borderColor: '#ff0041'
                }}
              >
                [RETRY_INITIALIZATION]
              </button>
            </div>
          )}
        </div>

        <div className="section-divider"></div>
        
        {/* Upload Section */}
        <div className="upload-section">
          <div
            className="matrix-upload-area upload-area"
            style={{
              padding: 40,
              textAlign: 'center',
              borderRadius: 0,
              opacity: engineInitialized ? 1 : 0.5,
              cursor: engineInitialized ? 'pointer' : 'not-allowed'
            }}
            onClick={() => {
              if (!isProcessing && engineInitialized) {
                document.getElementById('file')?.click();
              } else if (!engineInitialized) {
                setStatus('[WARNING] Audio engine not ready. Please wait...');
              }
            }}
          >
            <p style={{ margin: 0 }}>&gt; DRAG_DROP_AUDIO.WAV</p>
          </div>

          <input
            id="file"
            type="file"
            accept=".wav"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                await handleFileProcess(file);
              }
            }}
          />

          <button
            onClick={() => {
              if (!isProcessing && engineInitialized) {
                loadExampleAudio();
              } else if (!engineInitialized) {
                setStatus('[WARNING] Audio engine not ready. Please wait...');
              }
            }}
            disabled={isProcessing || !engineInitialized}
            className="matrix-button"
            style={{ 
              width: '100%', 
              marginBottom: 20, 
              opacity: (isProcessing || !engineInitialized) ? 0.5 : 1,
              cursor: engineInitialized ? 'pointer' : 'not-allowed'
            }}
          >
            {isProcessing ? '[MURMURABA_PROCESSING...]' : 
             !engineInitialized ? '[ENGINE_INITIALIZING...]' : 
             '[LOAD_JFK_SAMPLE.WAV]'}
          </button>
        </div>

        <div className="section-divider"></div>
        
        {/* Status */}
        {status && (
          <div className={`matrix-status ${status.includes('ERROR') ? 'error' : ''}`} style={{ margin: '1rem 0' }}>
            &gt; {status}
          </div>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <div className="matrix-status" style={{ marginTop: 10 }}>
            &gt; [MURMURABA_PROCESSING] CLEANING_AUDIO...
          </div>
        )}

        {/* Original Audio */}
        {originalUrl && (
          <div className="matrix-audio-section audio-section">
            <h3>&gt; ORIGINAL_AUDIO_STREAM</h3>
            <audio src={originalUrl} controls style={{ width: '100%' }} />
          </div>
        )}

        {/* Processed Audio Chunks */}
        {chunkUrls.length > 0 && (
          <>
            <div className="matrix-audio-section audio-section" style={{ position: 'relative' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <h3 style={{ margin: 0 }}>&gt; MURMURABA_CLEANED_AUDIO</h3>
                <div
                  style={{
                    fontSize: '2.5em',
                    color: '#00ff41',
                    fontWeight: 'bold',
                    textShadow: '0 0 10px #00ff41',
                    marginRight: 20,
                  }}
                >
                  VAD: {((processedFileVad > 0 ? processedFileVad : averageVad) * 100).toFixed(1)}%
                </div>
              </div>

              <p className="matrix-vad-score" style={{ marginTop: 10, marginBottom: 10 }}>
                &gt; AUDIO_ENHANCEMENT: NOISE_REDUCTION | AGC | ECHO_CANCELLATION
              </p>

              {/* Show processed file audio player */}
              {processedFileVad > 0 && chunkUrls.length > 0 ? (
                <div className="chunk-item">
                  <p className="chunk-info">
                    &gt; PROCESSED_FILE | DURATION: {(processedFileDuration / 1000).toFixed(2)}s | VAD: {(processedFileVad * 100).toFixed(1)}%
                  </p>
                  <audio
                    src={chunkUrls[0]}
                    controls
                    style={{ width: '100%', height: '35px' }}
                  />
                </div>
              ) : (
                /* Individual chunk players for real-time recording */
                audioChunks.map((chunk, index) => (
                <div key={`audio-chunk-${index}`} className="chunk-item">
                  <p className="chunk-info">
                    &gt; CHUNK_{index + 1} | DURATION: {(chunk.duration / 1000).toFixed(2)}s | VAD:{' '}
                    {chunk.vadScore ? (chunk.vadScore * 100).toFixed(1) : 'N/A'}%
                  </p>
                  <audio
                    src={chunkUrls[index]}
                    controls
                    style={{ width: '100%', height: '35px' }}
                  />
                </div>
              ))
              )}

              <p
                className="matrix-vad-score"
                style={{ marginTop: 10, marginBottom: 0, opacity: 0.7 }}
              >
                &gt; TOTAL_CHUNKS: {processedFileVad > 0 ? 1 : audioChunks.length} | TOTAL_DURATION:{' '}
                {processedFileVad > 0 ? (processedFileDuration / 1000).toFixed(2) : (audioChunks.reduce((acc, chunk) => acc + chunk.duration, 0) / 1000).toFixed(2)}s
              </p>
            </div>

            {/* Chunk Duration Control - Only show after processing */}
            {status === '[PROCESSING_COMPLETE]' && (
              <div
                style={{
                  marginTop: 20,
                  marginBottom: 20,
                  padding: '20px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(0, 255, 65, 0.3)',
                  borderRadius: '0',
                  backdropFilter: 'blur(5px)',
                  position: 'relative',
                  overflow: 'hidden',
                  animation: 'fadeIn 0.5s ease-in',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    flexWrap: 'wrap',
                  }}
                >
                  <label
                    style={{
                      color: '#00ff41',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                    }}
                  >
                    &gt; CHUNK_DURATION_SEC:
                  </label>

                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <button
                      onClick={() => setChunkDuration(Math.max(1, chunkDuration - 1))}
                      className="matrix-button"
                      style={{
                        width: '40px',
                        height: '40px',
                        padding: '0',
                        fontSize: '20px',
                        lineHeight: '1',
                        borderRadius: '0',
                        background: 'rgba(0, 0, 0, 0.8)',
                        border: '1px solid #00ff41',
                        color: '#00ff41',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#00ff41';
                        e.currentTarget.style.color = '#000';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
                        e.currentTarget.style.color = '#00ff41';
                      }}
                    >
                      −
                    </button>

                    <div
                      style={{
                        position: 'relative',
                        width: '120px',
                        height: '50px',
                      }}
                    >
                      <input
                        type="number"
                        value={chunkDuration}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setChunkDuration(Math.max(1, Math.min(60, val)));
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          background: 'rgba(0, 0, 0, 0.9)',
                          border: '2px solid #00ff41',
                          color: '#00ff41',
                          fontSize: '24px',
                          fontWeight: 'bold',
                          textAlign: 'center',
                          fontFamily: 'monospace',
                          borderRadius: '0',
                          outline: 'none',
                          padding: '0',
                          boxShadow: `
                            inset 0 0 20px rgba(0, 255, 65, 0.2),
                            0 0 20px rgba(0, 255, 65, 0.3)
                          `,
                          transition: 'all 0.3s',
                          letterSpacing: '2px',
                        }}
                        onFocus={(e) => {
                          e.target.style.boxShadow = `
                            inset 0 0 30px rgba(0, 255, 65, 0.4),
                            0 0 40px rgba(0, 255, 65, 0.5)
                          `;
                        }}
                        onBlur={(e) => {
                          e.target.style.boxShadow = `
                            inset 0 0 20px rgba(0, 255, 65, 0.2),
                            0 0 20px rgba(0, 255, 65, 0.3)
                          `;
                        }}
                        min="1"
                        max="60"
                      />

                      {/* Digital display effect */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          right: '10px',
                          transform: 'translateY(-50%)',
                          fontSize: '10px',
                          color: '#00ff41',
                          opacity: 0.5,
                          pointerEvents: 'none',
                        }}
                      >
                        SEC
                      </div>
                    </div>

                    <button
                      onClick={() => setChunkDuration(Math.min(60, chunkDuration + 1))}
                      className="matrix-button"
                      style={{
                        width: '40px',
                        height: '40px',
                        padding: '0',
                        fontSize: '20px',
                        lineHeight: '1',
                        borderRadius: '0',
                        background: 'rgba(0, 0, 0, 0.8)',
                        border: '1px solid #00ff41',
                        color: '#00ff41',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#00ff41';
                        e.currentTarget.style.color = '#000';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
                        e.currentTarget.style.color = '#00ff41';
                      }}
                    >
                      +
                    </button>
                  </div>

                  {/* Preset buttons */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '5px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {[5, 10, 15, 30].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setChunkDuration(preset)}
                        className="matrix-button"
                        style={{
                          padding: '5px 10px',
                          fontSize: '12px',
                          background: chunkDuration === preset ? '#00ff41' : 'rgba(0, 0, 0, 0.8)',
                          color: chunkDuration === preset ? '#000' : '#00ff41',
                          border: '1px solid #00ff41',
                          borderRadius: '0',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          if (chunkDuration !== preset) {
                            e.currentTarget.style.background = 'rgba(0, 255, 65, 0.2)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (chunkDuration !== preset) {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
                          }
                        }}
                      >
                        {preset}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visual indicator bar */}
                <div
                  style={{
                    marginTop: '15px',
                    height: '4px',
                    background: 'rgba(0, 255, 65, 0.1)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: `${(chunkDuration / 60) * 100}%`,
                      background: 'linear-gradient(to right, #00ff41, #00cc33)',
                      boxShadow: '0 0 10px #00ff41',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>

                <p
                  style={{
                    marginTop: '10px',
                    fontSize: '11px',
                    color: '#00ff41',
                    opacity: 0.6,
                    textAlign: 'center',
                  }}
                >
                  &gt; AUDIO_CHUNK_SIZE: {chunkDuration}000ms | OPTIMAL_RANGE: 10-30s |
                  [RECONFIGURE_FOR_NEXT_PROCESS]
                </p>
              </div>
            )}

            <div className="section-divider"></div>
            
            {/* Whisper Transcription Button */}
            <div className="whisper-section">
              {!whisperReady ? (
                <div className="matrix-status" style={{ textAlign: 'center' }}>
                  &gt; [WHISPER_MODEL_LOADING] {(whisperProgress * 100).toFixed(0)}%
                  <div
                    style={{
                      width: '100%',
                      height: '20px',
                      background: '#001a00',
                      border: '1px solid #00ff41',
                      marginTop: 10,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${whisperProgress * 100}%`,
                        height: '100%',
                        background: '#00ff41',
                        transition: 'width 0.3s ease',
                        boxShadow: '0 0 10px #00ff41',
                      }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  className="matrix-button whisper-button"
                  onClick={() => {
                    if (
                      !isTranscribing &&
                      (audioChunks.length > 0 || chunkUrls.length > 0) &&
                      silentThreadProcessorRef.current
                    ) {
                      setIsTranscribing(true);
                      setStatus('[WHISPER_BACKGROUND_PROCESSING_STARTED]');
                      setWhisperTranscriptions([]); // Clear previous transcriptions

                      // Add log
                      setBackgroundLogs((prev) => [
                        ...prev,
                        {
                          id: `log-${Date.now()}`,
                          timestamp: new Date(),
                          message: `Starting background transcription of ${audioChunks.length > 0 ? audioChunks.length : 1} chunks`,
                          type: 'info',
                        },
                      ]);

                      // Process chunks or processed file
                      const chunksToProcess = audioChunks.length > 0 ? audioChunks : 
                        (chunkUrls.length > 0 && processedFileVad > 0 ? [{
                          blob: new Blob([chunkUrls[0]], { type: 'audio/wav' }),
                          duration: processedFileDuration,
                          vadScore: processedFileVad,
                          timestamp: Date.now(),
                          id: 'processed-file'
                        }] : []);

                      // If we have a processed file URL but no blob, fetch it first
                      if (audioChunks.length === 0 && chunkUrls.length > 0) {
                        fetch(chunkUrls[0])
                          .then(res => res.blob())
                          .then(blob => {
                            silentThreadProcessorRef.current
                              ?.processTranscriptionAsync(
                                blob,
                                transcribeWithWhisper,
                                (progress) => {
                                  setBackgroundLogs((prev) => [
                                    ...prev,
                                    {
                                      id: `progress-file-${Date.now()}`,
                                      timestamp: new Date(),
                                      message: `Processed file: ${progress}% complete`,
                                      type: 'info',
                                    },
                                  ]);
                                }
                              )
                              .then((text) => {
                                setWhisperTranscriptions([text]);
                                addBackgroundLog('Transcription completed', 'success');
                                setIsTranscribing(false);
                                setStatus('[WHISPER_BACKGROUND_COMPLETE]');
                              })
                              .catch((error) => {
                                addBackgroundLog(`Transcription failed: ${error}`, 'error');
                                setIsTranscribing(false);
                              });
                          });
                        return;
                      }

                      // Process each chunk in background
                      chunksToProcess.forEach((chunk, index) => {
                        silentThreadProcessorRef.current
                          ?.processTranscriptionAsync(
                            chunk.blob,
                            transcribeWithWhisper,
                            (progress) => {
                              // Update progress log
                              setBackgroundLogs((prev) => [
                                ...prev,
                                {
                                  id: `progress-${index}-${Date.now()}`,
                                  timestamp: new Date(),
                                  message: `Chunk ${index + 1}: ${progress}% complete`,
                                  type: 'info',
                                },
                              ]);
                            }
                          )
                          .then((text) => {
                            // Update transcriptions without blocking
                            setWhisperTranscriptions((prev) => {
                              const newTranscriptions = [...prev];
                              newTranscriptions[index] = text;
                              return newTranscriptions;
                            });

                            // Add success log
                            setBackgroundLogs((prev) => [
                              ...prev,
                              {
                                id: `success-${index}-${Date.now()}`,
                                timestamp: new Date(),
                                message: `Chunk ${index + 1} transcribed: "${text.substring(0, 50)}..."`,
                                type: 'success',
                              },
                            ]);

                            // Check if all chunks are done
                            if (index === audioChunks.length - 1) {
                              setIsTranscribing(false);
                              setStatus('[WHISPER_BACKGROUND_COMPLETE]');
                            }
                          })
                          .catch((error) => {
                            // Add error log
                            setBackgroundLogs((prev) => [
                              ...prev,
                              {
                                id: `error-${index}-${Date.now()}`,
                                timestamp: new Date(),
                                message: `Chunk ${index + 1} failed: ${error}`,
                                type: 'error',
                              },
                            ]);
                          });
                      });
                    }
                  }}
                  disabled={isTranscribing || (audioChunks.length === 0 && chunkUrls.length === 0)}
                  style={{
                    width: '100%',
                    opacity: isTranscribing || (audioChunks.length === 0 && chunkUrls.length === 0) ? 0.5 : 1,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {isTranscribing ? (
                    <span
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          animation: 'pulse 1.5s infinite',
                          marginRight: 10,
                        }}
                      >
                        ⌛
                      </span>
                      [BACKGROUND_PROCESSING...]
                    </span>
                  ) : (
                    '[ACTIVATE_WHISPER_BACKGROUND] 🚀'
                  )}
                </button>
              )}

              {whisperError && (
                <div className="matrix-status error" style={{ marginTop: 10 }}>
                  &gt; [WHISPER_ERROR] {whisperError.message}
                </div>
              )}
            </div>

            <div className="section-divider"></div>
            
            {/* Transcription */}
            <div className="transcription-section">
              {/* Murmuraba Status */}

              {transcriptions.length > 0 && (
                <div className="matrix-transcript">
                  &gt; SUSURRO_OUTPUT:
                  <br />
                  <br />
                  {transcriptions.map((t, i) => (
                    <div key={i}>
                      [{new Date(t.timestamp).toLocaleTimeString()}] {t.text}
                    </div>
                  ))}
                </div>
              )}

              {/* Whisper Transcriptions - SUPER HIGHLIGHTED */}
              {whisperTranscriptions.length > 0 && (
                <div
                  style={{
                    marginTop: 30,
                    position: 'relative',
                    animation: 'whisperGlow 2s ease-in-out infinite',
                  }}
                >
                  {/* Glowing border effect */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: '-2px',
                      background: 'linear-gradient(45deg, #00ff41, #00cc33, #00ff41, #00cc33)',
                      backgroundSize: '400% 400%',
                      animation: 'gradientShift 3s ease infinite',
                      borderRadius: '0',
                      opacity: 0.8,
                      filter: 'blur(4px)',
                    }}
                  />

                  {/* Main content container */}
                  <div
                    className="matrix-transcript"
                    style={{
                      position: 'relative',
                      background: 'rgba(0, 0, 0, 0.95)',
                      border: '2px solid #00ff41',
                      padding: '30px',
                      boxShadow: `
                      0 0 40px rgba(0, 255, 65, 0.6),
                      inset 0 0 40px rgba(0, 255, 65, 0.2),
                      0 0 80px rgba(0, 255, 65, 0.3)
                    `,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Animated header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: 20,
                        position: 'relative',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '24px',
                          fontWeight: 'bold',
                          color: '#00ff41',
                          textShadow: '0 0 20px #00ff41',
                          letterSpacing: '3px',
                          animation: 'textGlitch 4s infinite',
                        }}
                      >
                        &gt; WHISPER_TRANSCRIPTION
                      </span>
                      <span
                        style={{
                          marginLeft: 15,
                          fontSize: '20px',
                          animation: 'pulse 1s infinite',
                        }}
                      >
                        🎙️
                      </span>

                      {/* Status indicator */}
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#00ff41',
                            boxShadow: '0 0 10px #00ff41',
                            animation: 'blink 1s infinite',
                          }}
                        />
                        <span
                          style={{
                            fontSize: '12px',
                            color: '#00ff41',
                            opacity: 0.8,
                          }}
                        >
                          [DECODED]
                        </span>
                      </div>
                    </div>

                    {/* Scanning line effect */}
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        height: '2px',
                        background:
                          'linear-gradient(to right, transparent, #00ff41 50%, transparent)',
                        animation: 'scanLine 3s linear infinite',
                        opacity: 0.6,
                      }}
                    />

                    {/* Transcription content with typing effect */}
                    <div
                      style={{
                        position: 'relative',
                        background: 'rgba(0, 255, 65, 0.05)',
                        padding: '20px',
                        border: '1px solid rgba(0, 255, 65, 0.2)',
                        marginTop: '10px',
                      }}
                    >
                      {whisperTranscriptions.map((text, i) => (
                        <div
                          key={i}
                          style={{
                            marginBottom: 20,
                            position: 'relative',
                            paddingLeft: '30px',
                            animation: `slideIn ${0.5 + i * 0.2}s ease-out`,
                          }}
                        >
                          {/* Chunk indicator */}
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              width: '20px',
                              height: '20px',
                              background: 'rgba(0, 255, 65, 0.2)',
                              border: '1px solid #00ff41',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold',
                            }}
                          >
                            {i + 1}
                          </div>

                          <div>
                            <span
                              style={{
                                color: '#00ff41',
                                opacity: 0.9,
                                fontSize: '12px',
                                textTransform: 'uppercase',
                                letterSpacing: '2px',
                              }}
                            >
                              &gt; CHUNK_{i + 1}_DECODED:
                            </span>
                            <div
                              style={{
                                marginTop: '8px',
                                color: '#00ff41',
                                fontSize: '14px',
                                lineHeight: '1.6',
                                textShadow: '0 0 3px rgba(0, 255, 65, 0.5)',
                                opacity: 0.95,
                              }}
                            >
                              {text}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Matrix rain effect overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        opacity: 0.03,
                        pointerEvents: 'none',
                        background: `
                        repeating-linear-gradient(
                          90deg,
                          transparent,
                          transparent 10px,
                          rgba(0, 255, 65, 0.1) 10px,
                          rgba(0, 255, 65, 0.1) 11px
                        )
                      `,
                        animation: 'matrixRain 20s linear infinite',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <div className="section-divider"></div>
        
        {/* Code Example */}
        <div className="code-section">
        <pre
          className="matrix-code"
          style={{
            padding: 20,
            borderRadius: 0,
            overflow: 'auto',
          }}
        >
          {`> SYSTEM.IMPORT('@susurro/core')

// Initialize audio processing hook
const { 
  processAudioFile, 
  audioChunks, 
  averageVad,
  isProcessing 
} = useSusurro({
  chunkDurationMs: ${chunkDuration * 1000},
  enableVAD: true
})

// Initialize Murmuraba audio engine
await initializeAudioEngine({
  enableNoiseSuppression: true,
  enableEchoCancellation: true
})

// Process audio with Murmuraba pipeline
await processFileWithMetrics(audioBuffer)

// Output streams
> audioChunks    // Cleaned audio chunks  
> averageVad     // Voice activity detection score
> transcriptions // Whisper AI transcription`}
        </pre>

        <p
          style={{
            textAlign: 'center',
            marginTop: '2rem',
            opacity: 0.6,
            fontSize: '0.9em',
          }}
        >
          [SYSTEM.READY] - MATRIX_AUDIO_PROCESSOR_ONLINE
        </p>
        </div>
            </div>
          </div>
          
          {/* Right face - Audio Fragment Processor */}
          <div className="cube-face cube-face-right">
            <div className="fragment-processor-page">
              <button 
                className="matrix-back-button"
                onClick={() => setCurrentFace('front')}
              >
                [← BACK]
              </button>
              
              <div className="matrix-grid" />
              
              <div className="fragment-processor-title">
                &gt; AUDIO FRAGMENT PROCESSOR &lt;
              </div>
              
              <div className="processor-grid">
                <div className="processor-card">
                  <h3>CHUNK ANALYZER</h3>
                  <p>Real-time audio chunk analysis</p>
                </div>
                <div className="processor-card">
                  <h3>VAD METRICS</h3>
                  <p>Voice activity detection stats</p>
                </div>
                <div className="processor-card">
                  <h3>WAVEFORM VIEWER</h3>
                  <p>Visual audio representation</p>
                </div>
                <div className="processor-card">
                  <h3>FREQUENCY ANALYZER</h3>
                  <p>FFT spectrum analysis</p>
                </div>
                <div className="processor-card">
                  <h3>SEGMENT EDITOR</h3>
                  <p>Manual chunk adjustment</p>
                </div>
                <div className="processor-card">
                  <h3>EXPORT MANAGER</h3>
                  <p>Download processed chunks</p>
                </div>
              </div>
              
              <div style={{ 
                marginTop: 40, 
                fontSize: '1rem', 
                opacity: 0.8,
                textAlign: 'center'
              }}>
                <p>STATUS: EXPERIMENTAL</p>
                <p>Select a module to begin processing</p>
              </div>
            </div>
          </div>
          
          {/* Back face - Future feature */}
          <div className="cube-face cube-face-back">
            <div className="fragment-processor-page">
              <button 
                className="matrix-back-button"
                onClick={() => setCurrentFace('front')}
              >
                [← BACK]
              </button>
              <div className="fragment-processor-title">
                &gt; ADVANCED ANALYSIS &lt;
              </div>
              <p style={{ textAlign: 'center', opacity: 0.7 }}>
                Coming soon: Advanced audio analysis features
              </p>
            </div>
          </div>
          
          {/* Left face - Future feature */}
          <div className="cube-face cube-face-left">
            <div className="fragment-processor-page">
              <button 
                className="matrix-back-button"
                onClick={() => setCurrentFace('front')}
              >
                [← BACK]
              </button>
              <div className="fragment-processor-title">
                &gt; REAL-TIME VISUALIZER &lt;
              </div>
              <p style={{ textAlign: 'center', opacity: 0.7 }}>
                Coming soon: Real-time audio visualization
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Navigation buttons - Enhanced responsive layout */}
        {currentFace === 'front' && (
          <div className={styles.navigationContainer}>
            <button
              className={styles.matrixButton}
              onClick={() => {
                console.log('Clicking LEFT button');
                setCurrentFace('left');
              }}
            >
              [← VISUALIZER]
            </button>
            <button
              className={styles.matrixButton}
              onClick={() => {
                console.log('Clicking RIGHT button');
                setCurrentFace('right');
              }}
            >
              [FRAGMENT_PROCESSOR →]
            </button>
            <button
              className={styles.matrixButton}
              onClick={() => {
                console.log('Clicking BACK button');
                setCurrentFace('back');
              }}
            >
              [ANALYSIS ↓]
            </button>
          </div>
        )}

      {/* Floating logs for background processing - only show on front face */}
      {currentFace === 'front' && backgroundLogs.length > 0 && <WhisperEchoLogs logs={backgroundLogs} maxLogs={15} />}
    </div>
  );
};
