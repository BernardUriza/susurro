import React from 'react';
import { VadDisplay } from '../vad-display/vad-display';

interface IChunkHeaderProps {
  index: number;
  /** Duration in milliseconds */
  duration: number;
  noiseReduction: number;
  processingLatency: number;
  averageVad?: number;
  vadData?: Array<{ time: number; vad: number }>;
  isValid: boolean;
  isPlaying: boolean;
  isExpanded: boolean;
  hasProcessedAudio: boolean;
  onTogglePlayback: () => void;
  onToggleExpansion: () => void;
  onKeyDown: (event: React.KeyboardEvent, action: () => void) => void;
  /** Function to format duration from milliseconds to display string */
  formatTime: (milliseconds: number) => string;
  formatPercentage: (value: number) => string;
}

export function ChunkHeader({
  index,
  duration,
  noiseReduction,
  processingLatency,
  averageVad,
  vadData,
  isValid,
  isPlaying,
  isExpanded,
  hasProcessedAudio,
  onTogglePlayback,
  onToggleExpansion,
  onKeyDown,
  formatTime,
  formatPercentage
}: IChunkHeaderProps) {
  return (
    <div className="chunk__header">
      <div className="chunk__info">
        <h3 className="chunk__title">
          Chunk {index + 1}
          {!isValid && (
            <span className="chunk__error-badge" aria-label="Error">❌</span>
          )}
        </h3>
        
        {averageVad !== undefined && (
          <VadDisplay 
            averageVad={averageVad}
            vadData={vadData}
            chunkIndex={index}
          />
        )}
        
        <div className="chunk__meta">
          <span className="meta-item">
            <span className="meta-label">Duration:</span>
            <span className="meta-value">{formatTime(duration)}</span>
          </span>
          <span className="meta-item">
            <span className="meta-label">Noise Reduced:</span>
            <span className="meta-value meta-value--highlight">
              {formatPercentage(noiseReduction)}
            </span>
          </span>
          <span className="meta-item">
            <span className="meta-label">Latency:</span>
            <span className="meta-value">{processingLatency.toFixed(1)}ms</span>
          </span>
        </div>
      </div>

      <div className="chunk__controls">
        <button
          className={`btn btn-primary ${isPlaying ? 'btn--playing' : ''}`}
          onClick={onTogglePlayback}
          onKeyDown={(e) => onKeyDown(e, onTogglePlayback)}
          disabled={!hasProcessedAudio || !isValid}
          aria-label={`${isPlaying ? 'Pause' : 'Play'} processed chunk ${index + 1}`}
          type="button"
        >
          <span className="btn__icon" aria-hidden="true">
            {isPlaying ? '⏸️' : '▶️'}
          </span>
          <span className="btn__text">
            {isPlaying ? 'Pause' : 'Play'}
          </span>
        </button>

        <button
          className={`btn btn-ghost ${isExpanded ? 'btn--active' : ''}`}
          onClick={onToggleExpansion}
          onKeyDown={(e) => onKeyDown(e, onToggleExpansion)}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for chunk ${index + 1}`}
          aria-expanded={isExpanded}
          type="button"
        >
          <span className="btn__icon" aria-hidden="true">
            {isExpanded ? '▲' : '▼'}
          </span>
          <span className="btn__text">Details</span>
        </button>
      </div>
    </div>
  );
}