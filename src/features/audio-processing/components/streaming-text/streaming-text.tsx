'use client';

import React, { useState, useEffect } from 'react';

interface StreamingTextProps {
  text: string;
  speed?: number; // milliseconds between characters
  onComplete?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const StreamingText: React.FC<StreamingTextProps> = ({
  text,
  speed = 30,
  onComplete,
  className = '',
  style = {},
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, speed);

      return () => clearTimeout(timer);
    } else if (currentIndex === text.length && onComplete) {
      onComplete();
    }
  }, [currentIndex, text, speed, onComplete]);

  // Reset when text changes
  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  return (
    <span className={className} style={style}>
      {displayedText}
      {currentIndex < text.length && (
        <span
          style={{
            opacity: 0.7,
            animation: 'blink 1s infinite',
          }}
        >
          █
        </span>
      )}
    </span>
  );
};
