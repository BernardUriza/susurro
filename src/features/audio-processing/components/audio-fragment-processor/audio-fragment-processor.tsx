import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useWhisper } from '../../../../contexts/WhisperContext';
import { SimpleWaveformAnalyzer } from 'murmuraba';
import { ErrorBoundary } from '../../../../components/ErrorBoundary';
import type { CompleteAudioResult, StreamingSusurroChunk } from '@susurro/core';

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

    // MediaStream for visualization
    currentStream,
  } = useWhisper();

  // Minimal state - only essentials
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [fileResult, setFileResult] = useState<CompleteAudioResult | null>(null);
  const [chunksProcessed, setChunksProcessed] = useState(0);
  const [transcriptions, setTranscriptions] = useState<string[]>([]);
  const [streamInfo, setStreamInfo] = useState<string>('No stream active');
  const [isInitializingAudio, setIsInitializingAudio] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Memoize the onLog callback to prevent unnecessary re-renders
  const memoizedOnLog = useCallback((message: string, type?: 'info' | 'warning' | 'error' | 'success') => {
    onLog?.(message, type);
  }, [onLog]);

  // Initialize audio engine on component mount - Fixed infinite loop
  useEffect(() => {
    const initializeEngine = async () => {
      // Only run if engine is not initialized and not currently initializing
      if (!isEngineInitialized && !isInitializingEngine) {
        setIsInitializingAudio(true);
        try {
          await initializeAudioEngine();
          memoizedOnLog('✅ Audio engine initialized successfully', 'success');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          memoizedOnLog(`❌ Failed to initialize audio engine: ${errorMessage}`, 'error');
        } finally {
          setIsInitializingAudio(false);
        }
      }
    };

    initializeEngine();
    // Removed isInitializingAudio from dependencies to prevent circular dependency
  }, [isEngineInitialized, isInitializingEngine, initializeAudioEngine, memoizedOnLog]);

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

  const handleStartRecording = useCallback(async () => {
    // Ensure audio engine is initialized before recording
    if (!isEngineInitialized) {
      setStatus('[INITIALIZING_ENGINE]');
      try {
        await initializeAudioEngine();
        onLog?.('🎯 Audio engine initialized for recording', 'info');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setStatus(`[ENGINE_ERROR] ${errorMessage}`);
        onLog?.(`❌ Engine initialization failed: ${errorMessage}`, 'error');
        return;
      }
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
    setStatus(whisperReady ? '[RECORDING_ACTIVE]' : '[RECORDING_NO_TRANSCRIPTION]');
    setChunksProcessed(0);
    setTranscriptions([]); // Clear previous transcriptions

    const onChunkProcessed = (chunk: StreamingSusurroChunk) => {
      setChunksProcessed((prev) => prev + 1);

      // Add transcription to console
      if (chunk.transcriptionText) {
        const timestamp = new Date(chunk.timestamp).toLocaleTimeString();
        const message = `[${timestamp}] Chunk ${chunk.id.substring(0, 8)} - VAD: ${chunk.vadScore.toFixed(2)} - ${chunk.isVoiceActive ? '🔊' : '🔇'}\n${chunk.transcriptionText}`;
        setTranscriptions((prev) => [...prev, message]);
      }
    };

    try {
      await startStreamingRecording(onChunkProcessed, {
        chunkDuration: 8,
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
  }, [whisperReady, startStreamingRecording, isEngineInitialized, engineError, initializeAudioEngine, memoizedOnLog]);

  const handleStopRecording = useCallback(async () => {
    try {
      const chunks = await stopStreamingRecording();
      setIsRecording(false);
      setStatus(`[COMPLETE] Processed ${chunks.length} chunks`);

      // Add summary to console
      const summary = `\n========== RECORDING SUMMARY ==========\nTotal chunks: ${chunks.length}\nTotal transcriptions: ${chunks.filter((c) => c.transcriptionText).length}\n=======================================\n`;
      setTranscriptions((prev) => [...prev, summary]);
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

      {/* Engine Status Display */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ color: '#00ff41', marginBottom: '10px' }}>
          Engine Status: {isEngineInitialized ? 'Ready' : isInitializingEngine || isInitializingAudio ? 'Initializing...' : 'Not Initialized'}
          {engineError && <span style={{ color: '#ff0041' }}> - Error: {engineError}</span>}
        </div>
        <div>{isRecording ? 'Recording...' : 'Not Recording'}</div>
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
          <ErrorBoundary fallback={<div style={{ width: 800, height: 200, border: '2px solid #ff0041', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff0041' }}>❌ Waveform analyzer error</div>}>
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
            {isInitializingEngine || isInitializingAudio
              ? '⏳ Initializing audio engine...'
              : engineError
              ? `❌ Engine Error: ${engineError}`
              : '⚠️ Audio engine not initialized'}
          </div>
        )}
      </div>

      <button
        onClick={isRecording ? handleStopRecording : handleStartRecording}
        disabled={!isEngineInitialized || !!engineError || isInitializingEngine || isInitializingAudio}
        style={{
          padding: '15px 40px',
          fontSize: '1.2rem',
          background: isRecording 
            ? '#ff0041' 
            : (!isEngineInitialized || !!engineError || isInitializingEngine || isInitializingAudio) 
              ? '#666666' 
              : '#00ff41',
          border: 'none',
          color: '#000',
          cursor: (!isEngineInitialized || !!engineError || isInitializingEngine || isInitializingAudio) ? 'not-allowed' : 'pointer',
          marginBottom: '20px',
          opacity: (!isEngineInitialized || !!engineError || isInitializingEngine || isInitializingAudio) ? 0.5 : 1,
        }}
      >
        {isRecording ? 'STOP' : 
         isInitializingEngine || isInitializingAudio ? 'INITIALIZING...' : 
         !isEngineInitialized ? 'ENGINE NOT READY' : 
         engineError ? 'ENGINE ERROR' : 
         'START'}
      </button>

      {!whisperReady && <div>Loading Whisper: {whisperProgress.toFixed(0)}%</div>}

      {chunksProcessed > 0 && <div>Chunks Processed: {chunksProcessed}</div>}

      {/* Transcription Console */}
      <div style={{ marginTop: '20px', marginBottom: '20px' }}>
        <h3 style={{ color: '#00ff41', marginBottom: '10px' }}>📝 TRANSCRIPTION CONSOLE</h3>
        <div
          ref={consoleRef}
          style={{
            background: '#000',
            border: '2px solid #00ff41',
            borderRadius: '4px',
            padding: '15px',
            height: '300px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#00ff41',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {transcriptions.length === 0 ? (
            <div style={{ color: '#666' }}>
              [Waiting for transcriptions... Start recording to see live transcriptions here]
            </div>
          ) : (
            transcriptions.map((text, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '10px',
                  borderBottom: '1px solid #003311',
                  paddingBottom: '10px',
                }}
              >
                {text}
              </div>
            ))
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
  );
};
