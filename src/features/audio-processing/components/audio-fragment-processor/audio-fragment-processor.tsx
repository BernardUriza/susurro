import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useNeural } from '../../../../contexts/NeuralContext';
import { ErrorBoundary } from '../../../../components/ErrorBoundary';
import type { StreamingSusurroChunk } from '@susurro/core';

// Import panels
import {
  TranscriptionPanel,
  ControlPanel,
  VisualizationPanel,
  SettingsPanel,
} from './panels';

// Import Simple Mode component
import { SimpleTranscriptionMode } from './SimpleTranscriptionMode';

// Import styles
import styles from './audio-fragment-processor.module.css';

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
  } = useNeural();

  // Core states
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptions, setTranscriptions] = useState<string[]>([]);
  const [chunksProcessed, setChunksProcessed] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const transcribingCountRef = useRef(0);

  // UI states
  const [isSimpleMode, setIsSimpleMode] = useState(true); // Start in simple mode
  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(true);
  const [isStreamInfoVisible, setIsStreamInfoVisible] = useState(false);
  const [transcriptionFilter, setTranscriptionFilter] = useState('');

  // Settings states
  const [chunkDurationSeconds, setChunkDurationSeconds] = useState<number>(20); // Default to Murmuraba's official 20 seconds
  const [vadThreshold, setVadThreshold] = useState<number>(0.2);
  const [noiseReduction, setNoiseReduction] = useState<boolean>(true);

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

  // Initialize audio engine on mount
  useEffect(() => {
    if (!isEngineInitialized && !isInitializingEngine && !engineError) {
      initializeAudioEngine();
    }
  }, [isEngineInitialized, isInitializingEngine, engineError, initializeAudioEngine]);

  // Log engine state changes
  useEffect(() => {
    if (isEngineInitialized) {
      onLog?.('✅ Audio engine ready', 'success');
    } else if (isInitializingEngine) {
      onLog?.('⏳ Initializing audio engine...', 'info');
    } else if (engineError) {
      onLog?.(`❌ Engine error: ${engineError}`, 'error');
    }
  }, [isEngineInitialized, isInitializingEngine, engineError, onLog]);

  // Handle start recording
  const handleStartRecording = useCallback(async () => {
    if (!isEngineInitialized) {
      onLog?.('⚠️ Engine not ready yet', 'warning');
      return;
    }

    if (engineError) {
      onLog?.(`❌ Cannot start: ${engineError}`, 'error');
      return;
    }

    setIsRecording(true);
    setChunksProcessed(0);
    setTranscriptions([]);
    setRecordingStartTime(Date.now());
    setRecordingDuration(0);

    onLog?.(`🎬 Starting streaming recording with ${chunkDurationSeconds}s chunks...`, 'info');

    const onChunkProcessed = (chunk: StreamingSusurroChunk) => {
      setChunksProcessed((prev) => prev + 1);

      const timestamp = new Date(chunk.timestamp).toLocaleTimeString();
      const chunkIdShort = chunk.id.substring(0, 8);

      if (chunk.transcriptionText) {
        // Already transcribed - add immediately
        const message = `[${timestamp}] Chunk ${chunkIdShort} - VAD: ${chunk.vadScore.toFixed(2)} - ${chunk.isVoiceActive ? '🔊' : '🔇'}\n📝 Transcription: "${chunk.transcriptionText}"\n---`;
        setTranscriptions((prev) => [...prev, message]);
        onLog?.(
          `🎤 Transcription: "${chunk.transcriptionText.substring(0, 100)}${chunk.transcriptionText.length > 100 ? '...' : ''}"`,
          'success'
        );
      } else if (chunk.isVoiceActive) {
        // Add placeholder message while transcribing
        const placeholderMessage = `[${timestamp}] Chunk ${chunkIdShort} - VAD: ${chunk.vadScore.toFixed(2)} - ${chunk.isVoiceActive ? '🔊' : '🔇'}\n⏳ Processing transcription...\n---`;
        setTranscriptions((prev) => [...prev, placeholderMessage]);
        
        // Non-blocking transcription using setTimeout to free main thread
        if (chunk.audioBlob && chunk.audioBlob.size > 0) {
          // Track active transcriptions
          transcribingCountRef.current++;
          setIsTranscribing(true);
          
          setTimeout(async () => {
            // This runs after the current call stack clears, preventing UI freeze
            try {
              // Process the audio chunk for transcription
              const transcriptionResult = await processAndTranscribeFile(new File([chunk.audioBlob], 'chunk.wav', { type: 'audio/wav' }));
              if (transcriptionResult?.transcriptionText) {
                const finalMessage = `[${timestamp}] Chunk ${chunkIdShort} - VAD: ${chunk.vadScore.toFixed(2)} - 🔊\n📝 Transcription: "${transcriptionResult.transcriptionText}"\n---`;
                
                // Replace the placeholder with the actual transcription
                setTranscriptions((prev) => 
                  prev.map((msg) => 
                    msg.includes(`Chunk ${chunkIdShort}`) && msg.includes('⏳ Processing transcription')
                      ? finalMessage
                      : msg
                  )
                );
              }
            } catch (error) {
              console.error('[Transcription] Non-blocking transcription error:', error);
            } finally {
              // Update transcribing state
              transcribingCountRef.current--;
              if (transcribingCountRef.current === 0) {
                setIsTranscribing(false);
              }
            }
          }, 0);
        }
      }
    };

    try {
      await startStreamingRecording(onChunkProcessed, {
        chunkDuration: chunkDurationSeconds,
        vadThreshold: vadThreshold,
        enableRealTimeTranscription: true,
        enableNoiseReduction: noiseReduction,
      });
    } catch (error) {
      setIsRecording(false);
      const errorMessage = error instanceof Error ? error.message : String(error);
      onLog?.(`❌ Recording failed: ${errorMessage}`, 'error');
    }
  }, [
    isEngineInitialized,
    engineError,
    startStreamingRecording,
    chunkDurationSeconds,
    vadThreshold,
    noiseReduction,
    onLog,
  ]);

  // Handle stop recording
  const handleStopRecording = useCallback(async () => {
    try {
      const chunks = await stopStreamingRecording();
      setIsRecording(false);
      setRecordingStartTime(null);

      const totalDuration = recordingDuration / 1000;

      // Add summary to transcriptions
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
      onLog?.(`❌ Stop recording failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [stopStreamingRecording, recordingDuration, onLog]);

  // Handle reset engine
  const handleResetEngine = useCallback(async () => {
    onLog?.('🔄 Resetting audio engine...', 'info');
    try {
      await resetAudioEngine();
      setTranscriptions([]);
      setChunksProcessed(0);
      onLog?.('✅ Audio engine reset successfully', 'success');
    } catch (error) {
      onLog?.(`❌ Reset failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [resetAudioEngine, onLog]);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    onLog?.(`📁 Processing file: ${file.name}`, 'info');
    try {
      const result = await processAndTranscribeFile(file);
      
      // Add file transcription to the list
      const fileTranscription = `\n========== FILE TRANSCRIPTION ==========\n📄 File: ${file.name}\n⏱️ Duration: ${result.metadata.duration.toFixed(2)}s\n📝 Text: "${result.transcriptionText}"\n========================================\n`;
      setTranscriptions((prev) => [...prev, fileTranscription]);
      
      onLog?.(`✅ File processed successfully`, 'success');
    } catch (error) {
      onLog?.(`❌ File processing failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [processAndTranscribeFile, onLog]);

  // Handle export transcriptions
  const handleExportTranscriptions = useCallback(() => {
    const text = transcriptions.join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcriptions_${new Date().toISOString().replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    onLog?.('📥 Transcriptions exported', 'success');
  }, [transcriptions, onLog]);

  // Toggle mode
  const toggleMode = useCallback(() => {
    setIsSimpleMode((prev) => !prev);
    onLog?.(`🔄 Switched to ${isSimpleMode ? 'Advanced' : 'Simple'} mode`, 'info');
  }, [isSimpleMode, onLog]);

  return (
    <ErrorBoundary>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <button onClick={onBack} className={styles.backButton}>
            ← Back
          </button>
          <h1 className={styles.title}>Audio Fragment Processor</h1>
          <button onClick={toggleMode} className={styles.modeToggle}>
            {isSimpleMode ? '⚡ Simple' : '🔧 Advanced'}
          </button>
        </div>

        {/* SIMPLE MODE VIEW */}
        {isSimpleMode ? (
          <SimpleTranscriptionMode onLog={onLog} />
        ) : (
          /* ADVANCED MODE VIEW (current UI) */
          <div className={styles.dashboardGrid}>
          {/* Transcription Panel - Main Focus */}
          <TranscriptionPanel
            transcriptions={transcriptions}
            isRecording={isRecording}
            filter={transcriptionFilter}
            onFilterChange={setTranscriptionFilter}
            onExport={handleExportTranscriptions}
          />

          {/* Control Panel - Compact Status & Controls */}
          <ControlPanel
            isRecording={isRecording}
            recordingDuration={recordingDuration}
            chunksProcessed={chunksProcessed}
            engineStatus={{
              isInitialized: isEngineInitialized,
              isInitializing: isInitializingEngine,
              error: engineError,
            }}
            whisperStatus={{
              ready: whisperReady,
              progress: whisperProgress,
            }}
            onStart={handleStartRecording}
            onStop={handleStopRecording}
            onReset={handleResetEngine}
            isTranscribing={isTranscribing}
          />

          {/* Visualization Panel - Waveform & Stream Info */}
          <VisualizationPanel
            currentStream={currentStream}
            isRecording={isRecording}
            engineReady={isEngineInitialized}
            showStreamInfo={isStreamInfoVisible}
            onToggleStreamInfo={setIsStreamInfoVisible}
          />

          {/* Settings Panel - Collapsible Configuration */}
          <SettingsPanel
            isCollapsed={isSettingsCollapsed}
            onToggle={setIsSettingsCollapsed}
            chunkDuration={chunkDurationSeconds}
            onChunkDurationChange={setChunkDurationSeconds}
            isRecording={isRecording}
            vadThreshold={vadThreshold}
            onVadThresholdChange={setVadThreshold}
            noiseReduction={noiseReduction}
            onNoiseReductionChange={setNoiseReduction}
          />

          {/* File Upload Area (Hidden but functional) */}
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFileUpload(file);
              }
            }}
            style={{ display: 'none' }}
            id="fileUpload"
          />
        </div>
        )}
      </div>
    </ErrorBoundary>
  );
};