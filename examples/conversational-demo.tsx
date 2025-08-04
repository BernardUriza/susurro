/**
 * Conversational Demo - ChatGPT-style Voice Interface
 * Demonstrates the new SusurroChunk real-time emission system
 */

import React, { useState } from 'react';
import { useSusurro, SusurroChunk } from '../packages/susurro/src';

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

  // Initialize Susurro with conversational features
  const { 
    processAudioFile, 
    isProcessing, 
    whisperReady,
    conversationalChunks,
    clearConversationalChunks 
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMessages([]); // Clear previous messages
    
    try {
      await processAudioFile(file);
      console.log('🎉 File processed successfully!');
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
        <h1>🗣️ Susurro Conversational Demo</h1>
        <p>Upload an audio file to see ChatGPT-style real-time processing</p>
        
        <div className="status-bar">
          <span className={`status ${whisperReady ? 'ready' : 'loading'}`}>
            {whisperReady ? '✅ Whisper Ready' : '⏳ Loading Models...'}
          </span>
          {isProcessing && <span className="status processing">🔄 Processing...</span>}
        </div>
      </div>

      <div className="upload-section">
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          disabled={!whisperReady || isUploading}
          className="file-input"
        />
        <button onClick={clearChat} disabled={messages.length === 0}>
          🗑️ Clear Chat
        </button>
      </div>

      <div className="chat-interface">
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>Upload an audio file to start the conversation...</p>
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
        
        {conversationalChunks.length > 0 && (
          <div className="stats-panel">
            <h3>📊 Processing Stats</h3>
            <div className="stats-grid">
              <div className="stat">
                <span className="label">Total Chunks:</span>
                <span className="value">{conversationalChunks.length}</span>
              </div>
              <div className="stat">
                <span className="label">Avg Latency:</span>
                <span className="value">
                  {Math.round(
                    conversationalChunks
                      .filter(c => c.processingLatency)
                      .reduce((sum, c) => sum + (c.processingLatency || 0), 0) /
                    conversationalChunks.filter(c => c.processingLatency).length
                  )}ms
                </span>
              </div>
              <div className="stat">
                <span className="label">Avg VAD:</span>
                <span className="value">
                  {(conversationalChunks.reduce((sum, c) => sum + c.vadScore, 0) / 
                    conversationalChunks.length * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConversationalDemo;