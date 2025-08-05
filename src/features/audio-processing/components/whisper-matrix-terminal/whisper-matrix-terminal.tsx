'use client';

// React and external libraries
import React from 'react';

// CONSOLIDATED IMPORT - Only useSusurro hook (no direct murmuraba imports)
import { useSusurro } from '@susurro/core';
import type { CompleteAudioResult } from '@susurro/core';

// Relative imports - components
import { WhisperEchoLogs } from '../../../visualization/components';
// TemporalSegmentSelector not needed for current implementation

// Relative imports - utilities
import { SilentThreadProcessor } from '../../../../shared/services';

// Styles (last)
import '../../../../styles/matrix-theme.css';
import '../../../../styles/improved-layout.css';

type CubeFace = 'front' | 'right' | 'back' | 'left';

export const WhisperMatrixTerminal: React.FC = () => {
  const [temporalSegmentDuration] = React.useState(15); // Default 15 seconds
  const [currentFace] = React.useState<CubeFace>('front');

  // CONSOLIDATED useSusurro - All audio functionality in one hook
  const {
    // Existing functionality
    isProcessing,
    clearTranscriptions,
    whisperReady,
    whisperProgress,
    whisperError,
    transcribeWithWhisper,
    transcriptions,

    // NEW CONSOLIDATED METHODS - Everything through useSusurro
    processAndTranscribeFile,
    initializeAudioEngine,
    isEngineInitialized,
    engineError,
    isInitializingEngine,
  } = useSusurro({
    chunkDurationMs: temporalSegmentDuration * 1000,
    whisperConfig: {
      language: 'en',
    },
  });

  // SIMPLIFIED STATE - Much less state needed with consolidated useSusurro
  const [status, setStatus] = React.useState('');
  const [chunkDuration, setChunkDuration] = React.useState(15);
  const [whisperTranscriptions, setWhisperTranscriptions] = React.useState<string[]>([]);
  const [isTranscribing, setIsTranscribing] = React.useState(false);

  // Complete audio result from processAndTranscribeFile
  const [completeResult, setCompleteResult] = React.useState<CompleteAudioResult | null>(null);

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
  const addBackgroundLog = (
    message: string,
    type: 'info' | 'warning' | 'error' | 'success' = 'info'
  ) => {
    setBackgroundLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        message,
        type,
      },
    ]);
  };

  // Component lifecycle logging
  React.useEffect(() => {
    console.log('[WhisperMatrixTerminal] Component mounted');
    
    return () => {
      console.log('[WhisperMatrixTerminal] Component unmounting');
      // Any cleanup if needed
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount/unmount
  
  // REMOVED: Manual engine initialization - useSusurro handles this automatically
  // Auto-initialization happens when Whisper model is ready
  React.useEffect(() => {
    if (isEngineInitialized) {
      setStatus('[SYSTEM] Audio neural processor ready');
      addBackgroundLog('Audio engine initialized automatically', 'success');
    } else if (engineError) {
      setStatus(`[ERROR] Audio engine initialization failed: ${engineError}`);
      addBackgroundLog(`Engine initialization failed: ${engineError}`, 'error');
    } else if (isInitializingEngine) {
      setStatus('[SYSTEM] Initializing audio engine...');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEngineInitialized, engineError, isInitializingEngine]);

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

  // SIMPLIFIED: URLs are now managed by completeResult
  // Cleanup URLs when completeResult changes
  React.useEffect(() => {
    return () => {
      if (completeResult) {
        if (completeResult.originalAudioUrl.startsWith('blob:')) {
          URL.revokeObjectURL(completeResult.originalAudioUrl);
        }
        if (completeResult.processedAudioUrl.startsWith('blob:')) {
          URL.revokeObjectURL(completeResult.processedAudioUrl);
        }
      }
    };
  }, [completeResult]);

  // SIMPLIFIED FILE PROCESSING - One method does everything
  const handleFileProcess = async (file: File) => {
    try {
      // Check if engines are ready (useSusurro handles initialization)
      if (!isEngineInitialized) {
        setStatus('[ERROR] Audio engine not initialized. Please wait or refresh the page.');
        addBackgroundLog('Attempted to process file before engine initialization', 'error');
        return false;
      }

      setStatus('[PROCESSING_WITH_CONSOLIDATED_PIPELINE...]');
      clearTranscriptions();
      setCompleteResult(null); // Clear previous result

      // ONE METHOD CALL - Everything included: processing + transcription + VAD
      const result = await processAndTranscribeFile(file);

      // Store complete result
      setCompleteResult(result);

      // Update status and logs
      const vadPercentage = (result.vadAnalysis.averageVad * 100).toFixed(1);
      setStatus(
        `[PROCESSING_COMPLETE] VAD: ${vadPercentage}% | Duration: ${result.metadata.duration.toFixed(2)}s`
      );

      addBackgroundLog(`File processed successfully - VAD: ${vadPercentage}%`, 'success');
      addBackgroundLog(`Processing time: ${result.processingTime.toFixed(0)}ms`, 'info');
      addBackgroundLog(`Audio duration: ${result.metadata.duration.toFixed(2)}s`, 'info');
      addBackgroundLog('Complete pipeline: Murmuraba + Whisper + VAD', 'success');

      // Set transcription if available
      if (result.transcriptionText) {
        setWhisperTranscriptions([result.transcriptionText]);
        addBackgroundLog('Transcription completed via consolidated pipeline', 'success');
      }

      return true;
    } catch (err) {
      setStatus(`[ERROR] ${err instanceof Error ? err.message : 'Unknown error'}`);
      addBackgroundLog(
        `File processing failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error'
      );
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
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: 'transparent',
        overflow: 'auto',
      }}
    >
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
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <img 
                      src="/banner.png" 
                      alt="SUSURRO MATRIX" 
                      style={{ 
                        maxWidth: '100%', 
                        height: 'auto',
                        marginBottom: '20px',
                        filter: 'drop-shadow(0 0 30px rgba(0, 255, 65, 0.6))'
                      }} 
                    />
                    <p
                      className="matrix-subtitle fade-in"
                      style={{
                        fontSize: '1.1rem',
                        letterSpacing: '0.3em',
                        color: 'rgba(0, 255, 65, 0.8)',
                        textTransform: 'uppercase',
                        margin: '0',
                        textShadow: '0 0 10px rgba(0, 255, 65, 0.5)',
                      }}
                    >
                      Neural Audio Processing Terminal
                    </p>
                    <div
                      style={{
                        marginTop: '20px',
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '20px',
                        fontSize: '0.9rem',
                        color: 'rgba(0, 255, 65, 0.6)',
                      }}
                    >
                      <span className="fade-in" style={{ animationDelay: '0.5s' }}>
                        ◆ v2.0
                      </span>
                      <span className="fade-in" style={{ animationDelay: '0.7s' }}>
                        ◆ Matrix UI
                      </span>
                      <span className="fade-in" style={{ animationDelay: '0.9s' }}>
                        ◆ Realtime Processing
                      </span>
                    </div>
                  </div>
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
                <p style={{ marginBottom: 10, opacity: 0.8 }}>&gt; {status || 'SYSTEM READY'}</p>

                {/* Engine Status Indicator - Now from useSusurro */}
                <div className="engine-status">
                  <div className="engine-indicator">
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: isEngineInitialized
                          ? '#00ff41'
                          : isInitializingEngine
                            ? '#ffff00'
                            : '#ff0041',
                        boxShadow: isEngineInitialized ? '0 0 10px #00ff41' : '0 0 10px #ff0041',
                        animation: isInitializingEngine ? 'pulse 1s infinite' : 'none',
                      }}
                    />
                    <span style={{ color: isEngineInitialized ? '#00ff41' : '#ff0041' }}>
                      AUDIO_ENGINE:{' '}
                      {isInitializingEngine
                        ? 'INITIALIZING...'
                        : isEngineInitialized
                          ? 'ONLINE'
                          : 'OFFLINE'}
                    </span>
                  </div>
                </div>

                {/* Error Message and Retry - Now using useSusurro */}
                {engineError && !isInitializingEngine && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ color: '#ff0041', fontSize: '12px', marginBottom: 5 }}>
                      &gt; ENGINE_ERROR: {engineError}
                    </p>
                    <button
                      onClick={async () => {
                        setStatus('[SYSTEM] Retrying audio engine initialization...');
                        try {
                          await initializeAudioEngine({
                            enableNoiseSuppression: true,
                            enableEchoCancellation: true,
                            vadThreshold: 0.5,
                          });

                          setStatus('[SYSTEM] Audio neural processor ready');
                          addBackgroundLog(
                            'Audio engine initialized successfully on retry',
                            'success'
                          );
                        } catch (error) {
                          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                          setStatus(`[ERROR] Audio engine initialization failed: ${errorMsg}`);
                          addBackgroundLog(
                            `Engine initialization retry failed: ${errorMsg}`,
                            'error'
                          );
                        }
                      }}
                      className="matrix-button"
                      style={{
                        padding: '5px 15px',
                        fontSize: '11px',
                        background: 'rgba(255, 0, 65, 0.1)',
                        borderColor: '#ff0041',
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
                    opacity: isEngineInitialized ? 1 : 0.5,
                    cursor: isEngineInitialized ? 'pointer' : 'not-allowed',
                  }}
                  onClick={() => {
                    if (!isProcessing && isEngineInitialized) {
                      document.getElementById('file')?.click();
                    } else if (!isEngineInitialized) {
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
                    if (!isProcessing && isEngineInitialized) {
                      loadExampleAudio();
                    } else if (!isEngineInitialized) {
                      setStatus('[WARNING] Audio engine not ready. Please wait...');
                    }
                  }}
                  disabled={isProcessing || !isEngineInitialized}
                  className="matrix-button"
                  style={{
                    width: '100%',
                    marginBottom: 20,
                    opacity: isProcessing || !isEngineInitialized ? 0.5 : 1,
                    cursor: isEngineInitialized ? 'pointer' : 'not-allowed',
                  }}
                >
                  {isProcessing
                    ? '[CONSOLIDATED_PROCESSING...]'
                    : !isEngineInitialized
                      ? '[ENGINE_INITIALIZING...]'
                      : '[LOAD_JFK_SAMPLE.WAV]'}
                </button>
              </div>

              <div className="section-divider"></div>

              {/* Status */}
              {status && (
                <div
                  className={`matrix-status ${status.includes('ERROR') ? 'error' : ''}`}
                  style={{ margin: '1rem 0' }}
                >
                  &gt; {status}
                </div>
              )}

              {/* Processing Status */}
              {isProcessing && (
                <div className="matrix-status" style={{ marginTop: 10 }}>
                  &gt; [CONSOLIDATED_PROCESSING] MURMURABA + WHISPER + VAD...
                </div>
              )}

              {/* Original Audio - From completeResult */}
              {completeResult && (
                <div className="matrix-audio-section audio-section">
                  <h3>&gt; ORIGINAL_AUDIO_STREAM</h3>
                  <audio src={completeResult.originalAudioUrl} controls style={{ width: '100%' }} />
                </div>
              )}

              {/* Processed Audio - From completeResult */}
              {completeResult && (
                <>
                  <div
                    className="matrix-audio-section audio-section"
                    style={{ position: 'relative' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
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
                        VAD: {(completeResult.vadAnalysis.averageVad * 100).toFixed(1)}%
                      </div>
                    </div>

                    <p className="matrix-vad-score" style={{ marginTop: 10, marginBottom: 10 }}>
                      &gt; AUDIO_ENHANCEMENT: NOISE_REDUCTION | AGC | ECHO_CANCELLATION
                    </p>

                    {/* Show processed file audio player - From completeResult */}
                    <div className="chunk-item">
                      <p className="chunk-info">
                        &gt; PROCESSED_FILE | DURATION:{' '}
                        {completeResult.metadata.duration.toFixed(2)}s | VAD:{' '}
                        {(completeResult.vadAnalysis.averageVad * 100).toFixed(1)}% |
                        PROCESSING_TIME: {completeResult.processingTime.toFixed(0)}ms
                      </p>
                      <audio
                        src={completeResult.processedAudioUrl}
                        controls
                        style={{ width: '100%', height: '35px' }}
                      />
                    </div>

                    {/* Show voice segments if available */}
                    {completeResult.vadAnalysis.voiceSegments.length > 0 && (
                      <div style={{ marginTop: 10, fontSize: '12px', opacity: 0.8 }}>
                        &gt; VOICE_SEGMENTS_DETECTED:{' '}
                        {completeResult.vadAnalysis.voiceSegments.length}
                        {completeResult.vadAnalysis.voiceSegments.slice(0, 3).map((segment, i) => (
                          <div key={i} style={{ marginLeft: 20 }}>
                            [{segment.startTime.toFixed(1)}s - {segment.endTime.toFixed(1)}s] VAD:{' '}
                            {(segment.vadScore * 100).toFixed(1)}%
                          </div>
                        ))}
                        {completeResult.vadAnalysis.voiceSegments.length > 3 && (
                          <div style={{ marginLeft: 20, opacity: 0.6 }}>
                            ... and {completeResult.vadAnalysis.voiceSegments.length - 3} more
                            segments
                          </div>
                        )}
                      </div>
                    )}

                    <p
                      className="matrix-vad-score"
                      style={{ marginTop: 10, marginBottom: 0, opacity: 0.7 }}
                    >
                      &gt; FILE_SIZE: {(completeResult.metadata.fileSize / 1024).toFixed(1)}KB -&gt;
                      {(completeResult.metadata.processedSize / 1024).toFixed(1)}KB | SAMPLE_RATE:{' '}
                      {completeResult.metadata.sampleRate}Hz | CHANNELS:{' '}
                      {completeResult.metadata.channels}
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
                                background:
                                  chunkDuration === preset ? '#00ff41' : 'rgba(0, 0, 0, 0.8)',
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
                            completeResult &&
                            silentThreadProcessorRef.current
                          ) {
                            setIsTranscribing(true);
                            setStatus('[WHISPER_BACKGROUND_PROCESSING_STARTED]');
                            setWhisperTranscriptions([]); // Clear previous transcriptions

                            // SIMPLIFIED: processAndTranscribeFile already handled transcription
                            // This button is now mainly for re-transcription if needed
                            addBackgroundLog(
                              'Transcription already completed via consolidated pipeline',
                              'info'
                            );

                            if (completeResult.transcriptionText) {
                              setWhisperTranscriptions([completeResult.transcriptionText]);
                              addBackgroundLog(
                                'Using existing transcription from complete result',
                                'success'
                              );
                              setIsTranscribing(false);
                              setStatus('[TRANSCRIPTION_ALREADY_AVAILABLE]');
                            } else {
                              // Fallback: re-transcribe the processed audio
                              addBackgroundLog('Re-transcribing processed audio', 'info');

                              fetch(completeResult.processedAudioUrl)
                                .then((res) => res.blob())
                                .then((blob) => {
                                  return silentThreadProcessorRef.current?.processTranscriptionAsync(
                                    blob,
                                    transcribeWithWhisper,
                                    (progress) => {
                                      addBackgroundLog(
                                        `Re-transcription: ${progress}% complete`,
                                        'info'
                                      );
                                    }
                                  );
                                })
                                .then((text) => {
                                  if (text) {
                                    setWhisperTranscriptions([text]);
                                    addBackgroundLog('Re-transcription completed', 'success');
                                  }
                                  setIsTranscribing(false);
                                  setStatus('[WHISPER_BACKGROUND_COMPLETE]');
                                })
                                .catch((error) => {
                                  addBackgroundLog(`Re-transcription failed: ${error}`, 'error');
                                  setIsTranscribing(false);
                                });
                            }
                          }
                        }}
                        disabled={isTranscribing || !completeResult}
                        style={{
                          width: '100%',
                          opacity: isTranscribing || !completeResult ? 0.5 : 1,
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        {isTranscribing ? (
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
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
                        ) : completeResult?.transcriptionText ? (
                          '[RE-TRANSCRIBE_PROCESSED_AUDIO] 🔄'
                        ) : (
                          '[TRANSCRIBE_PROCESSED_AUDIO] 🚀'
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
                            background:
                              'linear-gradient(45deg, #00ff41, #00cc33, #00ff41, #00cc33)',
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

// CONSOLIDATED HOOK - All audio functionality
const { 
  processAndTranscribeFile,
  isEngineInitialized,
  whisperReady,
  isProcessing 
} = useSusurro({
  chunkDurationMs: ${chunkDuration * 1000},
  whisperConfig: { language: 'en' }
})

// ONE METHOD CALL - Complete pipeline
const result = await processAndTranscribeFile(file)

// Complete result object:
> result.originalAudioUrl     // Original file URL
> result.processedAudioUrl    // Murmuraba cleaned audio  
> result.transcriptionText    // Whisper transcription
> result.vadAnalysis          // Complete VAD analysis
> result.metadata             // Duration, size, etc.
> result.processingTime       // Total processing time

// Auto-initialization (no manual setup needed)
// Engine + Whisper models load automatically`}
                </pre>

                <p
                  style={{
                    textAlign: 'center',
                    marginTop: '2rem',
                    opacity: 0.6,
                    fontSize: '0.9em',
                  }}
                >
                  [SYSTEM.READY] - CONSOLIDATED_SUSURRO_PIPELINE_ONLINE
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <WhisperEchoLogs logs={backgroundLogs} maxLogs={15} />
    </div>
  );
};
