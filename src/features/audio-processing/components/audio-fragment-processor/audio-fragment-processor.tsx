'use client';

// React and external libraries
import React from 'react';

// Absolute imports
import { useSusurro } from '@susurro/core';

// Relative imports - components
import { TemporalSegmentSelector } from '../temporal-segment-selector';
import { ConversationalChatFeed } from '../conversational-chat-feed';

export interface AudioFragmentProcessorProps {
  onBack: () => void;
}

export const AudioFragmentProcessor: React.FC<AudioFragmentProcessorProps> = ({ onBack }) => {
  const [chunkDuration, setChunkDuration] = React.useState(15);
  const [overlapDuration] = React.useState(3);
  const [micPermissionStatus, setMicPermissionStatus] = React.useState<
    'prompt' | 'granted' | 'denied' | 'checking'
  >('prompt');
  const [status, setStatus] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'processor' | 'conversational'>('conversational'); // Default to conversational
  const [messages, setMessages] = React.useState<Array<{
    id: string;
    type: 'audio-message';
    audioUrl: string;
    text: string;
    timestamp: Date;
    vadScore: number;
  }>>([]);

  // 🔥 FUTURE IMPLEMENTATION - Real-time conversational pattern
  const {
    isRecording,
    isProcessing,
    audioChunks,
    averageVad,
    startRecording,
    stopRecording,
    clearTranscriptions,
    whisperReady,
    whisperProgress,
    transcriptions,
    conversationalChunks,
    clearConversationalChunks,
  } = useSusurro({
    chunkDurationMs: chunkDuration * 1000,
    conversational: {
      onChunk: (chunk) => {
        // 🆕 Real-time chunk callback - ChatGPT style
        console.log('New conversation chunk:', {
          audio: chunk.audioUrl,      // Clean neural-processed audio
          text: chunk.transcript,     // AI transcription
          timing: `${chunk.startTime}-${chunk.endTime}ms`,
          confidence: chunk.vadScore
        });
        
        // Add to UI immediately - ChatGPT style
        setMessages(prev => [...prev, {
          id: chunk.id,
          type: 'audio-message',
          audioUrl: chunk.audioUrl,
          text: chunk.transcript,
          timestamp: new Date(),
          vadScore: chunk.vadScore
        }]);
      },
      enableInstantTranscription: true, // Real-time processing
      chunkTimeout: 5000, // Max 5s wait for transcript
      enableChunkEnrichment: true // Enable middleware processing
    },
  });

  React.useEffect(() => {
    checkMicrophonePermission();
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      setMicPermissionStatus('checking');
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setMicPermissionStatus(result.state as any);

      result.addEventListener('change', () => {
        setMicPermissionStatus(result.state as any);
      });
    } catch (error) {
      console.log('Permission API not supported, will check on first use');
      setMicPermissionStatus('prompt');
    }
  };

  const handleStartRecording = async () => {
    try {
      if (micPermissionStatus === 'denied') {
        setStatus('[ERROR] MICROPHONE_ACCESS_DENIED');
        return;
      }

      setStatus('[INITIALIZING_MICROPHONE...]');
      clearTranscriptions();
      await startRecording();
      setStatus('[RECORDING_ACTIVE]');
    } catch (error) {
      console.error('Recording error:', error);
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setMicPermissionStatus('denied');
        setStatus('[ERROR] MICROPHONE_PERMISSION_DENIED');
      } else {
        setStatus(
          `[ERROR] ${error instanceof Error ? error.message : 'Failed to start recording'}`
        );
      }
    }
  };

  const handleStopRecording = () => {
    stopRecording();
    setStatus('[RECORDING_STOPPED]');
  };

  return (
    <div
      className="chunk-processor-container"
      style={{
        position: 'relative',
        minHeight: '100vh',
        color: '#00ff41',
        padding: '20px',
      }}
    >
      <button className="matrix-back-button" onClick={onBack}>
        [&lt; BACK]
      </button>

      <div className="matrix-grid" />
      <div className="scan-line" />

      <div
        style={{
          maxWidth: '800px',
          margin: '40px auto',
          background: 'rgba(0, 0, 0, 0.8)',
          border: '1px solid #00ff41',
          padding: '30px',
          backdropFilter: 'blur(10px)',
        }}
      >
        <h1
          style={{
            fontSize: '2rem',
            marginBottom: '20px',
            textAlign: 'center',
            textShadow: '0 0 10px #00ff41',
          }}
        >
          &gt; {viewMode === 'conversational' ? 'CONVERSATIONAL_CHUNKS' : 'CHUNK_PROCESSOR'}_MODULE
        </h1>

        {/* View Mode Toggle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '30px',
            gap: '10px',
          }}
        >
          <button
            onClick={() => setViewMode('processor')}
            className="matrix-button"
            style={{
              padding: '8px 16px',
              background: viewMode === 'processor' ? '#00ff41' : 'rgba(0, 255, 65, 0.1)',
              color: viewMode === 'processor' ? '#000' : '#00ff41',
              border: '1px solid #00ff41',
              cursor: 'pointer',
            }}
          >
            [PROCESSOR_VIEW]
          </button>
          <button
            onClick={() => setViewMode('conversational')}
            className="matrix-button"
            style={{
              padding: '8px 16px',
              background: viewMode === 'conversational' ? '#00ff41' : 'rgba(0, 255, 65, 0.1)',
              color: viewMode === 'conversational' ? '#000' : '#00ff41',
              border: '1px solid #00ff41',
              cursor: 'pointer',
            }}
          >
            [CONVERSATIONAL_VIEW]
          </button>
        </div>

        {/* Status Display */}
        {status && (
          <div
            className={`matrix-status ${status.includes('ERROR') ? 'error' : ''}`}
            style={{
              marginBottom: '20px',
              padding: '10px',
              background: status.includes('ERROR')
                ? 'rgba(255, 0, 0, 0.1)'
                : 'rgba(0, 255, 65, 0.1)',
              border: `1px solid ${status.includes('ERROR') ? '#ff0041' : '#00ff41'}`,
            }}
          >
            &gt; {status}
          </div>
        )}

        {/* Processor View */}
        {viewMode === 'processor' && (
          <>
            {/* Chunk Duration Control */}
            <TemporalSegmentSelector
              value={chunkDuration}
              onChange={setChunkDuration}
              showOverlap={true}
              overlapDuration={overlapDuration}
            />

            {/* Recording Controls */}
            <div style={{ marginBottom: '30px', textAlign: 'center' }}>
              <button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                disabled={isProcessing || !whisperReady}
                className="matrix-button"
                style={{
                  padding: '15px 40px',
                  fontSize: '1.2rem',
                  background: isRecording ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 255, 65, 0.1)',
                  borderColor: isRecording ? '#ff0041' : '#00ff41',
                  color: isRecording ? '#ff0041' : '#00ff41',
                  opacity: isProcessing || !whisperReady ? 0.5 : 1,
                }}
              >
                {isRecording ? '[STOP_RECORDING] ⏹️' : '[START_RECORDING] 🎙️'}
              </button>

              {!whisperReady && (
                <div style={{ marginTop: '10px' }}>
                  [LOADING_WHISPER: {(whisperProgress * 100).toFixed(0)}%]
                </div>
              )}
            </div>

            {/* Recording Stats */}
            {isRecording && (
              <div
                style={{
                  marginBottom: '20px',
                  padding: '15px',
                  background: 'rgba(0, 255, 65, 0.1)',
                  border: '1px solid #00ff41',
                }}
              >
                &gt; [RECORDING_ACTIVE]
                <br />
                &gt; CHUNKS_CAPTURED: {audioChunks.length}
                <br />
                &gt; AVG_VAD_SCORE: {(averageVad * 100).toFixed(1)}%<br />
                &gt; DURATION: {audioChunks.length * chunkDuration}s
              </div>
            )}

            {/* Real-time Transcription */}
            {transcriptions.length > 0 && (
              <div
                style={{
                  marginTop: '20px',
                  padding: '20px',
                  background: 'rgba(0, 255, 65, 0.05)',
                  border: '1px solid #00ff41',
                  maxHeight: '400px',
                  overflow: 'auto',
                }}
              >
                <h3 style={{ marginBottom: '15px' }}>&gt; REAL_TIME_TRANSCRIPTION:</h3>
                <div style={{ fontFamily: 'monospace', lineHeight: '1.6' }}>
                  {transcriptions.map((transcription, index) => (
                    <div
                      key={index}
                      style={{
                        marginBottom: '15px',
                        padding: '10px',
                        background: 'rgba(0, 255, 65, 0.05)',
                        borderLeft: '3px solid #00ff41',
                      }}
                    >
                      <span
                        style={{
                          opacity: 0.6,
                          fontSize: '0.9rem',
                          display: 'block',
                          marginBottom: '5px',
                        }}
                      >
                        [CHUNK_{transcription.chunkIndex || index + 1} @{' '}
                        {(transcription.chunkIndex || index + 1) * chunkDuration}s]
                      </span>
                      {transcription.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div
              style={{
                marginTop: '30px',
                padding: '15px',
                background: 'rgba(0, 255, 65, 0.05)',
                fontSize: '0.9rem',
                opacity: 0.8,
                border: '1px solid rgba(0, 255, 65, 0.3)',
              }}
            >
              &gt; INSTRUCTIONS:
              <br />
              &gt; 1. Configure chunk duration (current: {chunkDuration}s)
              <br />
              &gt; 2. Press [START_RECORDING] to capture audio
              <br />
              &gt; 3. Transcription appears with {chunkDuration}s delay
              <br />
              &gt; 4. Each chunk overlaps by {overlapDuration}s for continuity
              <br />
              &gt; 5. WAV format @ 16kHz for optimal processing
            </div>
          </>
        )}

        {/* Conversational View - FUTURE IMPLEMENTATION */}
        {viewMode === 'conversational' && (
          <>
            {/* 🔥 REAL-TIME CONVERSATIONAL FLOW */}
            <div
              style={{
                marginBottom: '20px',
                padding: '15px',
                background: 'rgba(0, 255, 65, 0.1)',
                border: '1px solid #00ff41',
                fontSize: '0.9rem',
              }}
            >
              &gt; 🎤 Audio Input → 🧠 Murmuraba (Neural Clean) → 🤖 Whisper (AI Transcribe) → ✨ SusurroChunk → 💬 UI Update
              <br />
              &gt; Each chunk is a complete conversational unit with audio + transcript
            </div>

            {/* Recording Controls for Conversational Mode */}
            <div style={{ marginBottom: '30px', textAlign: 'center' }}>
              <button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                disabled={isProcessing || !whisperReady}
                className="matrix-button"
                style={{
                  padding: '15px 40px',
                  fontSize: '1.2rem',
                  background: isRecording ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 255, 65, 0.1)',
                  borderColor: isRecording ? '#ff0041' : '#00ff41',
                  color: isRecording ? '#ff0041' : '#00ff41',
                  opacity: isProcessing || !whisperReady ? 0.5 : 1,
                }}
              >
                {isRecording ? '[STOP_RECORDING] ⏹️' : '[START_RECORDING] 🎙️'}
              </button>

              {!whisperReady && (
                <div style={{ marginTop: '10px' }}>
                  [LOADING_WHISPER: {(whisperProgress * 100).toFixed(0)}%]
                </div>
              )}
            </div>

            {/* Chunk Duration Control for Conversational Mode */}
            <TemporalSegmentSelector
              value={chunkDuration}
              onChange={setChunkDuration}
              variant="simple"
              label="CONVERSATIONAL_CHUNK_DURATION_SEC"
            />

            {/* Real-time Messages Display */}
            {messages.length > 0 && (
              <div
                style={{
                  marginBottom: '20px',
                  padding: '15px',
                  background: 'rgba(0, 255, 65, 0.05)',
                  border: '1px solid #00ff41',
                  maxHeight: '300px',
                  overflow: 'auto',
                }}
              >
                <h3 style={{ marginBottom: '10px' }}>&gt; REAL_TIME_MESSAGES ({messages.length}):</h3>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      marginBottom: '10px',
                      padding: '10px',
                      background: 'rgba(0, 255, 65, 0.05)',
                      borderLeft: '3px solid #00ff41',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '5px' }}>
                      [{new Date(msg.timestamp).toLocaleTimeString()}] VAD: {(msg.vadScore * 100).toFixed(1)}%
                    </div>
                    <div>{msg.text || '[Processing...]'}</div>
                    <audio 
                      src={msg.audioUrl} 
                      controls 
                      style={{ 
                        width: '100%', 
                        height: '30px', 
                        marginTop: '5px',
                        filter: 'hue-rotate(120deg)' 
                      }} 
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Conversational Chat Feed - Alternative View */}
            <ConversationalChatFeed
              chunks={conversationalChunks}
              isRecording={isRecording}
              onClearChat={() => {
                clearConversationalChunks();
                setMessages([]); // Clear messages too
              }}
              style={{
                height: 'calc(100vh - 300px)',
                minHeight: '500px',
                marginBottom: '20px',
              }}
            />

            {/* Conversational Instructions */}
            <div
              style={{
                padding: '15px',
                background: 'rgba(0, 255, 65, 0.05)',
                fontSize: '0.9rem',
                opacity: 0.8,
                border: '1px solid rgba(0, 255, 65, 0.3)',
              }}
            >
              &gt; CONVERSATIONAL_MODE_INSTRUCTIONS:
              <br />
              &gt; 1. Start recording to see real-time audio chunks
              <br />
              &gt; 2. Each chunk appears as a chat message instantly
              <br />
              &gt; 3. Click ▶️ to play audio with waveform visualization
              <br />
              &gt; 4. Transcription streams in real-time
              <br />
              &gt; 5. Use [CLEAR] to reset the conversation
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes blink {
          0%,
          50% {
            opacity: 1;
          }
          51%,
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};
