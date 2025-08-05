'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { WaveformAnalyzer } from 'murmuraba';
import type { SusurroChunk } from '@susurro/core';
import { StreamingText } from '../streaming-text';

interface ChatMessageProps {
  chunk: SusurroChunk;
  index: number;
  isLatest: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  chunk,
  index,
  isLatest,
  className = '',
  style = {},
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isStreamingText, setIsStreamingText] = useState(false);

  // Handle audio events
  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatLatency = (latency?: number) => {
    if (!latency) return 'N/A';
    return `${latency.toFixed(0)}ms`;
  };

  const getCompletionStatus = () => {
    if (!chunk.isComplete) return 'PROCESSING...';
    if (chunk.transcript && chunk.audioUrl) return 'COMPLETE';
    return 'PARTIAL';
  };

  const getStatusColor = () => {
    if (!chunk.isComplete) return '#ffaa00';
    if (chunk.transcript && chunk.audioUrl) return '#00ff41';
    return '#ff6600';
  };

  // Start streaming text if this is the latest chunk
  useEffect(() => {
    if (isLatest && chunk.transcript && !isStreamingText) {
      setIsStreamingText(true);
    }
  }, [isLatest, chunk.transcript, isStreamingText]);

  return (
    <motion.div
      className={`chat-message ${className}`}
      layout
      style={{
        background: 'rgba(0, 255, 65, 0.05)',
        border: '1px solid rgba(0, 255, 65, 0.3)',
        borderRadius: '0',
        padding: '16px',
        marginBottom: '8px',
        position: 'relative',
        ...style,
      }}
    >
      {/* Message Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          fontSize: '0.8rem',
          color: '#00ff41',
          opacity: 0.8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>&gt; CHUNK_{index + 1}</span>
          <span
            style={{
              color: getStatusColor(),
              fontWeight: 'bold',
            }}
          >
            [{getCompletionStatus()}]
          </span>
          {chunk.vadScore !== undefined && <span>VAD: {(chunk.vadScore * 100).toFixed(1)}%</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {chunk.processingLatency && <span>⚡ {formatLatency(chunk.processingLatency)}</span>}
          <span>{formatTime((chunk.endTime - chunk.startTime) / 1000)}</span>
        </div>
      </div>

      {/* Audio Player Section */}
      {chunk.audioUrl && (
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(0, 255, 65, 0.2)',
            padding: '12px',
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px',
            }}
          >
            {/* Play/Pause Button */}
            <button
              onClick={handlePlayPause}
              className="matrix-button"
              style={{
                width: '36px',
                height: '36px',
                background: isPlaying ? 'rgba(255, 165, 0, 0.2)' : 'rgba(0, 255, 65, 0.1)',
                border: `1px solid ${isPlaying ? '#ffaa00' : '#00ff41'}`,
                color: isPlaying ? '#ffaa00' : '#00ff41',
                fontSize: '1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: '0',
              }}
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>

            {/* Time Display */}
            <div
              style={{
                fontSize: '0.8rem',
                color: '#00ff41',
                minWidth: '60px',
              }}
            >
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            {/* Progress Bar */}
            <div
              style={{
                flex: 1,
                height: '4px',
                background: 'rgba(0, 255, 65, 0.1)',
                position: 'relative',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                  background: isPlaying ? '#ffaa00' : '#00ff41',
                  transition: 'width 0.1s ease',
                }}
              />
            </div>
          </div>

          {/* Professional Waveform Visualizer from Murmuraba */}
          {chunk.audioUrl && (
            <div
              style={{
                marginTop: '8px',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <WaveformAnalyzer
                audioUrl={chunk.audioUrl}
                color={isPlaying ? '#ffaa00' : '#00ff41'}
                isActive={true}
                isPaused={!isPlaying}
                hideControls={true}
                volume={1.0}
                width={280}
                height={60}
                onPlayStateChange={setIsPlaying}
                aria-label={`Audio waveform for chunk ${index + 1}`}
              />
            </div>
          )}

          {/* Hidden Audio Element */}
          <audio
            ref={audioRef}
            src={chunk.audioUrl}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            preload="metadata"
          />
        </div>
      )}

      {/* Transcript Section */}
      {chunk.transcript && (
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(0, 255, 65, 0.2)',
            padding: '12px',
            minHeight: '40px',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              color: '#00ff41',
              opacity: 0.7,
              marginBottom: '8px',
            }}
          >
            &gt; TRANSCRIPT:
          </div>

          <div
            style={{
              color: '#00ff41',
              lineHeight: '1.5',
              fontSize: '0.95rem',
            }}
          >
            {isLatest && isStreamingText ? (
              <StreamingText
                text={chunk.transcript}
                speed={50}
                onComplete={() => setIsStreamingText(false)}
              />
            ) : (
              chunk.transcript
            )}
          </div>
        </div>
      )}

      {/* Processing Indicator */}
      {!chunk.isComplete && (
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            background: '#ffaa00',
            borderRadius: '50%',
          }}
        />
      )}

      {/* Metadata */}
      {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
        <div
          style={{
            marginTop: '8px',
            fontSize: '0.7rem',
            color: '#00ff41',
            opacity: 0.5,
          }}
        >
          &gt;{' '}
          {Object.entries(chunk.metadata)
            .map(([key, value]) => `${key}: ${value}`)
            .join(' | ')}
        </div>
      )}
    </motion.div>
  );
};
