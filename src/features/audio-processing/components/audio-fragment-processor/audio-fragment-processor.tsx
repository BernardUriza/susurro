'use client';

import React, { useCallback, useState } from 'react';
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
    chunkDurationMs: 8000 // 8-second chunks as per plan
  });

  // Minimal state - only essentials
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [fileResult, setFileResult] = useState<CompleteAudioResult | null>(null);
  const [chunksProcessed, setChunksProcessed] = useState(0);

  const handleStartRecording = useCallback(async () => {
    if (!whisperReady) {
      setStatus('[WAITING_FOR_WHISPER_MODEL]');
      return;
    }

    setIsRecording(true);
    setStatus('[RECORDING_ACTIVE]');
    setChunksProcessed(0);

    const onChunkProcessed = () => {
      setChunksProcessed(prev => prev + 1);
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
    const chunks = await stopStreamingRecording();
    setIsRecording(false);
    setStatus(`[COMPLETE] Processed ${chunks.length} chunks`);
  }, [stopStreamingRecording]);

  const handleFileUpload = useCallback(async (file: File) => {
    setFileResult(null);
    setStatus('[PROCESSING_FILE]');
    
    try {
      const result = await processAndTranscribeFile(file);
      setFileResult(result);
      setStatus('[FILE_COMPLETE]');
    } catch (error) {
      setStatus(`[ERROR] ${error}`);
    }
  }, [processAndTranscribeFile]);

  return (
    <div style={{ padding: '20px', background: '#000', minHeight: '100vh', color: '#00ff41' }}>
      <button onClick={onBack} style={{ marginBottom: '20px' }}>[← BACK]</button>
      
      <h1>SUSURRO WAVEFORM</h1>
      
      {status && <div style={{ marginBottom: '10px' }}>{status}</div>}
      
      {/* SimpleWaveformAnalyzer - The entire visualization solution */}
      <SimpleWaveformAnalyzer 
        stream={currentStream}
        isActive={isRecording}
        width={800}
        height={200}
        style={{ marginBottom: '20px' }}
      />
      
      <button
        onClick={isRecording ? handleStopRecording : handleStartRecording}
        disabled={!whisperReady}
        style={{
          padding: '15px 40px',
          fontSize: '1.2rem',
          background: isRecording ? '#ff0041' : '#00ff41',
          border: 'none',
          color: '#000',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        {isRecording ? 'STOP' : 'START'}
      </button>
      
      {!whisperReady && (
        <div>Loading Whisper: {(whisperProgress * 100).toFixed(0)}%</div>
      )}
      
      {chunksProcessed > 0 && (
        <div>Chunks: {chunksProcessed}</div>
      )}
      
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