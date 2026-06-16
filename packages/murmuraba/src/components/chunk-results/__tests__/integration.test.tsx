import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChunkProcessingResults } from '../../chunk-processing-results/chunk-processing-results';
import { ProcessedChunk } from '../../../hooks/murmuraba-engine/types';
import { vi } from 'vitest';

describe('ChunkProcessingResults - VAD Integration', () => {
  const mockProps = {
    averageNoiseReduction: 75.5,
    selectedChunk: null,
    onTogglePlayback: vi.fn(),
    onToggleExpansion: vi.fn(),
    onClearAll: vi.fn(),
    onExportWav: vi.fn(),
    onExportMp3: vi.fn(),
    onDownloadChunk: vi.fn()
  };

  const createChunkWithVAD = (id: string, averageVad: number): ProcessedChunk => ({
    id,
    startTime: Date.now() - 10000,
    endTime: Date.now(),
    duration: 10000,
    originalSize: 1024000,
    processedSize: 950000,
    noiseRemoved: 74000,
    averageVad,
    vadData: [
      { time: 0, vad: 0.2 },
      { time: 1, vad: 0.8 },
      { time: 2, vad: 0.9 },
      { time: 3, vad: 0.7 },
      { time: 4, vad: 0.3 }
    ],
    metrics: {
      processingLatency: 45.2,
      frameCount: 100,
      inputLevel: 0.8,
      outputLevel: 0.7,
      noiseReductionLevel: 0.755,
      timestamp: Date.now(),
      droppedFrames: 0
    },
    isPlaying: false,
    isExpanded: false,
    isValid: true
  });

  it('should display VAD information prominently for high voice activity', () => {
    const chunk = createChunkWithVAD('chunk-1', 0.85);
    
    render(<ChunkProcessingResults {...mockProps} chunks={[chunk]} />);
    
    // Should display VAD component
    expect(screen.getByText('Voice Activity Detection')).toBeInTheDocument();
    expect(screen.getByText('0.850')).toBeInTheDocument();
    expect(screen.getByText('🟢 Strong Voice Activity')).toBeInTheDocument();
  });

  it('should display VAD warning for low voice activity', () => {
    const chunk = createChunkWithVAD('chunk-1', 0.15);
    
    render(<ChunkProcessingResults {...mockProps} chunks={[chunk]} />);
    
    // Should display low VAD warning
    expect(screen.getByText('Voice Activity Detection')).toBeInTheDocument();
    expect(screen.getByText('0.150')).toBeInTheDocument();
    expect(screen.getByText('🔴 Low Voice Activity')).toBeInTheDocument();
  });

  it('should show medium VAD level correctly', () => {
    const chunk = createChunkWithVAD('chunk-1', 0.50);
    
    render(<ChunkProcessingResults {...mockProps} chunks={[chunk]} />);
    
    expect(screen.getByText('Voice Activity Detection')).toBeInTheDocument();
    expect(screen.getByText('0.500')).toBeInTheDocument();
    expect(screen.getByText('🟡 Moderate Voice Activity')).toBeInTheDocument();
  });

  it('should not display VAD section when averageVad is undefined', () => {
    const chunkWithoutVAD = createChunkWithVAD('chunk-1', 0);
    chunkWithoutVAD.averageVad = undefined;
    
    render(<ChunkProcessingResults {...mockProps} chunks={[chunkWithoutVAD]} />);
    
    expect(screen.queryByText('Voice Activity Detection')).not.toBeInTheDocument();
  });

  it('should display VAD secondary metrics when expanded', () => {
    const chunk = createChunkWithVAD('chunk-1', 0.75);
    chunk.isExpanded = true;
    
    render(<ChunkProcessingResults {...mockProps} chunks={[chunk]} />);
    
    // Should show secondary VAD metrics
    expect(screen.getByText('Voice Detected')).toBeInTheDocument();
    expect(screen.getByText('Peak VAD')).toBeInTheDocument();
    expect(screen.getByText('60.0%')).toBeInTheDocument(); // Voice detected percentage
    expect(screen.getByText('0.900')).toBeInTheDocument(); // Peak VAD
  });
});