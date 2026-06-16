/**
 * E2E tests for ChunkProcessingResults component integration
 * Tests the complete flow from recording to chunk display with ChunkHeader
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { ChunkProcessingResults } from 'murmuraba';
import type { ProcessedChunk } from 'murmuraba';

// Mock processed chunk data
const createMockChunk = (index: number): ProcessedChunk => ({
  id: `chunk-${index}`,
  duration: 5.5,
  timestamp: Date.now() - (10000 * (3 - index)),
  originalAudioUrl: `blob:mock-original-${index}`,
  processedAudioUrl: `blob:mock-processed-${index}`,
  originalSize: 100000 + (index * 10000),
  processedSize: 80000 + (index * 8000),
  noiseRemoved: 20 + (index * 2),
  isPlaying: false,
  isExpanded: false,
  isValid: true,
  currentlyPlayingType: 'processed',
  metrics: {
    noiseReductionLevel: 25 + (index * 5),
    processingLatency: 50 + (index * 10),
    inputLevel: -20 + index,
    outputLevel: -18 + index,
    frameCount: 1000 + (index * 100),
    droppedFrames: index
  },
  averageVad: 0.6 + (index * 0.1),
  vadData: [
    { time: 0, vad: 0.1 },
    { time: 1, vad: 0.5 },
    { time: 2, vad: 0.8 },
    { time: 3, vad: 0.6 },
    { time: 4, vad: 0.3 },
    { time: 5, vad: 0.7 }
  ]
});

describe('ChunkProcessingResults E2E Tests', () => {
  const mockHandlers = {
    onTogglePlayback: vi.fn(),
    onToggleExpansion: vi.fn(),
    onClearAll: vi.fn(),
    onDownloadChunk: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.confirm mock
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render empty state when no chunks provided', () => {
      render(
        <ChunkProcessingResults
          chunks={[]}
          averageNoiseReduction={0}
          selectedChunk={null}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('No recordings yet')).toBeInTheDocument();
      expect(screen.getByText(/Start recording to see processed chunks/)).toBeInTheDocument();
    });

    it('should render ChunkHeader for each chunk', () => {
      const chunks = [createMockChunk(0), createMockChunk(1), createMockChunk(2)];
      
      render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={30}
          selectedChunk={null}
          {...mockHandlers}
        />
      );

      // Check that ChunkHeader is rendered for each chunk
      expect(screen.getByText('Chunk 1')).toBeInTheDocument();
      expect(screen.getByText('Chunk 2')).toBeInTheDocument();
      expect(screen.getByText('Chunk 3')).toBeInTheDocument();

      // Verify header stats
      expect(screen.getByText('3')).toBeInTheDocument(); // 3 chunks
      expect(screen.getByText('🎯 Processing Results')).toBeInTheDocument();
    });

    it('should display chunk metrics in ChunkHeader', () => {
      const chunks = [createMockChunk(0)];
      
      render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={25}
          selectedChunk={null}
          {...mockHandlers}
        />
      );

      // Check ChunkHeader displays metrics
      const chunkElement = screen.getByTestId('chunk-chunk-0');
      expect(within(chunkElement).getByText(/Duration:/)).toBeInTheDocument();
      expect(within(chunkElement).getByText(/5\.5s/)).toBeInTheDocument();
      expect(within(chunkElement).getByText(/Noise Reduced:/)).toBeInTheDocument();
      expect(within(chunkElement).getByText(/25\.0%/)).toBeInTheDocument();
      expect(within(chunkElement).getByText(/Latency:/)).toBeInTheDocument();
      expect(within(chunkElement).getByText(/50\.0ms/)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should handle play/pause button clicks in ChunkHeader', async () => {
      const chunks = [createMockChunk(0)];
      const user = userEvent.setup();
      
      render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={25}
          selectedChunk={null}
          {...mockHandlers}
        />
      );

      const playButton = screen.getByRole('button', { name: /Play processed chunk 1/i });
      await user.click(playButton);

      expect(mockHandlers.onTogglePlayback).toHaveBeenCalledWith('chunk-0', 'processed');
    });

    it('should handle details expand/collapse in ChunkHeader', async () => {
      const chunks = [createMockChunk(0)];
      const user = userEvent.setup();
      
      render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={25}
          selectedChunk={null}
          {...mockHandlers}
        />
      );

      const detailsButton = screen.getByRole('button', { name: /Expand details for chunk 1/i });
      await user.click(detailsButton);

      expect(mockHandlers.onToggleExpansion).toHaveBeenCalledWith('chunk-0');
    });

    it('should show expanded content when chunk is expanded', () => {
      const chunks = [{
        ...createMockChunk(0),
        isExpanded: true
      }];
      
      render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={25}
          selectedChunk="chunk-0"
          {...mockHandlers}
        />
      );

      // Check that expanded content is visible
      expect(screen.getByText(/Voice Activity Detection/)).toBeInTheDocument();
      expect(screen.getByText(/Export Audio/)).toBeInTheDocument();
    });

    it('should handle clear all with confirmation', async () => {
      const chunks = [createMockChunk(0), createMockChunk(1)];
      const user = userEvent.setup();
      
      render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={25}
          selectedChunk={null}
          {...mockHandlers}
        />
      );

      const clearButton = screen.getByRole('button', { name: /Clear all 2 chunks/i });
      await user.click(clearButton);

      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete all 2 recorded chunks? This action cannot be undone.'
      );
      expect(mockHandlers.onClearAll).toHaveBeenCalled();
    });

    it('should cancel clear all when user declines confirmation', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const chunks = [createMockChunk(0)];
      const user = userEvent.setup();
      
      render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={25}
          selectedChunk={null}
          {...mockHandlers}
        />
      );

      const clearButton = screen.getByRole('button', { name: /Clear all/i });
      await user.click(clearButton);

      expect(mockHandlers.onClearAll).not.toHaveBeenCalled();
    });
  });

  describe('Download Functionality', () => {
    it('should handle WAV download from expanded view', async () => {
      const chunks = [{
        ...createMockChunk(0),
        isExpanded: true
      }];
      const user = userEvent.setup();
      
      render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={25}
          selectedChunk="chunk-0"
          {...mockHandlers}
        />
      );

      // Find WAV button in AudioControls
      const wavButtons = screen.getAllByText('WAV');
      const downloadWavButton = wavButtons.find(btn => 
        btn.closest('button')?.title?.includes('Download')
      );
      
      if (downloadWavButton) {
        await user.click(downloadWavButton.closest('button')!);
        expect(mockHandlers.onDownloadChunk).toHaveBeenCalledWith('chunk-0', 'wav', expect.any(String));
      }
    });

    it('should handle MP3 download from expanded view', async () => {
      const chunks = [{
        ...createMockChunk(0),
        isExpanded: true
      }];
      const user = userEvent.setup();
      
      render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={25}
          selectedChunk="chunk-0"
          {...mockHandlers}
        />
      );

      // Find MP3 button in AudioControls
      const mp3Buttons = screen.getAllByText('MP3');
      const downloadMp3Button = mp3Buttons.find(btn => 
        btn.closest('button')?.title?.includes('Download')
      );
      
      if (downloadMp3Button) {
        await user.click(downloadMp3Button.closest('button')!);
        expect(mockHandlers.onDownloadChunk).toHaveBeenCalledWith('chunk-0', 'mp3', expect.any(String));
      }
    });
  });

  describe('Error States', () => {
    it('should display error message for invalid chunks', () => {
      const chunks = [{
        ...createMockChunk(0),
        isValid: false,
        errorMessage: 'Processing failed: Audio codec not supported'
      }];
      
      render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={0}
          selectedChunk={null}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('Processing failed: Audio codec not supported')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should disable play button for invalid chunks', () => {
      const chunks = [{
        ...createMockChunk(0),
        isValid: false
      }];
      
      render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={0}
          selectedChunk={null}
          {...mockHandlers}
        />
      );

      const playButton = screen.getByRole('button', { name: /Play processed chunk 1/i });
      expect(playButton).toBeDisabled();
    });
  });

  describe('Visual States', () => {
    it('should highlight selected chunk', () => {
      const chunks = [createMockChunk(0), createMockChunk(1)];
      
      render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={25}
          selectedChunk="chunk-1"
          {...mockHandlers}
        />
      );

      const selectedChunk = screen.getByTestId('chunk-chunk-1');
      expect(selectedChunk).toHaveClass('chunk--selected');
    });

    it('should show playing state in ChunkHeader', () => {
      const chunks = [{
        ...createMockChunk(0),
        isPlaying: true
      }];
      
      render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={25}
          selectedChunk={null}
          {...mockHandlers}
        />
      );

      const pauseButton = screen.getByRole('button', { name: /Pause processed chunk 1/i });
      expect(pauseButton).toBeInTheDocument();
      expect(pauseButton.querySelector('.btn__icon')?.textContent).toBe('⏸️');
    });

    it('should toggle expansion icon in ChunkHeader', () => {
      const chunks = [createMockChunk(0)];
      
      const { rerender } = render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={25}
          selectedChunk={null}
          {...mockHandlers}
        />
      );

      // Initially collapsed
      let detailsButton = screen.getByRole('button', { name: /Expand details for chunk 1/i });
      expect(detailsButton.querySelector('.btn__icon')?.textContent).toBe('▼');

      // Rerender with expanded chunk
      chunks[0].isExpanded = true;
      rerender(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={25}
          selectedChunk="chunk-0"
          {...mockHandlers}
        />
      );

      // Now expanded
      detailsButton = screen.getByRole('button', { name: /Collapse details for chunk 1/i });
      expect(detailsButton.querySelector('.btn__icon')?.textContent).toBe('▲');
    });
  });

  describe('Multiple Chunks Display', () => {
    it('should handle multiple chunks with different states', () => {
      const chunks = [
        createMockChunk(0),
        { ...createMockChunk(1), isPlaying: true },
        { ...createMockChunk(2), isExpanded: true },
        { ...createMockChunk(3), isValid: false, errorMessage: 'Failed to process' }
      ];
      
      render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={30}
          selectedChunk="chunk-2"
          {...mockHandlers}
        />
      );

      // Verify all chunks are rendered
      expect(screen.getByText('Chunk 1')).toBeInTheDocument();
      expect(screen.getByText('Chunk 2')).toBeInTheDocument();
      expect(screen.getByText('Chunk 3')).toBeInTheDocument();
      expect(screen.getByText('Chunk 4')).toBeInTheDocument();

      // Check playing state
      const pauseButton = screen.getByRole('button', { name: /Pause processed chunk 2/i });
      expect(pauseButton).toBeInTheDocument();

      // Check expanded state
      const chunk3 = screen.getByTestId('chunk-chunk-2');
      const detailsSection = chunk3.querySelector('.chunk__details');
      expect(detailsSection).toHaveStyle({ display: 'block' });

      // Check error state
      expect(screen.getByText('Failed to process')).toBeInTheDocument();
    });

    it('should calculate and display average noise reduction correctly', () => {
      const chunks = [
        { ...createMockChunk(0), metrics: { ...createMockChunk(0).metrics, noiseReductionLevel: 20 } },
        { ...createMockChunk(1), metrics: { ...createMockChunk(1).metrics, noiseReductionLevel: 30 } },
        { ...createMockChunk(2), metrics: { ...createMockChunk(2).metrics, noiseReductionLevel: 40 } }
      ];
      
      render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={30} // (20+30+40)/3 = 30
          selectedChunk={null}
          {...mockHandlers}
        />
      );

      // Check average is displayed in header
      expect(screen.getByText('30.0%')).toBeInTheDocument();
      expect(screen.getByText('avg noise reduction')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      const chunks = [createMockChunk(0)];
      
      render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={25}
          selectedChunk={null}
          {...mockHandlers}
        />
      );

      // Check ARIA labels
      expect(screen.getByRole('region', { name: 'Processing Results' })).toBeInTheDocument();
      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getByRole('listitem')).toBeInTheDocument();
      
      // Check button accessibility
      const playButton = screen.getByRole('button', { name: /Play processed chunk 1/i });
      expect(playButton).toHaveAttribute('aria-label');
      
      const detailsButton = screen.getByRole('button', { name: /Expand details for chunk 1/i });
      expect(detailsButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('should handle keyboard navigation', async () => {
      const chunks = [createMockChunk(0)];
      const user = userEvent.setup();
      
      render(
        <ChunkProcessingResults
          chunks={chunks}
          averageNoiseReduction={25}
          selectedChunk={null}
          {...mockHandlers}
        />
      );

      const playButton = screen.getByRole('button', { name: /Play processed chunk 1/i });
      
      // Focus the button
      playButton.focus();
      expect(playButton).toHaveFocus();
      
      // Press Enter to activate
      await user.keyboard('{Enter}');
      expect(mockHandlers.onTogglePlayback).toHaveBeenCalled();
      
      // Press Space to activate
      vi.clearAllMocks();
      await user.keyboard(' ');
      expect(mockHandlers.onTogglePlayback).toHaveBeenCalled();
    });
  });
});