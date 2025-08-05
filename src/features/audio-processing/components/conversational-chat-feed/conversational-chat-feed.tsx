'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { motion, AnimatePresence } from 'framer-motion';
import type { SusurroChunk } from '@susurro/core';
import { ChatMessage } from '../chat-message';

interface ConversationalChatFeedProps {
  chunks: SusurroChunk[];
  isRecording: boolean;
  onClearChat?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const ConversationalChatFeed: React.FC<ConversationalChatFeedProps> = ({
  chunks,
  isRecording,
  onClearChat,
  className = '',
  style = {},
}) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [lastChunkCount, setLastChunkCount] = useState(0);

  // Auto-scroll to bottom when new chunks arrive
  useEffect(() => {
    if (chunks.length > lastChunkCount && shouldAutoScroll) {
      virtuosoRef.current?.scrollToIndex({
        index: chunks.length - 1,
        behavior: 'smooth',
        align: 'end',
      });
    }
    setLastChunkCount(chunks.length);
  }, [chunks.length, lastChunkCount, shouldAutoScroll]);

  // Disable auto-scroll when user scrolls up manually
  const handleScroll = useCallback(() => {
    virtuosoRef.current?.getState((state: any) => {
      const isAtBottom =
        state.isScrolling === false &&
        state.scrollTop + state.viewportHeight >= state.scrollHeight - 50;
      setShouldAutoScroll(isAtBottom);
    });
  }, []);

  // Re-enable auto-scroll when recording starts
  useEffect(() => {
    if (isRecording) {
      setShouldAutoScroll(true);
    }
  }, [isRecording]);

  const renderMessage = useCallback(
    (index: number) => {
      const chunk = chunks[index];
      if (!chunk) return null;

      return (
        <motion.div
          key={chunk.id}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
            duration: 0.5,
          }}
          style={{
            padding: '8px 16px',
            marginBottom: '8px',
          }}
        >
          <ChatMessage chunk={chunk} index={index} isLatest={index === chunks.length - 1} />
        </motion.div>
      );
    },
    [chunks]
  );

  if (chunks.length === 0) {
    return (
      <div
        className={`conversational-chat-feed ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '400px',
          background: 'rgba(0, 0, 0, 0.8)',
          border: '1px solid #00ff41',
          borderRadius: '0',
          position: 'relative',
          overflow: 'hidden',
          ...style,
        }}
      >
        {/* Matrix rain background effect */}
        <div
          className="matrix-grid"
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.1,
            pointerEvents: 'none',
          }}
        />

        {/* Empty state */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#00ff41',
            textAlign: 'center',
            padding: '40px',
          }}
        >
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <div
              style={{
                fontSize: '1.5rem',
                marginBottom: '16px',
                textShadow: '0 0 10px #00ff41',
              }}
            >
              &gt; CONVERSATIONAL_FEED_READY
            </div>
            <div
              style={{
                fontSize: '0.9rem',
                opacity: 0.7,
                lineHeight: '1.6',
              }}
            >
              &gt; Start recording to see audio chunks
              <br />
              &gt; Each chunk will appear as a chat message
              <br />
              &gt; With instant audio playback + transcription
            </div>
          </motion.div>
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
        height: '400px',
        background: 'rgba(0, 0, 0, 0.8)',
        border: '1px solid #00ff41',
        borderRadius: '0',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(0, 255, 65, 0.3)',
          background: 'rgba(0, 255, 65, 0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            color: '#00ff41',
            fontSize: '0.9rem',
            fontWeight: 'bold',
          }}
        >
          &gt; CONVERSATIONAL_FEED [{chunks.length} chunks]
        </div>

        {onClearChat && (
          <button
            onClick={onClearChat}
            className="matrix-button"
            style={{
              padding: '4px 12px',
              fontSize: '0.8rem',
              background: 'rgba(255, 0, 0, 0.1)',
              border: '1px solid #ff0041',
              color: '#ff0041',
              cursor: 'pointer',
            }}
          >
            [CLEAR]
          </button>
        )}
      </div>

      {/* Chat Messages - Virtualized */}
      <div style={{ flex: 1, position: 'relative' }}>
        <AnimatePresence mode="popLayout">
          <Virtuoso
            ref={virtuosoRef}
            data={chunks}
            totalCount={chunks.length}
            itemContent={renderMessage}
            followOutput="smooth"
            onScroll={handleScroll}
            style={{
              height: '100%',
              width: '100%',
            }}
            components={{
              Scroller: (props: any) => (
                <div
                  {...props}
                  style={{
                    ...props.style,
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#00ff41 transparent',
                  }}
                />
              ),
            }}
          />
        </AnimatePresence>
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            background: 'rgba(0, 255, 65, 0.1)',
            border: '1px solid #00ff41',
            padding: '8px 12px',
            fontSize: '0.8rem',
            color: '#00ff41',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            style={{
              width: '8px',
              height: '8px',
              background: '#00ff41',
              borderRadius: '50%',
            }}
          />
          [RECORDING...]
        </motion.div>
      )}

      {/* Auto-scroll indicator */}
      {!shouldAutoScroll && chunks.length > 0 && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => {
            setShouldAutoScroll(true);
            virtuosoRef.current?.scrollToIndex({
              index: chunks.length - 1,
              behavior: 'smooth',
              align: 'end',
            });
          }}
          className="matrix-button"
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            background: 'rgba(0, 255, 65, 0.1)',
            border: '1px solid #00ff41',
            color: '#00ff41',
            padding: '8px 12px',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          ↓ [SCROLL_TO_BOTTOM]
        </motion.button>
      )}
    </div>
  );
};
