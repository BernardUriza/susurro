import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChunkProcessingResults } from '../../chunk-processing-results/chunk-processing-results';
import { ProcessedChunk } from '../../../hooks/murmuraba-engine/types';
import { vi } from 'vitest';

// Mock the child components
vi.mock('../chunk-header/chunk-header');
vi.mock('../processing-metrics/processing-metrics');
vi.mock('../file-info/file-info');
vi.mock('../vad-timeline/vad-timeline');
vi.mock('../audio-controls/audio-controls');

describe('ChunkProcessingResults - VAD Prominence', () => {
  const mockProps = {
    chunks: [] as ProcessedChunk[],
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass VAD data to ChunkHeader for prominent display', () => {
    const chunk = createChunkWithVAD('chunk-1', 0.75);
    const { ChunkHeader } = require('../chunk-header/chunk-header');
    
    render(<ChunkProcessingResults {...mockProps} chunks={[chunk]} />);
    
    expect(ChunkHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        averageVad: 0.75,
        vadData: chunk.vadData
      }),
      expect.any(Object)
    );
  });

  it('should display multiple chunks with VAD prominently', () => {
    const chunks = [
      createChunkWithVAD('chunk-1', 0.85),
      createChunkWithVAD('chunk-2', 0.45),
      createChunkWithVAD('chunk-3', 0.15)
    ];
    
    const { ChunkHeader } = require('../chunk-header/chunk-header');
    render(<ChunkProcessingResults {...mockProps} chunks={chunks} />);
    
    // Verify each chunk gets its VAD data
    expect(ChunkHeader).toHaveBeenCalledTimes(3);
    expect(ChunkHeader).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ averageVad: 0.85 }),
      expect.any(Object)
    );
    expect(ChunkHeader).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ averageVad: 0.45 }),
      expect.any(Object)
    );
    expect(ChunkHeader).toHaveBeenNthCalledWith(3,
      expect.objectContaining({ averageVad: 0.15 }),
      expect.any(Object)
    );
  });

  it('should handle chunks without VAD data gracefully', () => {
    const chunkWithoutVAD: ProcessedChunk = {
      ...createChunkWithVAD('chunk-1', 0),
      averageVad: undefined,
      vadData: undefined
    };
    
    const { ChunkHeader } = require('../chunk-header/chunk-header');
    render(<ChunkProcessingResults {...mockProps} chunks={[chunkWithoutVAD]} />);
    
    expect(ChunkHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        averageVad: undefined,
        vadData: undefined
      }),
      expect.any(Object)
    );
  });

  it('should pass VAD timeline data to expanded chunks', () => {
    const chunk = createChunkWithVAD('chunk-1', 0.65);
    chunk.isExpanded = true;
    
    const { VadTimeline } = require('../vad-timeline/vad-timeline');
    render(<ChunkProcessingResults {...mockProps} chunks={[chunk]} />);
    
    expect(VadTimeline).toHaveBeenCalledWith(
      expect.objectContaining({
        vadData: chunk.vadData,
        chunkId: 'chunk-1'
      }),
      expect.any(Object)
    );
  });
});