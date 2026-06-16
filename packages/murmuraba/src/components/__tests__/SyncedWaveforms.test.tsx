import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncedWaveforms } from '../synced-waveforms/synced-waveforms';

describe('SyncedWaveforms', () => {
  const mockAudioUrl1 = 'blob:http://localhost/audio1';
  const mockAudioUrl2 = 'blob:http://localhost/audio2';

  it('renders without crashing', () => {
    render(<SyncedWaveforms />);
    expect(screen.getByText('No audio files provided for comparison')).toBeInTheDocument();
  });

  it('renders both waveforms when audio URLs are provided', () => {
    render(
      <SyncedWaveforms
        originalAudioUrl={mockAudioUrl1}
        processedAudioUrl={mockAudioUrl2}
      />
    );
    
    expect(screen.getByText('Original Audio')).toBeInTheDocument();
    expect(screen.getByText('Processed Audio (Noise Reduced)')).toBeInTheDocument();
  });

  it('uses local state for playback control', () => {
    const onPlayingChange = jest.fn();
    
    render(
      <SyncedWaveforms
        originalAudioUrl={mockAudioUrl1}
        processedAudioUrl={mockAudioUrl2}
        onPlayingChange={onPlayingChange}
      />
    );
    
    const playButton = screen.getByLabelText('Play synchronized playback');
    fireEvent.click(playButton);
    
    expect(onPlayingChange).toHaveBeenCalledWith(true);
    expect(screen.getByLabelText('Pause synchronized playback')).toBeInTheDocument();
  });

  it('toggles between original and processed audio', () => {
    render(
      <SyncedWaveforms
        originalAudioUrl={mockAudioUrl1}
        processedAudioUrl={mockAudioUrl2}
      />
    );
    
    // First play the audio
    const playButton = screen.getByLabelText('Play synchronized playback');
    fireEvent.click(playButton);
    
    // Then toggle audio type
    const toggleButton = screen.getByLabelText('Switch to original audio');
    fireEvent.click(toggleButton);
    
    expect(screen.getByText('Playing: Original')).toBeInTheDocument();
  });

  it('respects disabled state', () => {
    const onPlayingChange = jest.fn();
    
    render(
      <SyncedWaveforms
        originalAudioUrl={mockAudioUrl1}
        processedAudioUrl={mockAudioUrl2}
        onPlayingChange={onPlayingChange}
        disabled={true}
      />
    );
    
    const playButton = screen.getByLabelText('Play synchronized playback');
    fireEvent.click(playButton);
    
    expect(onPlayingChange).not.toHaveBeenCalled();
  });

  it('shows volume controls by default', () => {
    render(
      <SyncedWaveforms
        originalAudioUrl={mockAudioUrl1}
        processedAudioUrl={mockAudioUrl2}
      />
    );
    
    expect(screen.getByLabelText('Original Audio volume')).toBeInTheDocument();
    expect(screen.getByLabelText('Processed Audio (Noise Reduced) volume')).toBeInTheDocument();
  });

  it('hides volume controls when showVolumeControls is false', () => {
    render(
      <SyncedWaveforms
        originalAudioUrl={mockAudioUrl1}
        processedAudioUrl={mockAudioUrl2}
        showVolumeControls={false}
      />
    );
    
    expect(screen.queryByLabelText('Original Audio volume')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Processed Audio (Noise Reduced) volume')).not.toBeInTheDocument();
  });
});