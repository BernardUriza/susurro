import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useWhisper } from '../../../../contexts/WhisperContext';
import { SimpleWaveformAnalyzer } from 'murmuraba';
import { ErrorBoundary } from '../../../../components/ErrorBoundary';
import type { CompleteAudioResult, StreamingSusurroChunk } from '@susurro/core';

// Add CSS animation for pulse effect
const pulseStyle = `
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
`;

export interface AudioFragmentProcessorProps {
  onBack: () => void;
  onLog?: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
}

export const AudioFragmentProcessor: React.FC<AudioFragmentProcessorProps> = ({
  onBack,
  onLog,
}) => {
  const {
    // Streaming recording
    startStreamingRecording,
    stopStreamingRecording,

    // File processing
    processAndTranscribeFile,

    // Engine status
    whisperReady,
    whisperProgress,

    // Audio Engine Management
    isEngineInitialized,
    engineError,
    isInitializingEngine,
    initializeAudioEngine,
    resetAudioEngine,

    // MediaStream for visualization
    currentStream,
  } = useWhisper();

  // Minimal state - only essentials
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [fileResult, setFileResult] = useState<CompleteAudioResult | null>(null);
  const [chunksProcessed, setChunksProcessed] = useState(0);
  const [transcriptions, setTranscriptions] = useState<string[]>([]);
  const [chunkDurationSeconds, setChunkDurationSeconds] = useState<number>(8); // User-configurable chunk duration

  // Add recording timer
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [streamInfo, setStreamInfo] = useState<string>('No stream active');
  const consoleRef = useRef<HTMLDivElement>(null);

  // Timer effect for recording duration
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isRecording && recordingStartTime) {
      intervalId = setInterval(() => {
        setRecordingDuration(Date.now() - recordingStartTime);
      }, 100);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRecording, recordingStartTime]);

  // Memoize the onLog callback to prevent unnecessary re-renders
  const memoizedOnLog = useCallback(
    (message: string, type?: 'info' | 'warning' | 'error' | 'success') => {
      onLog?.(message, type);
    },
    [onLog]
  );

  // Auto-scroll to bottom when new transcriptions are added
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [transcriptions]);

  // Log engine state changes
  useEffect(() => {
    if (isEngineInitialized) {
      memoizedOnLog('✅ Audio engine ready', 'success');
    } else if (isInitializingEngine) {
      memoizedOnLog('⏳ Initializing audio engine...', 'info');
    } else if (engineError) {
      memoizedOnLog(`❌ Engine error: ${engineError}`, 'error');
    }
  }, [isEngineInitialized, isInitializingEngine, engineError, memoizedOnLog]);

  // Auto-scroll console to bottom when new transcriptions arrive
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [transcriptions]);

  // Memoize the stream info update function to prevent recreation on every render
  const updateStreamInfo = useCallback(() => {
    if (!currentStream) {
      setStreamInfo('No stream active');
      return;
    }

    try {
      const audioTracks = currentStream.getAudioTracks();
      const videoTracks = currentStream.getVideoTracks();

      const info = {
        id: currentStream.id,
        active: currentStream.active,
        audioTracks: audioTracks.length,
        videoTracks: videoTracks.length,
        tracks: audioTracks.map((track) => ({
          id: track.id.substring(0, 8),
          label: track.label || 'Unknown',
          kind: track.kind,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          settings: track.getSettings
            ? {
                sampleRate: track.getSettings().sampleRate,
                channelCount: track.getSettings().channelCount,
                echoCancellation: track.getSettings().echoCancellation,
                noiseSuppression: track.getSettings().noiseSuppression,
                autoGainControl: track.getSettings().autoGainControl,
              }
            : {},
        })),
      };

      setStreamInfo(JSON.stringify(info, null, 2));
    } catch (error) {
      setStreamInfo(`Error reading stream: ${error}`);
    }
  }, [currentStream]);

  // Update MediaStream info in real-time
  useEffect(() => {
    // Update immediately
    updateStreamInfo();

    // Update every 500ms while recording
    const interval = isRecording ? setInterval(updateStreamInfo, 500) : null;

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [updateStreamInfo, isRecording]);

  const handleResetEngine = useCallback(async () => {
    setStatus('[RESETTING_ENGINE]');
    memoizedOnLog('🔄 Resetting audio engine...', 'info');
    try {
      await resetAudioEngine();
      setTranscriptions([]);
      setChunksProcessed(0);
      setStatus('');
      memoizedOnLog('✅ Engine reset successfully', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatus(`[RESET_ERROR] ${errorMessage}`);
      memoizedOnLog(`❌ Reset failed: ${errorMessage}`, 'error');
    }
  }, [resetAudioEngine, memoizedOnLog]);

  const handleStartRecording = useCallback(async () => {
    // Engine should be initialized automatically, but check just in case
    if (!isEngineInitialized) {
      setStatus('[ENGINE_NOT_READY]');
      memoizedOnLog('⚠️ Engine not ready yet', 'warning');
      return;
    }

    // Check for engine errors
    if (engineError) {
      setStatus('[ENGINE_ERROR]');
      onLog?.(`❌ Engine error detected: ${engineError}`, 'error');
      return;
    }

    // Allow recording even without Whisper (just won't have transcription)
    if (!whisperReady) {
      setStatus('[RECORDING_NO_TRANSCRIPTION]');
      onLog?.('⚠️ Recording without transcription (Whisper not ready)', 'warning');
    }

    setIsRecording(true);
    setStatus(whisperReady 
      ? `[RECORDING_ACTIVE] Chunk duration: ${chunkDurationSeconds}s` 
      : `[RECORDING_NO_TRANSCRIPTION] Chunk duration: ${chunkDurationSeconds}s`);
    setChunksProcessed(0);
    setTranscriptions([]); // Clear previous transcriptions
    setRecordingStartTime(Date.now());
    setRecordingDuration(0);

    console.log('[RECORDING] Starting recording with Whisper ready:', whisperReady, 'Chunk duration:', chunkDurationSeconds);
    onLog?.(`🎬 Starting streaming recording with ${chunkDurationSeconds}s chunks...`, 'info');

    const onChunkProcessed = (chunk: StreamingSusurroChunk) => {
      console.log('[onChunkProcessed] Received chunk:', {
        id: chunk.id,
        hasTranscription: !!chunk.transcriptionText,
        transcriptionLength: chunk.transcriptionText?.length || 0,
        vadScore: chunk.vadScore,
        isVoiceActive: chunk.isVoiceActive,
        timestamp: chunk.timestamp,
      });

      setChunksProcessed((prev) => prev + 1);

      // Add transcription to console with more details
      const timestamp = new Date(chunk.timestamp).toLocaleTimeString();

      if (chunk.transcriptionText) {
        const message = `[${timestamp}] Chunk ${chunk.id.substring(0, 8)} - VAD: ${chunk.vadScore.toFixed(2)} - ${chunk.isVoiceActive ? '🔊' : '🔇'}\n📝 Transcription: "${chunk.transcriptionText}"\n---`;
        setTranscriptions((prev) => [...prev, message]);
        console.log('[TRANSCRIPTION_CONSOLE] Added transcription:', chunk.transcriptionText);
        onLog?.(
          `🎤 Transcription received: "${chunk.transcriptionText.substring(0, 100)}${chunk.transcriptionText.length > 100 ? '...' : ''}"`,
          'success'
        );
      } else {
        // Log when no transcription is available
        const message = `[${timestamp}] Chunk ${chunk.id.substring(0, 8)} - VAD: ${chunk.vadScore.toFixed(2)} - ${chunk.isVoiceActive ? '🔇' : '🔊'}\n⏳ Processing transcription...\n---`;
        setTranscriptions((prev) => [...prev, message]);
        console.log('[TRANSCRIPTION_CONSOLE] No transcription yet for chunk:', chunk.id);
      }
    };

    try {
      await startStreamingRecording(onChunkProcessed, {
        chunkDuration: chunkDurationSeconds,
        vadThreshold: 0.2,
        enableRealTimeTranscription: true,
        enableNoiseReduction: true,
      });
    } catch (error) {
      setIsRecording(false);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatus(`[ERROR] ${errorMessage}`);
      onLog?.(`❌ Recording failed: ${errorMessage}`, 'error');
    }
  }, [
    whisperReady,
    startStreamingRecording,
    isEngineInitialized,
    engineError,
    initializeAudioEngine,
    memoizedOnLog,
    chunkDurationSeconds,
  ]);

  const handleStopRecording = useCallback(async () => {
    try {
      const chunks = await stopStreamingRecording();
      setIsRecording(false);
      setRecordingStartTime(null);

      const totalDuration = recordingDuration / 1000;
      setStatus(`[COMPLETE] Processed ${chunks.length} chunks in ${totalDuration.toFixed(1)}s`);

      console.log('[RECORDING] Stopped. Total chunks:', chunks.length);
      console.log(
        '[RECORDING] Chunks with transcriptions:',
        chunks.filter((c) => c.transcriptionText).length
      );

      // Add detailed summary to console
      const transcribedChunks = chunks.filter((c) => c.transcriptionText);
      const avgVad = chunks.reduce((acc, c) => acc + c.vadScore, 0) / (chunks.length || 1);
      const summary = `\n========== RECORDING SUMMARY ==========\n🎤 Recording Duration: ${totalDuration.toFixed(1)}s\n📦 Total chunks: ${chunks.length}\n✍️ Transcribed chunks: ${transcribedChunks.length}\n📊 Average VAD: ${(avgVad * 100).toFixed(1)}%\n🔊 Voice-active chunks: ${chunks.filter((c) => c.isVoiceActive).length}\n=======================================\n`;
      setTranscriptions((prev) => [...prev, summary]);

      onLog?.(
        `🎯 Recording complete: ${chunks.length} chunks processed in ${totalDuration.toFixed(1)}s`,
        'success'
      );
    } catch (error) {
      setIsRecording(false);
      setStatus(`[ERROR] ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [stopStreamingRecording]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      onLog?.(`📁 Archivo seleccionado: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`, 'info');
      setFileResult(null);
      setStatus('[PROCESSING_FILE]');
      onLog?.('🔄 Procesando archivo con pipeline completo...', 'info');
      onLog?.('🎯 Aplicando: Noise reduction + VAD analysis + Whisper transcription', 'info');

      try {
        const startTime = performance.now();
        const result = await processAndTranscribeFile(file);
        const processingTime = performance.now() - startTime;

        setFileResult(result);
        setStatus('[FILE_COMPLETE]');

        onLog?.(`✅ Archivo procesado en ${processingTime.toFixed(0)}ms`, 'success');
        onLog?.(`📊 VAD promedio: ${(result.vadAnalysis.averageVad * 100).toFixed(1)}%`, 'info');
        onLog?.(`🎵 Duración: ${result.metadata.duration.toFixed(2)} segundos`, 'info');
        onLog?.(
          `📡 Sample rate: ${result.metadata.sampleRate}Hz | Canales: ${result.metadata.channels}`,
          'info'
        );

        if (result.transcriptionText) {
          const preview = result.transcriptionText.substring(0, 150);
          onLog?.(
            `💬 Transcripción: "${preview}${result.transcriptionText.length > 150 ? '...' : ''}"`,
            'success'
          );
        }

        if (result.vadAnalysis.voiceSegments.length > 0) {
          onLog?.(
            `🎙️ Segmentos de voz detectados: ${result.vadAnalysis.voiceSegments.length}`,
            'info'
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setStatus(`[ERROR] ${errorMsg}`);
        onLog?.(`❌ Error procesando archivo: ${errorMsg}`, 'error');
      }
    },
    [processAndTranscribeFile, memoizedOnLog]
  );

  return (
    <>
      <style>{pulseStyle}</style>
      <div style={{ padding: '20px', minHeight: '100vh', color: '#00ff41' }}>
        <button onClick={onBack} style={{ marginBottom: '20px' }}>
          [← BACK]
        </button>

        <h1>AUDIO FRAGMENT PROCESSOR</h1>

        {status && (
          <div
            style={{
              marginBottom: '10px',
              padding: '10px',
              background: 'rgba(0, 255, 65, 0.1)',
              border: '1px solid #00ff41',
            }}
          >
            {status}
          </div>
        )}

        {/* Engine Status Display with Timer */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ color: '#00ff41', marginBottom: '10px' }}>
            Engine Status:{' '}
            {isEngineInitialized
              ? 'Ready'
              : isInitializingEngine
                ? 'Initializing...'
                : 'Not Initialized'}
            {engineError && <span style={{ color: '#ff0041' }}> - Error: {engineError}</span>}
          </div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div>{isRecording ? '🔴 Recording...' : '⏹ Not Recording'}</div>
            {isRecording && (
              <div
                style={{
                  fontSize: '1.2em',
                  fontFamily: 'monospace',
                  color: '#ffaa00',
                  fontWeight: 'bold',
                }}
              >
                ⏱{' '}
                {Math.floor(recordingDuration / 60000)
                  .toString()
                  .padStart(2, '0')}
                :
                {Math.floor((recordingDuration % 60000) / 1000)
                  .toString()
                  .padStart(2, '0')}
                .{Math.floor((recordingDuration % 1000) / 100)}
              </div>
            )}
            {chunksProcessed > 0 && (
              <div style={{ color: '#00ff41' }}>📦 Chunks: {chunksProcessed}</div>
            )}
          </div>
        </div>

        {/* MediaStream Info - Real-time stream details */}
        <div
          style={{
            marginBottom: '20px',
            padding: '15px',
            background: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid #00ff41',
            borderRadius: '4px',
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          <h3 style={{ margin: '0 0 10px 0', color: '#00ff41' }}>
            📡 MediaStream Info (Real-time)
          </h3>
          <pre
            style={{
              margin: 0,
              fontSize: '12px',
              fontFamily: 'monospace',
              color: '#00ff41',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {streamInfo}
          </pre>
        </div>

        {/* SimpleWaveformAnalyzer - Only render when engine is ready */}
        <div style={{ marginBottom: '20px' }}>
          {isEngineInitialized && !engineError ? (
            <ErrorBoundary
              fallback={
                <div
                  style={{
                    width: 800,
                    height: 200,
                    border: '2px solid #ff0041',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ff0041',
                  }}
                >
                  ❌ Waveform analyzer error
                </div>
              }
            >
              <SimpleWaveformAnalyzer
                stream={currentStream || undefined}
                isActive={isRecording}
                width={800}
                height={200}
              />
            </ErrorBoundary>
          ) : (
            <div
              style={{
                width: 800,
                height: 200,
                border: '2px dashed #00ff41',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00ff41',
                marginBottom: '20px',
              }}
            >
              {isInitializingEngine
                ? '⏳ Initializing audio engine...'
                : engineError
                  ? `❌ Engine Error: ${engineError}`
                  : '⚠️ Audio engine not initialized'}
            </div>
          )}
        </div>

        {/* Chunk Duration Control */}
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          border: '1px solid #00ff41',
          background: 'rgba(0, 255, 65, 0.05)'
        }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '15px',
            fontSize: '1.1rem' 
          }}>
            <span style={{ color: '#00ff41', fontWeight: 'bold' }}>
              📏 Chunk Duration (seconds):
            </span>
            <input
              type="number"
              min="1"
              max="60"
              value={chunkDurationSeconds}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 8;
                // Clamp between 1 and 60 seconds
                const clampedValue = Math.min(60, Math.max(1, value));
                setChunkDurationSeconds(clampedValue);
              }}
              disabled={isRecording}
              style={{
                background: '#000',
                color: '#00ff41',
                border: '2px solid #00ff41',
                padding: '8px 12px',
                fontSize: '1.1rem',
                width: '80px',
                textAlign: 'center',
                cursor: isRecording ? 'not-allowed' : 'text',
                opacity: isRecording ? 0.5 : 1,
              }}
            />
            <span style={{ color: '#888', fontSize: '0.9rem' }}>
              (1-60 seconds, default: 8)
            </span>
            {chunkDurationSeconds !== 8 && (
              <button
                onClick={() => setChunkDurationSeconds(8)}
                disabled={isRecording}
                style={{
                  background: 'transparent',
                  border: '1px solid #00ff41',
                  color: '#00ff41',
                  padding: '4px 8px',
                  cursor: isRecording ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Reset to Default
              </button>
            )}
          </label>
          <div style={{ 
            marginTop: '10px', 
            fontSize: '0.85rem', 
            color: '#888' 
          }}>
            💡 Tip: Shorter chunks (3-8s) give faster real-time feedback. Longer chunks (15-30s) are better for complete sentences.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={!isEngineInitialized || !!engineError || isInitializingEngine}
            style={{
              padding: '15px 40px',
              fontSize: '1.2rem',
              background: isRecording
                ? '#ff0041'
                : !isEngineInitialized || !!engineError || isInitializingEngine
                  ? '#666666'
                  : '#00ff41',
              border: 'none',
              color: '#000',
              cursor:
                !isEngineInitialized || !!engineError || isInitializingEngine
                  ? 'not-allowed'
                  : 'pointer',
              opacity: !isEngineInitialized || !!engineError || isInitializingEngine ? 0.5 : 1,
            }}
          >
            {isRecording
              ? 'STOP'
              : isInitializingEngine
                ? 'INITIALIZING...'
                : !isEngineInitialized
                  ? 'ENGINE NOT READY'
                  : engineError
                    ? 'ENGINE ERROR'
                    : 'START'}
          </button>

          <button
            onClick={handleResetEngine}
            disabled={isRecording || isInitializingEngine}
            style={{
              padding: '15px 30px',
              fontSize: '1.2rem',
              background: isRecording || isInitializingEngine ? '#666666' : '#ff9500',
              border: 'none',
              color: '#000',
              cursor: isRecording || isInitializingEngine ? 'not-allowed' : 'pointer',
              opacity: isRecording || isInitializingEngine ? 0.5 : 1,
            }}
          >
            RESET ENGINE
          </button>
        </div>

        {!whisperReady && <div>Loading Whisper: {whisperProgress.toFixed(0)}%</div>}

        {/* Enhanced Transcription Console */}
        <div style={{ marginTop: '20px', marginBottom: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <h3 style={{ color: '#00ff41', margin: 0 }}>📝 TRANSCRIPTION CONSOLE</h3>
            {transcriptions.length > 0 && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ color: '#00ff41', fontSize: '12px' }}>
                  📨 {transcriptions.length} messages
                </span>
                {isRecording && (
                  <span
                    style={{
                      color: '#ff0041',
                      fontSize: '12px',
                      animation: 'pulse 1s infinite',
                    }}
                  >
                    ⬤ LIVE
                  </span>
                )}
              </div>
            )}
          </div>
          <div
            ref={consoleRef}
            style={{
              background: 'linear-gradient(to bottom, #000000, #001100)',
              border: '2px solid #00ff41',
              borderRadius: '4px',
              padding: '15px',
              height: '400px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '12px',
              color: '#00ff41',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxShadow: 'inset 0 0 20px rgba(0, 255, 65, 0.1)',
            }}
          >
            {transcriptions.length === 0 ? (
              <div
                style={{
                  color: '#666',
                  textAlign: 'center',
                  marginTop: '150px',
                  fontSize: '14px',
                }}
              >
                ⏳ [Waiting for transcriptions...]
                <br />
                <br />
                Start recording to see live transcriptions here
              </div>
            ) : (
              transcriptions.map((text, index) => {
                const isSystemMessage = text.includes('========== RECORDING SUMMARY');
                const hasTranscription = text.includes('📝 Transcription:');
                const isProcessing = text.includes('⏳ Processing');

                return (
                  <div
                    key={index}
                    style={{
                      marginBottom: '10px',
                      borderBottom: isSystemMessage ? '2px solid #00ff41' : '1px solid #003311',
                      paddingBottom: '10px',
                      paddingLeft: hasTranscription ? '20px' : '0',
                      opacity: isProcessing ? 0.6 : 1,
                      background: isSystemMessage ? 'rgba(0, 255, 65, 0.05)' : 'transparent',
                      padding: isSystemMessage ? '10px' : undefined,
                      borderRadius: isSystemMessage ? '4px' : undefined,
                    }}
                  >
                    {text}
                  </div>
                );
              })
            )}
          </div>
          {transcriptions.length > 0 && (
            <button
              onClick={() => setTranscriptions([])}
              style={{
                marginTop: '10px',
                padding: '5px 15px',
                background: '#ff0041',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Clear Console
            </button>
          )}
        </div>

        <input
          type="file"
          accept="audio/*"
          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          style={{ marginTop: '20px' }}
        />

        {fileResult && (
          <div style={{ marginTop: '20px' }}>
            <audio src={fileResult.processedAudioUrl} controls />
            <div>{fileResult.transcriptionText}</div>
          </div>
        )}
      </div>
    </>
  );
};
