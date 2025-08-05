'use client';

// React and external libraries
import React from 'react';

// Absolute imports
import { useSusurro } from '@susurro/core';

// Relative imports - components
import { DigitalRainfall } from '../../../visualization/components';
import { WhisperEchoLogs } from '../../../visualization/components';
// import { TemporalSegmentSelector } from '../temporal-segment-selector'; // TODO: Implement if needed

// Relative imports - utilities
import { SilentThreadProcessor } from '../../../../shared/services';

// Styles (last)
import '../../../../styles/matrix-theme.css';
import '../../../../styles/cube-flip.css';

type CubeFace = 'front' | 'right' | 'back' | 'left';

export const WhisperMatrixTerminal: React.FC = () => {
  const [temporalSegmentDuration] = React.useState(15); // Default 15 seconds
  const [currentFace, setCurrentFace] = React.useState<CubeFace>('front');

  const {
    isProcessing,
    isRecording,
    audioChunks,
    averageVad,
    clearTranscriptions,
    whisperReady,
    whisperProgress,
    whisperError,
    transcribeWithWhisper,
    transcriptions,
    startRecording,
    stopRecording,
  } = useSusurro({
    chunkDurationMs: temporalSegmentDuration * 1000, // Convert to milliseconds
    whisperConfig: { language: 'en' },
  });

  const [originalUrl, setOriginalUrl] = React.useState('');
  const [status, setStatus] = React.useState('');

  // Additional state for component functionality
  const [chunkUrls, setChunkUrls] = React.useState<string[]>([]);
  const [chunkDuration, setChunkDuration] = React.useState(15);
  const [whisperTranscriptions, setWhisperTranscriptions] = React.useState<string[]>([]);
  const [isTranscribing, setIsTranscribing] = React.useState(false);

  // Initialize status on mount
  React.useEffect(() => {
    setStatus('[SYSTEM] Audio neural processor ready');
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
      setStatus('[INITIALIZING_NEURAL_PROCESSOR...]');
      setOriginalUrl(URL.createObjectURL(file));
      clearTranscriptions();

      // For now, show a message that file processing requires manual implementation
      // since murmuraba's startRecording doesn't accept custom streams
      setStatus('[INFO] File streaming not yet implemented - use microphone recording instead');
      
      // Alternative: Process the file in chunks manually
      // This would require implementing a custom chunk processor
      // that mimics the real-time recording behavior
      
      addBackgroundLog('File upload attempted - streaming implementation pending', 'info');
      
      return false;
    } catch (err) {
      setStatus(`[ERROR] ${err instanceof Error ? err.message : 'Unknown error'}`);
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
    <div className="matrix-theme">
      <DigitalRainfall />
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
      
      <div className="cube-container">
        <div className={getCubeClass()}>
          {/* Front face - Main App */}
          <div className="cube-face cube-face-front">
            <div
              className="matrix-container"
              style={{
                maxWidth: 600,
                margin: '40px auto',
                padding: 20,
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
        <p style={{ marginBottom: 30, opacity: 0.8 }}>
          &gt; {status || 'SYSTEM READY'}
        </p>

        {/* Upload Section */}
        <div style={{ marginBottom: 30 }}>
          <div
            className="matrix-upload-area"
            style={{
              padding: 40,
              textAlign: 'center',
              borderRadius: 0,
              cursor: 'pointer',
              marginBottom: 20,
            }}
            onClick={() => {
              if (!isProcessing) {
                document.getElementById('file')?.click();
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
              if (!isProcessing) {
                loadExampleAudio();
              }
            }}
            disabled={isProcessing}
            className="matrix-button"
            style={{ width: '100%', marginBottom: 20, opacity: isProcessing ? 0.5 : 1 }}
          >
            {isProcessing ? '[MURMURABA_PROCESSING...]' : '[LOAD_JFK_SAMPLE.WAV]'}
          </button>
        </div>

        {/* Status */}
        {status && (
          <div className={`matrix-status ${status.includes('ERROR') ? 'error' : ''}`}>
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
          <div className="matrix-audio-section">
            <h3>&gt; ORIGINAL_AUDIO_STREAM</h3>
            <audio src={originalUrl} controls style={{ width: '100%' }} />
          </div>
        )}

        {/* Processed Audio Chunks */}
        {chunkUrls.length > 0 && (
          <>
            <div className="matrix-audio-section" style={{ position: 'relative' }}>
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
                  VAD: {(averageVad * 100).toFixed(1)}%
                </div>
              </div>

              <p className="matrix-vad-score" style={{ marginTop: 10, marginBottom: 10 }}>
                &gt; AUDIO_ENHANCEMENT: NOISE_REDUCTION | AGC | ECHO_CANCELLATION
              </p>

              {/* Individual chunk players */}
              {audioChunks.map((chunk, index) => (
                <div key={`audio-chunk-${index}`} style={{ marginBottom: 15 }}>
                  <p style={{ margin: '5px 0', fontSize: '0.9em', opacity: 0.8 }}>
                    &gt; CHUNK_{index + 1} | DURATION: {(chunk.duration / 1000).toFixed(2)}s | VAD:{' '}
                    {chunk.vadScore ? (chunk.vadScore * 100).toFixed(1) : 'N/A'}%
                  </p>
                  <audio
                    src={chunkUrls[index]}
                    controls
                    style={{ width: '100%', height: '35px' }}
                  />
                </div>
              ))}

              <p
                className="matrix-vad-score"
                style={{ marginTop: 10, marginBottom: 0, opacity: 0.7 }}
              >
                &gt; TOTAL_CHUNKS: {audioChunks.length} | TOTAL_DURATION:{' '}
                {(audioChunks.reduce((acc, chunk) => acc + chunk.duration, 0) / 1000).toFixed(2)}s
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

            {/* Whisper Transcription Button */}
            <div style={{ marginTop: 20 }}>
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
                  onClick={() => {
                    if (
                      !isTranscribing &&
                      audioChunks.length > 0 &&
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
                          message: `Starting background transcription of ${audioChunks.length} chunks`,
                          type: 'info',
                        },
                      ]);

                      // Process each chunk in background
                      audioChunks.forEach((chunk, index) => {
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
                  disabled={isTranscribing || audioChunks.length === 0}
                  className="matrix-button"
                  style={{
                    width: '100%',
                    opacity: isTranscribing || audioChunks.length === 0 ? 0.5 : 1,
                    fontSize: '1.2em',
                    padding: '15px',
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

            {/* Transcription */}
            <div style={{ marginTop: 30 }}>
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

        {/* Code Example */}
        <pre
          className="matrix-code"
          style={{
            padding: 20,
            borderRadius: 0,
            overflow: 'auto',
            marginTop: 40,
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

// Process audio with Murmuraba pipeline
await processAudioFile(audioFile)

// Output streams
> audioChunks    // Cleaned audio chunks
> averageVad     // Voice activity detection score
> [WHISPER_DISABLED] // Transcription temporarily offline`}
        </pre>

        <p
          style={{
            textAlign: 'center',
            marginTop: 40,
            opacity: 0.6,
            fontSize: '0.9em',
          }}
        >
          [SYSTEM.READY] - MATRIX_AUDIO_PROCESSOR_ONLINE
        </p>
            </div>

            {/* Navigation button */}
            <button
              style={{
                position: 'fixed',
                bottom: 20,
                right: 20,
                background: 'transparent',
                border: '1px solid #00ff41',
                color: '#00ff41',
                padding: '12px 24px',
                fontFamily: 'Courier New, monospace',
                cursor: 'pointer',
                transition: 'all 0.3s',
                textTransform: 'uppercase',
                zIndex: 1000
              }}
              onClick={() => setCurrentFace('right')}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#00ff41';
                e.currentTarget.style.color = '#000';
                e.currentTarget.style.boxShadow = '0 0 20px #00ff41';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#00ff41';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              [AUDIO_FRAGMENT_PROCESSOR →]
            </button>
          </div>

          {/* Right face - Audio Fragment Processor */}
          <div className="cube-face cube-face-right">
            <DigitalRainfall />
            <div className="fragment-processor-page" style={{ position: 'relative', zIndex: 1 }}>
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

          {/* Back face - Reserved */}
          <div className="cube-face cube-face-back">
            <div style={{ 
              background: '#000', 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#00ff41',
              fontFamily: 'Courier New, monospace'
            }}>
              [RESERVED]
            </div>
          </div>

          {/* Left face - Reserved */}
          <div className="cube-face cube-face-left">
            <div style={{ 
              background: '#000', 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#00ff41',
              fontFamily: 'Courier New, monospace'
            }}>
              [RESERVED]
            </div>
          </div>
        </div>
      </div>

      {/* Floating logs for background processing - only show on front face */}
      {currentFace === 'front' && backgroundLogs.length > 0 && <WhisperEchoLogs logs={backgroundLogs} maxLogs={15} />}
    </div>
  );
};
