/**
 * Conversational Demo - ChatGPT-style Voice Interface
 * Phase 3: Real-time Recording with Latency Optimization
 * Demonstrates the new SusurroChunk real-time emission system
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSusurro, SusurroChunk, type LatencyReport } from '../packages/susurro/src';

interface VoiceMessage {
  id: string;
  audioUrl: string;
  text: string;
  timestamp: number;
  processingLatency?: number;
  vadScore: number;
  isComplete: boolean;
}

export function ConversationalDemo() {
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [middlewareSettings, setMiddlewareSettings] = useState({
    quality: true,
    sentiment: false,
    intent: false,
    translation: false,
  });
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Susurro with conversational features and Phase 3 enhancements
  const { 
    startRecording,
    stopRecording,
    isRecording,
    isProcessing, 
    whisperReady,
    conversationalChunks,
    clearConversationalChunks,
    middlewarePipeline,
    latencyReport,
    latencyStatus
  } = useSusurro({
    // Optimize for conversational audio
    chunkDurationMs: 6000,      // 6-second chunks for natural speech
    enableVAD: true,            // Voice Activity Detection
    
    // Whisper configuration
    whisperConfig: {
      language: 'en',
      model: 'whisper-1'
    },
    
    // 🚀 Conversational Features
    conversational: {
      // Real-time chunk processing
      onChunk: (chunk: SusurroChunk) => {
        console.log(`📦 New chunk processed in ${chunk.processingLatency}ms`);
        console.log(`🎯 VAD Score: ${chunk.vadScore}`);
        console.log(`✅ Complete: ${chunk.isComplete}`);
        
        const message: VoiceMessage = {
          id: chunk.id,
          audioUrl: chunk.audioUrl,
          text: chunk.transcript,
          timestamp: chunk.startTime,
          processingLatency: chunk.processingLatency,
          vadScore: chunk.vadScore,
          isComplete: chunk.isComplete
        };
        
        setMessages(prev => [...prev, message]);
      },
      
      // Process transcriptions in real-time
      enableInstantTranscription: true,
      
      // Maximum 3 seconds wait for transcript
      chunkTimeout: 3000,
      
      // Enable advanced processing hooks
      enableChunkEnrichment: true
    }
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Update middleware settings
  useEffect(() => {
    Object.entries(middlewareSettings).forEach(([name, enabled]) => {
      if (enabled) {
        middlewarePipeline.enable(name);
      } else {
        middlewarePipeline.disable(name);
      }
    });
  }, [middlewareSettings, middlewarePipeline]);

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      setMessages([]); // Clear previous messages
      await startRecording();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMessages([]); // Clear previous messages
    
    try {
      // Note: File upload is deprecated in v3, but keeping for demo compatibility
      console.log('🎉 File selected, but real-time recording is preferred in v3');
      alert('File upload is deprecated in v3. Use the "Start Recording" button instead!');
    } catch (error) {
      console.error('❌ Processing error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    clearConversationalChunks();
  };

  return (
    <div className="conversational-demo">
      <div className="demo-header">
        <h1>🗣️ Susurro Conversational Demo v3</h1>
        <p>Real-time recording with ChatGPT-style processing and <300ms latency</p>
        
        <div className="status-bar">
          <span className={`status ${whisperReady ? 'ready' : 'loading'}`}>
            {whisperReady ? '✅ Whisper Ready' : '⏳ Loading Models...'}
          </span>
          {isProcessing && <span className="status processing">🔄 Processing...</span>}
          {isRecording && <span className="status recording">🔴 Recording...</span>}
          <span className={`status latency ${latencyStatus.isHealthy ? 'healthy' : 'warning'}`}>
            ⚡ {latencyStatus.currentLatency}ms ({latencyStatus.trend})
          </span>
        </div>
      </div>

      <div className="controls-section">
        <div className="recording-controls">
          <button 
            onClick={toggleRecording} 
            disabled={!whisperReady}
            className={`recording-button ${isRecording ? 'recording' : ''}`}
          >
            {isRecording ? '⏹️ Stop Recording' : '🎤 Start Recording'}
          </button>
          <button onClick={clearChat} disabled={messages.length === 0}>
            🗑️ Clear Chat
          </button>
        </div>

        <div className="middleware-controls">
          <h3>🛠️ Middleware Controls</h3>
          <div className="middleware-toggles">
            {Object.entries(middlewareSettings).map(([name, enabled]) => (
              <label key={name} className="middleware-toggle">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setMiddlewareSettings(prev => ({
                    ...prev,
                    [name]: e.target.checked
                  }))}
                />
                <span className="toggle-label">{name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="upload-section-legacy">
          <details>
            <summary>📁 Legacy File Upload (Deprecated)</summary>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              disabled={!whisperReady || isUploading}
              className="file-input"
            />
          </details>
        </div>
      </div>

      <div className="chat-interface">
        <div className="messages-container" ref={messagesContainerRef}>
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>🎤 Click "Start Recording" to begin real-time conversation...</p>
              <small>Phase 3: Neural audio processing with <300ms latency</small>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="message">
                <div className="message-header">
                  <span className="timestamp">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                  <div className="message-stats">
                    <span className={`completion-badge ${message.isComplete ? 'complete' : 'incomplete'}`}>
                      {message.isComplete ? '✅' : '⏳'}
                    </span>
                    {message.processingLatency && (
                      <span className="latency">⚡ {message.processingLatency}ms</span>
                    )}
                    <span className="vad-score">🎯 {(message.vadScore * 100).toFixed(1)}%</span>
                  </div>
                </div>
                
                <div className="message-content">
                  <audio src={message.audioUrl} controls preload="none" />
                  <p className="transcript">{message.text}</p>
                  {!message.isComplete && (
                    <small className="incomplete-notice">
                      ⚠️ Transcript may be incomplete
                    </small>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="stats-panel">
          <h3>📊 Phase 3 Analytics</h3>
          <div className="stats-grid">
            <div className="stat">
              <span className="label">Total Chunks:</span>
              <span className="value">{conversationalChunks.length}</span>
            </div>
            
            {latencyReport.sampleCount > 0 && (
              <>
                <div className="stat">
                  <span className="label">Avg Latency:</span>
                  <span className={`value ${latencyReport.averageLatency < 300 ? 'good' : 'warning'}`}>
                    {Math.round(latencyReport.averageLatency)}ms
                  </span>
                </div>
                <div className="stat">
                  <span className="label">P95 Latency:</span>
                  <span className={`value ${latencyReport.p95Latency < 300 ? 'good' : 'warning'}`}>
                    {Math.round(latencyReport.p95Latency)}ms
                  </span>
                </div>
                <div className="stat">
                  <span className="label">Target Met:</span>
                  <span className={`value ${latencyReport.targetMet ? 'good' : 'warning'}`}>
                    {latencyReport.targetMet ? '✅' : '❌'}
                  </span>
                </div>
              </>
            )}
            
            {conversationalChunks.length > 0 && (
              <div className="stat">
                <span className="label">Avg VAD:</span>
                <span className="value">
                  {(conversationalChunks.reduce((sum, c) => sum + c.vadScore, 0) / 
                    conversationalChunks.length * 100).toFixed(1)}%
                </span>
              </div>
            )}

            <div className="stat">
              <span className="label">Middleware Status:</span>
              <span className="value">
                {Object.values(middlewareSettings).filter(Boolean).length}/{Object.keys(middlewareSettings).length}
              </span>
            </div>
          </div>

          {latencyReport.sampleCount > 0 && (
            <div className="latency-breakdown">
              <h4>🔬 Latency Breakdown</h4>
              <div className="breakdown-stats">
                <div className="breakdown-stat">
                  <span>Audio Processing:</span>
                  <span>{Math.round(latencyReport.breakdown.audioProcessing)}ms</span>
                </div>
                <div className="breakdown-stat">
                  <span>Transcription:</span>
                  <span>{Math.round(latencyReport.breakdown.transcription)}ms</span>
                </div>
                <div className="breakdown-stat">
                  <span>Middleware:</span>
                  <span>{Math.round(latencyReport.breakdown.middleware)}ms</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConversationalDemo;