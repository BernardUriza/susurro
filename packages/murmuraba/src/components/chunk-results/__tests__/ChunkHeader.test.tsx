import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChunkHeader } from '../chunk-header/chunk-header';
import { vi, beforeEach } from 'vitest';

describe('ChunkHeader', () => {
  const mockProps = {
    index: 0,
    duration: 8.5,
    noiseReduction: 85.5,
    processingLatency: 45.2,
    averageVad: 0.75,
    vadData: [{ time: 0, vad: 0.8 }],
    isValid: true,
    isPlaying: false,
    isExpanded: false,
    hasProcessedAudio: true,
    onTogglePlayback: vi.fn(),
    onToggleExpansion: vi.fn(),
    onKeyDown: vi.fn(),
    formatTime: (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`,
    formatPercentage: (v: number) => `${v.toFixed(1)}%`
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render chunk header with VAD display prominently', () => {
    render(<ChunkHeader {...mockProps} />);
    
    expect(screen.getByText('Chunk 1')).toBeInTheDocument();
    expect(screen.getByText('Voice Activity Detection')).toBeInTheDocument();
    expect(screen.getByText('0.750')).toBeInTheDocument();
  });

  it('should not render VAD display when averageVad is undefined', () => {
    render(<ChunkHeader {...mockProps} averageVad={undefined} />);
    
    expect(screen.queryByText('Voice Activity Detection')).not.toBeInTheDocument();
  });

  it('should display formatted duration and metrics', () => {
    render(<ChunkHeader {...mockProps} />);
    
    expect(screen.getByText('Duration:')).toBeInTheDocument();
    expect(screen.getByText('0:08')).toBeInTheDocument();
    expect(screen.getByText('Noise Reduced:')).toBeInTheDocument();
    expect(screen.getByText('85.5%')).toBeInTheDocument();
    expect(screen.getByText('Latency:')).toBeInTheDocument();
    expect(screen.getByText('45.2ms')).toBeInTheDocument();
  });

  it('should show error badge for invalid chunks', () => {
    render(<ChunkHeader {...mockProps} isValid={false} />);
    
    expect(screen.getByLabelText('Error')).toBeInTheDocument();
    expect(screen.getByText('❌')).toBeInTheDocument();
  });

  it('should handle playback toggle', async () => {
    const user = userEvent.setup();
    render(<ChunkHeader {...mockProps} />);
    
    const playButton = screen.getByRole('button', { name: /play processed chunk 1/i });
    await user.click(playButton);
    
    expect(mockProps.onTogglePlayback).toHaveBeenCalledTimes(1);
  });

  it('should show pause state when playing', () => {
    render(<ChunkHeader {...mockProps} isPlaying={true} />);
    
    expect(screen.getByText('Pause')).toBeInTheDocument();
    expect(screen.getByText('⏸️')).toBeInTheDocument();
  });

  it('should handle expansion toggle', async () => {
    const user = userEvent.setup();
    render(<ChunkHeader {...mockProps} />);
    
    const expandButton = screen.getByRole('button', { name: /expand details for chunk 1/i });
    await user.click(expandButton);
    
    expect(mockProps.onToggleExpansion).toHaveBeenCalledTimes(1);
  });

  it('should disable playback button when no processed audio', () => {
    render(<ChunkHeader {...mockProps} hasProcessedAudio={false} />);
    
    const playButton = screen.getByRole('button', { name: /play processed chunk 1/i });
    expect(playButton).toBeDisabled();
  });

  it('should have proper accessibility attributes', () => {
    render(<ChunkHeader {...mockProps} isExpanded={true} />);
    
    const expandButton = screen.getByRole('button', { name: /collapse details for chunk 1/i });
    expect(expandButton).toHaveAttribute('aria-expanded', 'true');
  });
});