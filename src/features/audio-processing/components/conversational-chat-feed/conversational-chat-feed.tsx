'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { motion, AnimatePresence } from 'framer-motion';
import { useSusurro } from '@susurro/core';
import type { StreamingSusurroChunk } from '@susurro/core';
import { AudioChunkPlayer } from '../audio-chunk-player/audio-chunk-player';

interface ConversationalChatFeedProps {
  className?: string;
  style?: React.CSSProperties;
  onChatStart?: () => void;
  onChatEnd?: (chunks: StreamingSusurroChunk[]) => void;
}

// Chat message interface for our conversational feed
interface ChatConversation {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  audioChunk?: StreamingSusurroChunk;
  vadScore?: number;
  processingTime?: number;
  audioUrl?: string; // URL for playback
}

export const ConversationalChatFeed: React.FC<ConversationalChatFeedProps> = ({
  className = '',
  style = {},
  onChatStart,
  onChatEnd,
}) => {
  // 🚀 CONSOLIDATED SUSURRO - All audio functionality in one place
  const {
    // Streaming recording with modern callback pattern
    startStreamingRecording,
    stopStreamingRecording,
    isEngineInitialized,
    engineError,
    whisperReady,
    whisperProgress,
    initializeAudioEngine,
  } = useSusurro({
    chunkDurationMs: 2000, // 2-second chunks for conversational flow
    whisperConfig: {
      language: 'en',
    },
  });

  // UI State
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [recordingChunks, setRecordingChunks] = useState<StreamingSusurroChunk[]>([]);
  const audioUrlsRef = useRef<Set<string>>(new Set());

  // Add system welcome message
  useEffect(() => {
    setConversations([
      {
        id: 'system-welcome',
        type: 'system',
        content:
          '[SUSURRO_CONVERSATIONAL_INITIALIZED] Ready for voice conversation. Press record to start talking.',
        timestamp: Date.now(),
      },
    ]);
  }, []);

  // Cleanup audio URLs on unmount
  useEffect(() => {
    return () => {
      audioUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      audioUrlsRef.current.clear();
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (shouldAutoScroll && conversations.length > 0) {
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: conversations.length - 1,
          behavior: 'smooth',
          align: 'end',
        });
      }, 100);
    }
  }, [conversations.length, shouldAutoScroll]);

  // 🎤 STREAMING RECORDING HANDLER - Modern React 19 Callback Pattern
  const handleStartRecording = useCallback(async () => {
    if (!isEngineInitialized || !whisperReady) {
      if (!isEngineInitialized) {
        await initializeAudioEngine();
      }
      return;
    }

    setIsRecording(true);
    setCurrentMessage('');
    setRecordingChunks([]);
    onChatStart?.();

    // Add recording start message
    setConversations((prev) => [
      ...prev,
      {
        id: `recording-${Date.now()}`,
        type: 'system',
        content: '[RECORDING_STARTED] Listening for voice input...',
        timestamp: Date.now(),
      },
    ]);

    // CALLBACK PATTERN - Each chunk processed in real-time
    const onChunkProcessed = (chunk: StreamingSusurroChunk) => {
      // Store chunk for reference regardless of voice activity
      setRecordingChunks((prev) => [...prev, chunk]);

      // Create audio URL for playback
      const audioUrl = chunk.audioBlob ? URL.createObjectURL(chunk.audioBlob) : undefined;
      if (audioUrl) {
        audioUrlsRef.current.add(audioUrl);
      }

      if (chunk.isVoiceActive && chunk.transcriptionText.trim()) {
        // Accumulate text from chunks
        setCurrentMessage((prev) => {
          const newText = prev + ' ' + chunk.transcriptionText.trim();
          return newText.trim();
        });

        // Add chunk info to conversations for debugging
        setConversations((prev) => [
          ...prev,
          {
            id: `chunk-${chunk.id}`,
            type: 'system',
            content: `[CHUNK] VAD: ${chunk.vadScore?.toFixed(2)} | Text: "${chunk.transcriptionText}"`,
            timestamp: Date.now(),
            audioChunk: chunk,
            vadScore: chunk.vadScore,
            audioUrl,
          },
        ]);

        // Auto-scroll
        setShouldAutoScroll(true);
      } else if (chunk.audioBlob) {
        // Show non-voice chunks too for debugging
        setConversations((prev) => [
          ...prev,
          {
            id: `chunk-silent-${chunk.id}`,
            type: 'system',
            content: `[SILENT CHUNK] VAD: ${chunk.vadScore?.toFixed(2)}`,
            timestamp: Date.now(),
            audioChunk: chunk,
            vadScore: chunk.vadScore,
            audioUrl,
          },
        ]);
      }
    };

    try {
      // START STREAMING - Uses Murmuraba native streaming (not MediaRecorder)
      await startStreamingRecording(onChunkProcessed, {
        chunkDuration: 2, // 2 seconds for responsive conversation
        vadThreshold: 0.3, // Sensitive for quiet speech
        enableRealTimeTranscription: true,
        enableNoiseReduction: true,
      });
    } catch (error) {
      setIsRecording(false);
    }
  }, [
    isEngineInitialized,
    whisperReady,
    initializeAudioEngine,
    startStreamingRecording,
    onChatStart,
  ]);

  // 🤖 AI RESPONSE GENERATOR - moved up to avoid hoisting issues
  const generateAIResponse = useCallback(async (userText: string) => {
    setIsTyping(true);

    // Add typing indicator
    const typingId = `typing-${Date.now()}`;
    setConversations((prev) => [
      ...prev,
      {
        id: typingId,
        type: 'assistant',
        content: '[PROCESSING_RESPONSE...]',
        timestamp: Date.now(),
      },
    ]);

    // Simulate AI processing time
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Generate contextual response
    let response = '';
    const lowerText = userText.toLowerCase();

    if (lowerText.includes('hello') || lowerText.includes('hi')) {
      response =
        'Hello! I heard you clearly through the Susurro audio pipeline. How can I help you today?';
    } else if (lowerText.includes('how are you')) {
      response =
        "I'm doing great! The audio processing worked perfectly - I could hear every word with crystal clarity.";
    } else if (lowerText.includes('test') || lowerText.includes('testing')) {
      response =
        'Testing successful! The Susurro conversational system is working beautifully. Your voice came through with excellent clarity.';
    } else if (lowerText.includes('susurro')) {
      response =
        'Ah, you mentioned Susurro! This conversational interface showcases the real-time streaming capabilities of the consolidated useSusurro hook. Pretty amazing, right?';
    } else {
      response = `I understand you said: "${userText}". The audio quality was excellent thanks to Murmuraba's neural processing and Whisper's transcription!`;
    }

    // Replace typing indicator with actual response
    setConversations((prev) =>
      prev.map((conv) => (conv.id === typingId ? { ...conv, content: response } : conv))
    );

    setIsTyping(false);
  }, []);

  // 🛑 STOP RECORDING HANDLER
  const handleStopRecording = useCallback(async () => {
    const allChunks = await stopStreamingRecording();
    setIsRecording(false);

    // Create final user message
    if (currentMessage.trim()) {
      const userMessage: ChatConversation = {
        id: `user-${Date.now()}`,
        type: 'user',
        content: currentMessage.trim(),
        timestamp: Date.now(),
        vadScore:
          recordingChunks.reduce((acc, chunk) => acc + chunk.vadScore, 0) / recordingChunks.length,
        processingTime: recordingChunks.reduce((acc, chunk) => acc + chunk.duration, 0),
      };

      setConversations((prev) => [...prev, userMessage]);
      setCurrentMessage('');

      // Simulate AI response
      setTimeout(() => {
        generateAIResponse(userMessage.content);
      }, 500);

      onChatEnd?.(allChunks);
    } else {
      // No speech detected
      setConversations((prev) => [
        ...prev,
        {
          id: `no-speech-${Date.now()}`,
          type: 'system',
          content: '[NO_SPEECH_DETECTED] Try speaking closer to the microphone.',
          timestamp: Date.now(),
        },
      ]);
    }
  }, [stopStreamingRecording, currentMessage, recordingChunks, onChatEnd, generateAIResponse]);

  // Clear conversation
  const handleClearChat = useCallback(() => {
    setConversations([
      {
        id: 'system-cleared',
        type: 'system',
        content: '[CONVERSATION_CLEARED] Ready for new voice conversation.',
        timestamp: Date.now(),
      },
    ]);
    setCurrentMessage('');
    setRecordingChunks([]);
  }, []);

  const renderMessage = useCallback(
    (index: number) => {
      const conversation = conversations[index];
      if (!conversation) return null;

      const isUser = conversation.type === 'user';
      const isSystem = conversation.type === 'system';

      return (
        <motion.div
          key={conversation.id}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
          }}
          style={{
            padding: '12px 16px',
            marginBottom: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: isUser ? 'flex-end' : 'flex-start',
          }}
        >
          {/* Message bubble */}
          <div
            style={{
              maxWidth: '80%',
              background: isUser
                ? 'rgba(0, 255, 65, 0.1)'
                : isSystem
                  ? 'rgba(255, 255, 0, 0.1)'
                  : 'rgba(0, 100, 255, 0.1)',
              border: `1px solid ${isUser ? '#00ff41' : isSystem ? '#ffff00' : '#0064ff'}`,
              padding: '12px 16px',
              borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              position: 'relative',
            }}
          >
            {/* Message header */}
            <div
              style={{
                fontSize: '0.7rem',
                opacity: 0.7,
                marginBottom: '4px',
                color: isUser ? '#00ff41' : isSystem ? '#ffff00' : '#0064ff',
                fontWeight: 'bold',
                textTransform: 'uppercase',
              }}
            >
              {isUser ? '> USER_INPUT' : isSystem ? '> SYSTEM' : '> AI_RESPONSE'}
              {conversation.vadScore && (
                <span style={{ marginLeft: '8px' }}>
                  VAD: {(conversation.vadScore * 100).toFixed(1)}%
                </span>
              )}
            </div>

            {/* Message content */}
            <div
              style={{
                color: isUser ? '#00ff41' : isSystem ? '#ffff00' : '#0064ff',
                fontSize: '0.9rem',
                lineHeight: '1.4',
                wordBreak: 'break-word',
              }}
            >
              {conversation.content}
            </div>

            {/* Audio Player */}
            {conversation.audioUrl && (
              <AudioChunkPlayer
                audioUrl={conversation.audioUrl}
                duration={conversation.audioChunk?.duration}
                vadScore={conversation.vadScore}
                chunkId={conversation.audioChunk?.id}
                color={isUser ? '#00ff41' : isSystem ? '#ffff00' : '#0064ff'}
              />
            )}

            {/* Timestamp */}
            <div
              style={{
                fontSize: '0.6rem',
                opacity: 0.5,
                marginTop: '4px',
                textAlign: 'right',
                color: isUser ? '#00ff41' : isSystem ? '#ffff00' : '#0064ff',
              }}
            >
              {new Date(conversation.timestamp).toLocaleTimeString()}
              {conversation.processingTime && (
                <span style={{ marginLeft: '8px' }}>
                  ({conversation.processingTime.toFixed(0)}ms)
                </span>
              )}
            </div>
          </div>
        </motion.div>
      );
    },
    [conversations]
  );

  // Loading state
  if (!whisperReady) {
    return (
      <div
        className={`conversational-chat-feed ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: style.height || '100%',
          minHeight: '400px',
          background: 'rgba(0, 0, 0, 0.9)',
          border: '1px solid #00ff41',
          color: '#00ff41',
          padding: '40px',
          textAlign: 'center',
          ...style,
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{ marginBottom: '20px', fontSize: '2rem' }}
        >
          🧠
        </motion.div>
        <div style={{ fontSize: '1.2rem', marginBottom: '10px' }}>[LOADING_WHISPER_AI_MODEL]</div>
        <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>
          Progress: {(whisperProgress * 100).toFixed(0)}%
        </div>
        <div
          style={{
            width: '200px',
            height: '4px',
            background: 'rgba(0, 255, 65, 0.2)',
            marginTop: '10px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${whisperProgress * 100}%`,
              height: '100%',
              background: '#00ff41',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`conversational-chat-feed ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: style.height || '100%',
        minHeight: '400px',
        background: 'rgba(0, 0, 0, 0.9)',
        border: '2px solid #00ff41',
        borderRadius: '0',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 0 20px rgba(0, 255, 65, 0.3)',
        ...style,
      }}
    >
      {/* Header with status */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid rgba(0, 255, 65, 0.3)',
          background: 'rgba(0, 255, 65, 0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              color: '#00ff41',
              fontSize: '1rem',
              fontWeight: 'bold',
              marginBottom: '4px',
            }}
          >
            &gt; SUSURRO_CONVERSATIONAL_FEED
          </div>
          <div
            style={{
              color: '#00ff41',
              fontSize: '0.7rem',
              opacity: 0.7,
            }}
          >
            Messages: {conversations.length} | Engine: {isEngineInitialized ? 'ONLINE' : 'OFFLINE'}
            {engineError && ` | ERROR: ${engineError}`}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleClearChat}
            className="matrix-button"
            style={{
              padding: '6px 12px',
              fontSize: '0.7rem',
              background: 'rgba(255, 255, 0, 0.1)',
              border: '1px solid #ffff00',
              color: '#ffff00',
              cursor: 'pointer',
            }}
          >
            [CLEAR]
          </button>
        </div>
      </div>

      {/* Chat messages */}
      <div style={{ flex: 1, position: 'relative' }}>
        <AnimatePresence mode="popLayout">
          <Virtuoso
            ref={virtuosoRef}
            data={conversations}
            totalCount={conversations.length}
            itemContent={renderMessage}
            followOutput="smooth"
            style={{ height: '100%', width: '100%' }}
          />
        </AnimatePresence>

        {/* Current message preview while recording */}
        {isRecording && currentMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              position: 'absolute',
              bottom: '80px',
              right: '16px',
              left: '16px',
              background: 'rgba(0, 255, 65, 0.1)',
              border: '1px solid #00ff41',
              padding: '12px',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                fontSize: '0.7rem',
                color: '#00ff41',
                opacity: 0.7,
                marginBottom: '4px',
              }}
            >
              &gt; LIVE_TRANSCRIPTION:
            </div>
            <div style={{ color: '#00ff41', fontSize: '0.9rem' }}>{currentMessage}</div>
          </motion.div>
        )}
      </div>

      {/* Recording controls */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid rgba(0, 255, 65, 0.3)',
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
        }}
      >
        <button
          onClick={handleStartRecording}
          disabled={isRecording || !isEngineInitialized || !whisperReady}
          className="matrix-button"
          style={{
            padding: '12px 24px',
            fontSize: '0.9rem',
            background: isRecording ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 255, 65, 0.1)',
            border: `2px solid ${isRecording ? '#ff0041' : '#00ff41'}`,
            color: isRecording ? '#ff0041' : '#00ff41',
            cursor: isRecording || !isEngineInitialized ? 'not-allowed' : 'pointer',
            opacity: isRecording || !isEngineInitialized ? 0.5 : 1,
          }}
        >
          {isRecording ? '🎤 [RECORDING...]' : '🎤 [START_CONVERSATION]'}
        </button>

        <button
          onClick={handleStopRecording}
          disabled={!isRecording}
          className="matrix-button"
          style={{
            padding: '12px 24px',
            fontSize: '0.9rem',
            background: 'rgba(255, 0, 65, 0.1)',
            border: '2px solid #ff0041',
            color: '#ff0041',
            cursor: !isRecording ? 'not-allowed' : 'pointer',
            opacity: !isRecording ? 0.5 : 1,
          }}
        >
          ⏹️ [SEND_MESSAGE]
        </button>
      </div>

      {/* Status indicators */}
      {isRecording && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 0, 0, 0.2)',
            border: '1px solid #ff0041',
            padding: '8px 12px',
            fontSize: '0.7rem',
            color: '#ff0041',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            style={{
              width: '6px',
              height: '6px',
              background: '#ff0041',
              borderRadius: '50%',
            }}
          />
          [LIVE]
        </motion.div>
      )}

      {isTyping && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'absolute',
            bottom: '80px',
            left: '16px',
            background: 'rgba(0, 100, 255, 0.1)',
            border: '1px solid #0064ff',
            padding: '8px 12px',
            fontSize: '0.7rem',
            color: '#0064ff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
          >
            🤖
          </motion.div>
          [AI_THINKING...]
        </motion.div>
      )}
    </div>
  );
};
