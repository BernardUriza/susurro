import React, { useState, useCallback, useMemo } from 'react';
import { WaveformAnalyzer } from '../waveform-analyzer/waveform-analyzer';
import './synced-waveforms.css';

interface ISyncedWaveformsProps {
  originalAudioUrl?: string;
  processedAudioUrl?: string;
  isPlaying?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  className?: string;
  'aria-label'?: string;
  disabled?: boolean;
  showVolumeControls?: boolean;
  showPlaybackControls?: boolean;
  originalLabel?: string;
  processedLabel?: string;
  originalColor?: string;
  processedColor?: string;
}

interface IWaveformColumn {
  audioUrl?: string;
  label: string;
  color: string;
  volume: number;
  onVolumeChange: (value: number) => void;
  emoji: string;
}

export const SyncedWaveforms: React.FC<ISyncedWaveformsProps> = ({
  originalAudioUrl,
  processedAudioUrl,
  // isPlaying = false, // Reserved for future use
  onPlayingChange,
  className = '',
  'aria-label': ariaLabel,
  disabled = false,
  showVolumeControls = true,
  showPlaybackControls = true,
  originalLabel = 'Original Audio',
  processedLabel = 'Processed Audio (Noise Reduced)',
  originalColor = '#ef4444',
  processedColor = '#10b981'
}) => {
  const [originalVolume, setOriginalVolume] = useState(0.5);
  const [processedVolume, setProcessedVolume] = useState(0.8);
  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const [currentAudioType, setCurrentAudioType] = useState<'original' | 'processed'>('processed');

  const handlePlayingChange = useCallback((playing: boolean) => {
    if (!disabled) {
      setLocalIsPlaying(playing);
      onPlayingChange?.(playing);
    }
  }, [disabled, onPlayingChange]);

  // Volume change handlers - reserved for future volume control implementation
  // const handleOriginalVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  //   const value = Math.max(0, Math.min(1, parseFloat(e.target.value)));
  //   setOriginalVolume(value);
  // }, []);

  // const handleProcessedVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  //   const value = Math.max(0, Math.min(1, parseFloat(e.target.value)));
  //   setProcessedVolume(value);
  // }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;
    
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlePlayingChange(!localIsPlaying);
    }
  }, [disabled, localIsPlaying, handlePlayingChange]);

  // Memoized styles for performance
  const containerStyle = useMemo(() => ({
    opacity: disabled ? 0.6 : 1,
    pointerEvents: disabled ? 'none' as const : 'auto' as const,
  }), [disabled]);

  // Styles reserved for future volume controls implementation
  // const volumeControlsStyle = useMemo(() => ({
  //   display: 'flex',
  //   gap: '2rem',
  //   justifyContent: 'center' as const,
  //   alignItems: 'center' as const,
  //   marginBottom: '1rem',
  //   flexWrap: 'wrap' as const,
  // }), []);

  // const volumeControlStyle = useMemo(() => ({
  //   display: 'flex',
  //   alignItems: 'center',
  //   gap: '0.5rem',
  //   minWidth: '200px',
  // }), []);

  const buttonStyle = useMemo(() => ({
    padding: '8px 24px',
    borderRadius: '24px',
    border: 'none',
    fontWeight: '500',
    fontSize: '14px',
    transition: 'all 0.2s ease',
    cursor: disabled ? 'not-allowed' : 'pointer',
    backgroundColor: disabled ? '#666' : (localIsPlaying ? '#dc2626' : '#4f46e5'),
    color: 'white',
    opacity: disabled ? 0.6 : 1,
    ':hover': {
      backgroundColor: disabled ? '#666' : (localIsPlaying ? '#b91c1c' : '#3730a3'),
    },
  }), [disabled, localIsPlaying]);

  const toggleAudioType = useCallback(() => {
    setCurrentAudioType(prev => prev === 'original' ? 'processed' : 'original');
  }, []);

  const waveformColumns: IWaveformColumn[] = [
    {
      audioUrl: originalAudioUrl,
      label: originalLabel,
      color: originalColor,
      volume: originalVolume,
      onVolumeChange: setOriginalVolume,
      emoji: '🔴'
    },
    {
      audioUrl: processedAudioUrl,
      label: processedLabel,
      color: processedColor,
      volume: processedVolume,
      onVolumeChange: setProcessedVolume,
      emoji: '🟢'
    }
  ];

  return (
    <div 
      className={`synced-waveforms ${className}`}
      style={{
        ...containerStyle,
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        padding: '1.5rem',
        borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}
      role="region"
      aria-label={ariaLabel || 'Synchronized audio waveform comparison'}
    >
      {/* Waveforms Grid */}
      <div 
        className="waveforms-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          alignItems: 'stretch'
        }}
      >
        {waveformColumns.map((column, index) => (
          <div 
            key={index}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              padding: '1.25rem',
              borderRadius: '12px',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              cursor: disabled ? 'default' : 'pointer'
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';
            }}
          >
            {/* Waveform */}
            <div style={{ minHeight: '120px' }}>
              <WaveformAnalyzer
                audioUrl={column.audioUrl}
                label={column.label}
                color={column.color}
                hideControls={true}
                isPaused={!localIsPlaying}
                isMuted={index === 0 ? currentAudioType !== 'original' : currentAudioType !== 'processed'}
                volume={column.volume}
                onPlayStateChange={handlePlayingChange}
                disabled={disabled}
                disablePlayback={index === 0 ? currentAudioType !== 'original' : currentAudioType !== 'processed'}
                className="synced-waveform-analyzer"
                aria-label={`${column.label} waveform`}
                width={300}
                height={120}
              />
            </div>

            {/* Volume Control */}
            {showVolumeControls && (
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  background: 'rgba(0, 0, 0, 0.02)',
                  borderRadius: '8px'
                }}
              >
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: column.color
                  }}
                >
                  <span>{column.emoji} {column.label}</span>
                  <span style={{ fontSize: '16px', fontWeight: '700' }}>
                    {Math.round(column.volume * 100)}%
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={column.volume}
                    onChange={(e) => column.onVolumeChange(parseFloat(e.target.value))}
                    disabled={disabled}
                    style={{ 
                      width: '100%',
                      height: '6px',
                      borderRadius: '3px',
                      background: `linear-gradient(to right, ${column.color} 0%, ${column.color} ${column.volume * 100}%, #e5e7eb ${column.volume * 100}%, #e5e7eb 100%)`,
                      outline: 'none',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      WebkitAppearance: 'none',
                      appearance: 'none'
                    }}
                    aria-label={`${column.label} volume`}
                  />
                  <style dangerouslySetInnerHTML={{ __html: `
                    input[type="range"]::-webkit-slider-thumb {
                      appearance: none;
                      width: 20px;
                      height: 20px;
                      background: white;
                      border: 3px solid ${column.color};
                      border-radius: 50%;
                      cursor: ${disabled ? 'not-allowed' : 'pointer'};
                      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                      transition: all 0.2s ease;
                    }
                    input[type="range"]::-webkit-slider-thumb:hover {
                      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                      transform: scale(1.1);
                    }
                    input[type="range"]::-moz-range-thumb {
                      width: 20px;
                      height: 20px;
                      background: white;
                      border: 3px solid ${column.color};
                      border-radius: 50%;
                      cursor: ${disabled ? 'not-allowed' : 'pointer'};
                      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                      transition: all 0.2s ease;
                    }
                    input[type="range"]::-moz-range-thumb:hover {
                      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                      transform: scale(1.1);
                    }
                  ` }} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Playback controls */}
      {showPlaybackControls && (
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <button
            onClick={() => handlePlayingChange(!localIsPlaying)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            style={{
              ...buttonStyle,
              padding: '12px 32px',
              fontSize: '16px',
              fontWeight: '600',
              background: localIsPlaying 
                ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' 
                : 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: localIsPlaying
                ? '0 4px 14px 0 rgba(220, 38, 38, 0.35)'
                : '0 4px 14px 0 rgba(79, 70, 229, 0.35)',
              transition: 'all 0.3s ease',
              transform: 'translateY(0)'
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = localIsPlaying
                  ? '0 6px 20px 0 rgba(220, 38, 38, 0.4)'
                  : '0 6px 20px 0 rgba(79, 70, 229, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = localIsPlaying
                ? '0 4px 14px 0 rgba(220, 38, 38, 0.35)'
                : '0 4px 14px 0 rgba(79, 70, 229, 0.35)';
            }}
            aria-label={localIsPlaying ? 'Pause synchronized playback' : 'Play synchronized playback'}
          >
            <span style={{ fontSize: '20px' }}>{localIsPlaying ? '⏸' : '▶'}</span>
            <span>{localIsPlaying ? 'Pause' : 'Play Both'}</span>
          </button>
          <button
            onClick={toggleAudioType}
            disabled={disabled || !localIsPlaying}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              background: currentAudioType === 'original' 
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: currentAudioType === 'original'
                ? '0 4px 14px 0 rgba(239, 68, 68, 0.35)'
                : '0 4px 14px 0 rgba(16, 185, 129, 0.35)',
              transition: 'all 0.3s ease',
              opacity: disabled || !localIsPlaying ? 0.5 : 1,
              cursor: disabled || !localIsPlaying ? 'not-allowed' : 'pointer'
            }}
            aria-label={`Switch to ${currentAudioType === 'original' ? 'processed' : 'original'} audio`}
          >
            <span>{currentAudioType === 'original' ? '🔴' : '🟢'}</span>
            <span>Playing: {currentAudioType === 'original' ? 'Original' : 'Processed'}</span>
          </button>
        </div>
      )}

      {/* Error states */}
      {!originalAudioUrl && !processedAudioUrl && (
        <div 
          style={{ 
            textAlign: 'center', 
            color: '#6b7280', 
            padding: '3rem',
            background: 'rgba(0, 0, 0, 0.02)',
            borderRadius: '12px',
            fontSize: '14px'
          }}
          role="status"
        >
          <span style={{ fontSize: '24px', marginBottom: '0.5rem', display: 'block' }}>🎵</span>
          No audio files provided for comparison
        </div>
      )}
    </div>
  );
};