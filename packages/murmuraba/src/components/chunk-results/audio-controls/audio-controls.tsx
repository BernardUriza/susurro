import React from 'react';
import { SyncedWaveforms } from '../../synced-waveforms/synced-waveforms';
import '../audio-controls.css';

interface IAudioControlsProps {
  chunkId: string;
  index: number;
  isPlaying: boolean;
  hasProcessedAudio: boolean;
  hasOriginalAudio: boolean;
  isValid: boolean;
  onTogglePlayback: (audioType: 'processed' | 'original') => void;
  onDownload: (format: 'webm' | 'wav' | 'mp3', audioType: 'processed' | 'original') => void;
  processedAudioUrl?: string;
  originalAudioUrl?: string;
  currentlyPlayingType?: 'processed' | 'original' | null;
}

export function AudioControls({
  chunkId: _chunkId,
  index: _index,
  isPlaying,
  hasProcessedAudio,
  hasOriginalAudio,
  isValid,
  onTogglePlayback,
  onDownload,
  processedAudioUrl,
  originalAudioUrl,
  currentlyPlayingType
}: IAudioControlsProps) {
  return (
    <div className="details__section">
      <h4 className="section__title">🎵 Audio Controls</h4>
      
      {processedAudioUrl && originalAudioUrl && (
          <SyncedWaveforms
            processedAudioUrl={processedAudioUrl}
            originalAudioUrl={originalAudioUrl}
            isPlaying={isPlaying && currentlyPlayingType !== null}
            disabled={false}
            showVolumeControls={true}
            showPlaybackControls={true}
            processedLabel="Processed Audio"
            originalLabel="Original Audio"
            onPlayingChange={(playing) => {
              if (playing) {
                onTogglePlayback('processed');
              } else {
                // Stop current playback
                if (currentlyPlayingType) {
                  onTogglePlayback(currentlyPlayingType);
                }
              }
            }}
          />
      )}
      
      <div className="audio-controls-grid">
        {/* Original Audio First */}
        {hasOriginalAudio && (
          <div className="audio-group">
            <h5 className="audio-group__title">Original Audio</h5>
            <div className="audio-controls__row">
              <button
                className={`btn btn-secondary ${isPlaying && currentlyPlayingType === 'original' ? 'btn--playing' : ''}`}
                onClick={() => onTogglePlayback('original')}
                disabled={!hasOriginalAudio || !isValid}
                aria-label={`${isPlaying && currentlyPlayingType === 'original' ? 'Pause' : 'Play'} original audio`}
                type="button"
              >
                <span className="btn__icon" aria-hidden="true">
                  {isPlaying && currentlyPlayingType === 'original' ? '⏸️' : '▶️'}
                </span>
                <span>{isPlaying && currentlyPlayingType === 'original' ? 'Pause' : 'Play'} Original</span>
              </button>

              <button
                className="btn btn-ghost btn--small"
                onClick={() => onDownload('wav', 'original')}
                disabled={!hasOriginalAudio || !isValid}
                aria-label="Download original audio as WAV"
                type="button"
              >
                📄 Original WAV
              </button>

              <button
                className="btn btn-ghost btn--small"
                onClick={() => onDownload('mp3', 'original')}
                disabled={!hasOriginalAudio || !isValid}
                aria-label="Download original audio as MP3"
                type="button"
              >
                🎵 Original MP3
              </button>
            </div>
          </div>
        )}

        {/* Processed Audio Second */}
        <div className="audio-group">
          <h5 className="audio-group__title">Processed Audio</h5>
          <div className="audio-controls__row">
            <button
              className={`btn btn-secondary ${isPlaying && currentlyPlayingType === 'processed' ? 'btn--playing' : ''}`}
              onClick={() => onTogglePlayback('processed')}
              disabled={!hasProcessedAudio || !isValid}
              aria-label={`${isPlaying && currentlyPlayingType === 'processed' ? 'Pause' : 'Play'} processed audio`}
              type="button"
            >
              <span className="btn__icon" aria-hidden="true">
                {isPlaying && currentlyPlayingType === 'processed' ? '⏸️' : '▶️'}
              </span>
              <span>{isPlaying && currentlyPlayingType === 'processed' ? 'Pause' : 'Play'} Processed</span>
            </button>

            <button
              className="btn btn-ghost btn--small"
              onClick={() => onDownload('wav', 'processed')}
              disabled={!hasProcessedAudio || !isValid}
              aria-label="Download processed audio as WAV"
              type="button"
            >
              📄 WAV
            </button>

            <button
              className="btn btn-ghost btn--small"
              onClick={() => onDownload('mp3', 'processed')}
              disabled={!hasProcessedAudio || !isValid}
              aria-label="Download processed audio as MP3"
              type="button"
            >
              🎵 MP3
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}