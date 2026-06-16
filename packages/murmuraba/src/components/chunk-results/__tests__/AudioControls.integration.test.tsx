import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AudioControls } from '../audio-controls/audio-controls';
import { SyncedWaveforms } from '../../synced-waveforms/synced-waveforms';

vi.mock('../../synced-waveforms/synced-waveforms', () => ({
  SyncedWaveforms: vi.fn(({ processedAudioUrl, originalAudioUrl, isPlaying, onPlayingChange }) => (
    <div data-testid="synced-waveforms">
      <div>Processed: {processedAudioUrl}</div>
      <div>Original: {originalAudioUrl}</div>
      <div>Playing: {isPlaying ? 'true' : 'false'}</div>
      <button onClick={() => onPlayingChange(true)}>Play</button>
    </div>
  ))
}));

describe('AudioControls - SyncedWaveforms Integration', () => {
  const defaultProps = {
    chunkId: 'chunk-1',
    index: 0,
    isPlaying: false,
    hasProcessedAudio: true,
    hasOriginalAudio: true,
    isValid: true,
    onTogglePlayback: vi.fn(),
    onExport: vi.fn(),
    onDownload: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SyncedWaveforms visibility', () => {
    it('should not render SyncedWaveforms when no URLs provided', () => {
      render(<AudioControls {...defaultProps} />);
      
      expect(screen.queryByTestId('synced-waveforms')).not.toBeInTheDocument();
    });

    it('should not render SyncedWaveforms when only processedAudioUrl provided', () => {
      render(<AudioControls {...defaultProps} processedAudioUrl="processed.wav" />);
      
      expect(screen.queryByTestId('synced-waveforms')).not.toBeInTheDocument();
    });

    it('should not render SyncedWaveforms when only originalAudioUrl provided', () => {
      render(<AudioControls {...defaultProps} originalAudioUrl="original.wav" />);
      
      expect(screen.queryByTestId('synced-waveforms')).not.toBeInTheDocument();
    });

    it('should render SyncedWaveforms when both URLs provided', () => {
      render(
        <AudioControls 
          {...defaultProps} 
          processedAudioUrl="processed.wav"
          originalAudioUrl="original.wav"
        />
      );
      
      expect(screen.getByTestId('synced-waveforms')).toBeInTheDocument();
      expect(screen.getByText('Processed: processed.wav')).toBeInTheDocument();
      expect(screen.getByText('Original: original.wav')).toBeInTheDocument();
    });
  });

  describe('SyncedWaveforms props', () => {
    it('should pass correct props to SyncedWaveforms', () => {
      render(
        <AudioControls 
          {...defaultProps} 
          processedAudioUrl="processed.wav"
          originalAudioUrl="original.wav"
          isPlaying={true}
        />
      );

      expect(SyncedWaveforms).toHaveBeenCalledWith(
        expect.objectContaining({
          processedAudioUrl: 'processed.wav',
          originalAudioUrl: 'original.wav',
          isPlaying: true,
          disabled: false,
          showVolumeControls: true,
          showPlaybackControls: false,
          processedLabel: 'Processed Audio',
          originalLabel: 'Original Audio'
        }),
        expect.any(Object)
      );
    });

    it('should disable SyncedWaveforms when isValid is false', () => {
      render(
        <AudioControls 
          {...defaultProps} 
          processedAudioUrl="processed.wav"
          originalAudioUrl="original.wav"
          isValid={false}
        />
      );

      expect(SyncedWaveforms).toHaveBeenCalledWith(
        expect.objectContaining({
          disabled: true
        }),
        expect.any(Object)
      );
    });
  });

  describe('Playback integration', () => {
    it('should call onTogglePlayback when SyncedWaveforms triggers play', () => {
      render(
        <AudioControls 
          {...defaultProps} 
          processedAudioUrl="processed.wav"
          originalAudioUrl="original.wav"
        />
      );

      const playButton = screen.getByText('Play');
      fireEvent.click(playButton);

      expect(defaultProps.onTogglePlayback).toHaveBeenCalledWith('processed');
    });

    it('should pass isPlaying state to SyncedWaveforms', () => {
      const { rerender } = render(
        <AudioControls 
          {...defaultProps} 
          processedAudioUrl="processed.wav"
          originalAudioUrl="original.wav"
          isPlaying={false}
        />
      );

      expect(screen.getByText('Playing: false')).toBeInTheDocument();

      rerender(
        <AudioControls 
          {...defaultProps} 
          processedAudioUrl="processed.wav"
          originalAudioUrl="original.wav"
          isPlaying={true}
        />
      );

      expect(screen.getByText('Playing: true')).toBeInTheDocument();
    });
  });

  describe('Layout with audio controls', () => {
    it('should render both SyncedWaveforms and audio control buttons', () => {
      render(
        <AudioControls 
          {...defaultProps} 
          processedAudioUrl="processed.wav"
          originalAudioUrl="original.wav"
        />
      );

      // SyncedWaveforms should be present
      expect(screen.getByTestId('synced-waveforms')).toBeInTheDocument();

      // Audio control buttons should still be present
      expect(screen.getByLabelText('Play processed audio')).toBeInTheDocument();
      expect(screen.getByLabelText('Export processed audio as WAV')).toBeInTheDocument();
      expect(screen.getByLabelText('Export processed audio as MP3')).toBeInTheDocument();
      expect(screen.getByLabelText('Download processed audio')).toBeInTheDocument();
    });

    it('should maintain section structure with SyncedWaveforms', () => {
      const { container } = render(
        <AudioControls 
          {...defaultProps} 
          processedAudioUrl="processed.wav"
          originalAudioUrl="original.wav"
        />
      );

      const section = container.querySelector('.details__section');
      expect(section).toBeInTheDocument();

      const title = container.querySelector('.section__title');
      expect(title).toHaveTextContent('🎵 Audio Controls');

      // SyncedWaveforms should be before audio-controls
      const waveformsDiv = container.querySelector('[data-testid="synced-waveforms"]');
      const audioControlsDiv = container.querySelector('.audio-controls-grid');
      
      expect(waveformsDiv).toBeInTheDocument();
      expect(audioControlsDiv).toBeInTheDocument();
      
      // Check structure - synced waveforms container should contain the waveforms
      const waveformsContainer = container.querySelector('.synced-waveforms-container');
      expect(waveformsContainer).toBeInTheDocument();
      expect(waveformsContainer).toContainElement(waveformsDiv);
      
      // Both should be within audio-controls-container
      const controlsContainer = container.querySelector('.audio-controls-container');
      expect(controlsContainer).toBeInTheDocument();
      expect(controlsContainer).toContainElement(waveformsContainer!);
      expect(controlsContainer).toContainElement(audioControlsDiv);
    });
  });
});