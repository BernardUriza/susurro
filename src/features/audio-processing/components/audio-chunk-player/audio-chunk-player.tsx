import React, { useState, useRef, useEffect } from 'react';

interface AudioChunkPlayerProps {
  audioUrl: string;
  duration?: number;
  vadScore?: number;
  chunkId?: string;
  color?: string;
}

export const AudioChunkPlayer: React.FC<AudioChunkPlayerProps> = ({
  audioUrl,
  duration,
  vadScore,
  chunkId: _chunkId, // Keep for future use
  color = '#00ff41'
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Preload audio
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.addEventListener('play', () => setIsPlaying(true));
    audio.addEventListener('pause', () => setIsPlaying(false));
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });
    audio.addEventListener('loadstart', () => setIsLoading(true));
    audio.addEventListener('canplay', () => setIsLoading(false));

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [audioUrl]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error('Failed to play audio:', err);
      });
    }
  };

  const handleStop = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
  };

  const progressPercent = duration ? (currentTime / (duration / 1000)) * 100 : 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px',
        background: `${color}10`,
        border: `1px solid ${color}`,
        borderRadius: '6px',
        marginTop: '8px',
      }}
    >
      {/* Play/Pause Button */}
      <button
        onClick={handlePlayPause}
        disabled={isLoading}
        style={{
          background: isPlaying ? `${color}30` : `${color}20`,
          border: `1px solid ${color}`,
          color: color,
          width: '32px',
          height: '32px',
          borderRadius: '4px',
          cursor: isLoading ? 'wait' : 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isLoading ? '⏳' : isPlaying ? '⏸' : '▶'}
      </button>

      {/* Stop Button */}
      <button
        onClick={handleStop}
        style={{
          background: `${color}20`,
          border: `1px solid ${color}`,
          color: color,
          width: '32px',
          height: '32px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ⏹
      </button>

      {/* Progress Bar */}
      <div
        style={{
          flex: 1,
          height: '4px',
          background: `${color}20`,
          borderRadius: '2px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${progressPercent}%`,
            background: color,
            transition: 'width 0.1s',
          }}
        />
      </div>

      {/* Info */}
      <div style={{ fontSize: '0.7rem', color: color, minWidth: '80px' }}>
        {vadScore !== undefined && (
          <div style={{ opacity: 0.7 }}>VAD: {(vadScore * 100).toFixed(0)}%</div>
        )}
        {duration && (
          <div style={{ opacity: 0.7 }}>
            {(currentTime).toFixed(1)}s / {(duration / 1000).toFixed(1)}s
          </div>
        )}
      </div>
    </div>
  );
};