import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useSusurro } from '@susurro/core';
import { SimpleWaveformAnalyzer } from 'murmuraba';
import type { CompleteAudioResult, StreamingSusurroChunk } from '@susurro/core';

export interface AudioFragmentProcessorProps {
  onBack: () => void;
}

export const AudioFragmentProcessor: React.FC<AudioFragmentProcessorProps> = ({ onBack }) => {
  const {
    // Streaming recording
    startStreamingRecording,
    stopStreamingRecording,

    // File processing
    processAndTranscribeFile,

    // Engine status
    whisperReady,
    whisperProgress,

    // MediaStream for visualization
    currentStream,
  } = useSusurro({
    chunkDurationMs: 8000, // 8-second chunks as per plan
  });

  // Minimal state - only essentials
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [fileResult, setFileResult] = useState<CompleteAudioResult | null>(null);
  const [chunksProcessed, setChunksProcessed] = useState(0);
  const [transcriptions, setTranscriptions] = useState<string[]>([]);
  const consoleRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll console to bottom when new transcriptions arrive
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [transcriptions]);

  const handleStartRecording = useCallback(async () => {
    // Allow recording even without Whisper (just won't have transcription)
    if (!whisperReady) {
      setStatus('[RECORDING_NO_TRANSCRIPTION]');
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
        setTranscriptions(prev => [...prev, message]);
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
      setStatus(`[ERROR] ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [whisperReady, startStreamingRecording]);

  const handleStopRecording = useCallback(async () => {
    try {
      const chunks = await stopStreamingRecording();
      setIsRecording(false);
      setStatus(`[COMPLETE] Processed ${chunks.length} chunks`);
      
      // Add summary to console
      const summary = `\n========== RECORDING SUMMARY ==========\nTotal chunks: ${chunks.length}\nTotal transcriptions: ${chunks.filter(c => c.transcriptionText).length}\n=======================================\n`;
      setTranscriptions(prev => [...prev, summary]);
    } catch (error) {
      setIsRecording(false);
      setStatus(`[ERROR] ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [stopStreamingRecording]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      setFileResult(null);
      setStatus('[PROCESSING_FILE]');

      try {
        const result = await processAndTranscribeFile(file);
        setFileResult(result);
        setStatus('[FILE_COMPLETE]');
      } catch (error) {
        setStatus(`[ERROR] ${error}`);
      }
    },
    [processAndTranscribeFile]
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

      {/* SimpleWaveformAnalyzer - The entire visualization solution */}
      <div style={{ marginBottom: '20px' }}>
        <div>
          {isRecording ? 'Recording...' : 'Not Recording'}
        </div>
        <SimpleWaveformAnalyzer
          stream={currentStream || undefined}
          isActive={isRecording}
          width={800}
          height={200}
        />
      </div>

      <button
        onClick={isRecording ? handleStopRecording : handleStartRecording}
        style={{
          padding: '15px 40px',
          fontSize: '1.2rem',
          background: isRecording ? '#ff0041' : '#00ff41',
          border: 'none',
          color: '#000',
          cursor: 'pointer',
          marginBottom: '20px',
        }}
      >
        {isRecording ? 'STOP' : 'START'}
      </button>

      {!whisperReady && <div>Loading Whisper: {(whisperProgress * 100).toFixed(0)}%</div>}

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
            wordBreak: 'break-word'
          }}
        >
          {transcriptions.length === 0 ? (
            <div style={{ color: '#666' }}>
              [Waiting for transcriptions... Start recording to see live transcriptions here]
            </div>
          ) : (
            transcriptions.map((text, index) => (
              <div key={index} style={{ marginBottom: '10px', borderBottom: '1px solid #003311', paddingBottom: '10px' }}>
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
              cursor: 'pointer'
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
