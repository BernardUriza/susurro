import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { formatDuration as formatDurationCore } from '../../utils/time-utils';

export interface IAudioPlayerProps {
  /** Audio source URL */
  src?: string;
  /** Callback when play state changes */
  onPlayStateChange?: (isPlaying: boolean) => void;
  /** Additional CSS classes */
  className?: string;
  /** Label for the audio player */
  label: string;
  /** Force stop the audio playback */
  forceStop?: boolean;
  /** Custom aria-label for accessibility */
  'aria-label'?: string;
  /** Disable the player */
  disabled?: boolean;
  /** Volume level (0-1) */
  volume?: number;
  /** Muted state */
  muted?: boolean;
}

interface IAudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  hasError: boolean;
}

/**
 * Professional audio player component with comprehensive error handling,
 * accessibility support, and clean architecture.
 */
export function AudioPlayer({
  src,
  onPlayStateChange,
  className = '',
  label,
  forceStop = false,
  'aria-label': ariaLabel,
  disabled = false,
  volume = 1,
  muted = false,
}: IAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  
  const [state, setState] = useState<IAudioState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isLoading: false,
    hasError: false,
  });

  // Safe state updater that checks if component is still mounted
  const safeSetState = useCallback((updater: Partial<IAudioState>) => {
    if (mountedRef.current) {
      setState(prev => ({ ...prev, ...updater }));
    }
  }, []);

  // Use unified time formatting utilities
  const formatTime = useCallback((timeInSeconds: number): string => {
    // Convert seconds to milliseconds for the unified formatter
    const milliseconds = timeInSeconds * 1000;
    return formatDurationCore(milliseconds);
  }, []);

  // Calculate progress with safety checks
  const progress = useMemo(() => {
    if (state.duration <= 0 || !isFinite(state.duration)) return 0;
    if (state.currentTime < 0 || !isFinite(state.currentTime)) return 0;
    return Math.min(100, Math.max(0, (state.currentTime / state.duration) * 100));
  }, [state.currentTime, state.duration]);

  // Audio event handlers with proper error boundaries
  const handleLoadStart = useCallback(() => {
    safeSetState({ isLoading: true, hasError: false });
  }, [safeSetState]);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const duration = isFinite(audio.duration) ? audio.duration : 0;
    safeSetState({ 
      duration, 
      isLoading: false,
      hasError: false 
    });
  }, [safeSetState]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !mountedRef.current) return;
    
    safeSetState({ currentTime: audio.currentTime });
  }, [safeSetState]);

  const handleEnded = useCallback(() => {
    safeSetState({ 
      isPlaying: false, 
      currentTime: 0 
    });
    onPlayStateChange?.(false);
  }, [onPlayStateChange, safeSetState]);

  const handleError = useCallback((event: Event) => {
    console.error('Audio playback error:', event);
    safeSetState({ 
      isLoading: false, 
      isPlaying: false, 
      hasError: true 
    });
    onPlayStateChange?.(false);
  }, [onPlayStateChange, safeSetState]);

  // Setup audio event listeners with proper cleanup
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) {
      safeSetState({ hasError: false, isLoading: false });
      return;
    }

    // Event handlers map for clean management
    const eventHandlers = new Map([
      ['loadstart', handleLoadStart],
      ['loadedmetadata', handleLoadedMetadata],
      ['timeupdate', handleTimeUpdate],
      ['ended', handleEnded],
      ['error', handleError],
    ]);

    // Add all event listeners
    eventHandlers.forEach((handler, event) => {
      audio.addEventListener(event, handler);
    });

    // Cleanup function
    return () => {
      eventHandlers.forEach((handler, event) => {
        audio.removeEventListener(event, handler);
      });
    };
  }, [src, handleLoadStart, handleLoadedMetadata, handleTimeUpdate, handleEnded, handleError, safeSetState]);

  // Handle volume and muted state changes
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.muted = muted;
    }
  }, [volume, muted]);

  // Handle forced stop
  useEffect(() => {
    if (forceStop && state.isPlaying && audioRef.current) {
      audioRef.current.pause();
      safeSetState({ isPlaying: false });
      onPlayStateChange?.(false);
    }
  }, [forceStop, state.isPlaying, onPlayStateChange, safeSetState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
    };
  }, []);

  // Toggle play/pause with comprehensive error handling
  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !src || disabled || state.isLoading) return;

    try {
      if (state.isPlaying) {
        audio.pause();
        safeSetState({ isPlaying: false });
        onPlayStateChange?.(false);
      } else {
        await audio.play();
        safeSetState({ isPlaying: true, hasError: false });
        onPlayStateChange?.(true);
      }
    } catch (error) {
      console.error('Playback failed:', error);
      safeSetState({ isPlaying: false, hasError: true });
      onPlayStateChange?.(false);
    }
  }, [state.isPlaying, state.isLoading, src, disabled, onPlayStateChange, safeSetState]);

  // Handle seeking with debouncing for performance
  const handleSeek = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || state.duration <= 0 || disabled) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * state.duration;

    // Clear existing timeout
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
    }

    // Debounce seek operations
    seekTimeoutRef.current = setTimeout(() => {
      if (audio && mountedRef.current) {
        audio.currentTime = newTime;
        safeSetState({ currentTime: newTime });
      }
    }, 50);
  }, [state.duration, disabled, safeSetState]);

  // Keyboard event handling for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      togglePlayPause();
    }
  }, [togglePlayPause]);

  // Render disabled state
  if (!src) {
    return (
      <div className={`audio-player audio-player--disabled ${className}`.trim()}>
        <button 
          className="audio-player__button" 
          disabled
          aria-label={ariaLabel || `${label} - No audio available`}
        >
          <span className="audio-player__icon" aria-hidden="true">▶️</span>
        </button>
        <span className="audio-player__label">{label} - No audio</span>
      </div>
    );
  }

  const isDisabled = disabled || state.isLoading;
  const effectiveAriaLabel = ariaLabel || `${label} - ${state.isPlaying ? 'Pause' : 'Play'} audio`;

  return (
    <div 
      className={`audio-player ${state.isPlaying ? 'audio-player--playing' : ''} ${state.hasError ? 'audio-player--error' : ''} ${className}`.trim()}
      role="region"
      aria-label={`Audio player for ${label}`}
    >
      <audio 
        ref={audioRef} 
        src={src} 
        preload="metadata"
        aria-hidden="true"
      />
      
      <button 
        className="audio-player__button"
        onClick={togglePlayPause}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        aria-label={effectiveAriaLabel}
        type="button"
      >
        {state.isLoading ? (
          <span className="audio-player__icon audio-player__icon--loading" aria-hidden="true">⏳</span>
        ) : state.hasError ? (
          <span className="audio-player__icon audio-player__icon--error" aria-hidden="true">❌</span>
        ) : state.isPlaying ? (
          <span className="audio-player__icon audio-player__icon--pause" aria-hidden="true">⏸️</span>
        ) : (
          <span className="audio-player__icon audio-player__icon--play" aria-hidden="true">▶️</span>
        )}
      </button>
      
      <div className="audio-player__info">
        <span className="audio-player__label">{label}</span>
        <div className="audio-player__progress-container">
          <div 
            className="audio-player__progress-bar"
            onClick={handleSeek}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={state.duration}
            aria-valuenow={state.currentTime}
            aria-label="Seek position"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
              // TODO: Add arrow key support for seeking
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                // Implement arrow key seeking
              }
            }}
          >
            <div 
              className="audio-player__progress-fill" 
              style={{ width: `${progress}%` }}
              aria-hidden="true"
            />
          </div>
          <span 
            className="audio-player__time"
            aria-label={`Current time: ${formatTime(state.currentTime)}, Duration: ${formatTime(state.duration)}`}
          >
            {formatTime(state.currentTime)} / {formatTime(state.duration)}
          </span>
        </div>
      </div>
    </div>
  );
}