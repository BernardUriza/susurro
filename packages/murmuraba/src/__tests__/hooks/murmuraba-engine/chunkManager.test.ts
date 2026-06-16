/**
 * Tests for ChunkManager - Critical for Long Medical Recordings
 * MEDICAL GRADE: Ensures memory doesn't overflow during multi-hour recordings
 */

import { ChunkManager } from '../../../hooks/murmuraba-engine/chunk-manager';
import { vi } from 'vitest';
import { URLManager } from '../../../hooks/murmuraba-engine/url-manager';
import { ProcessedChunk, RecordingState } from '../../../hooks/murmuraba-engine/types';
import { MAX_CHUNKS_IN_MEMORY, CHUNKS_TO_KEEP_ON_OVERFLOW } from '../../../hooks/murmuraba-engine/constants';

describe('ChunkManager - Medical Grade Memory Management', () => {
  let chunkManager: ChunkManager;
  let urlManager: URLManager;

  beforeEach(() => {
    vi.clearAllMocks();
    urlManager = new URLManager();
    chunkManager = new ChunkManager(urlManager);
  });

  const createMockChunk = (id: string, time: number = Date.now()): ProcessedChunk => ({
    id,
    startTime: time,
    endTime: time + 8000,
    duration: 8000,
    processedAudioUrl: `blob:processed-${id}`,
    originalAudioUrl: `blob:original-${id}`,
    isPlaying: false,
    isExpanded: false,
    isValid: true,
    noiseRemoved: 50,
    originalSize: 1000000,
    processedSize: 500000,
    metrics: {
      processingLatency: 10,
      frameCount: 800,
      inputLevel: 1.0,
      outputLevel: 0.5,
      noiseReductionLevel: 0.5,
      timestamp: time,
      droppedFrames: 0,
    },
  });

  const createMockRecordingState = (chunks: ProcessedChunk[] = []): RecordingState => ({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    chunks,
  });

  describe('Chunk Memory Limits', () => {
    it('should respect MAX_CHUNKS_IN_MEMORY limit', () => {
      const chunks: ProcessedChunk[] = [];
      const revokeChunkUrlsSpy = vi.spyOn(urlManager, 'revokeChunkUrls');

      // Add chunks up to the limit - 1
      for (let i = 0; i < MAX_CHUNKS_IN_MEMORY - 1; i++) {
        chunks.push(createMockChunk(`chunk-${i}`, i * 8000));
      }

      const state = createMockRecordingState(chunks);

      // Adding one more chunk within limit should not trigger cleanup
      const result = chunkManager.addChunk(state, createMockChunk('new-chunk'));
      
      expect(result.chunks).toHaveLength(MAX_CHUNKS_IN_MEMORY);
      expect(revokeChunkUrlsSpy).not.toHaveBeenCalled();
    });

    it('should remove oldest chunks when exceeding limit', () => {
      const chunks: ProcessedChunk[] = [];
      const revokeChunkUrlsSpy = vi.spyOn(urlManager, 'revokeChunkUrls');

      // Fill to MAX_CHUNKS_IN_MEMORY
      for (let i = 0; i < MAX_CHUNKS_IN_MEMORY; i++) {
        chunks.push(createMockChunk(`chunk-${i}`, i * 8000));
      }

      const state = createMockRecordingState(chunks);

      // Add one more chunk to trigger cleanup
      const newChunk = createMockChunk('overflow-chunk', MAX_CHUNKS_IN_MEMORY * 8000);
      const result = chunkManager.addChunk(state, newChunk);

      // Should keep only CHUNKS_TO_KEEP_ON_OVERFLOW (the logic slices the last N chunks)
      expect(result.chunks).toHaveLength(CHUNKS_TO_KEEP_ON_OVERFLOW);

      // Should have revoked URLs for removed chunks
      const removedCount = MAX_CHUNKS_IN_MEMORY + 1 - CHUNKS_TO_KEEP_ON_OVERFLOW;
      expect(revokeChunkUrlsSpy).toHaveBeenCalledTimes(removedCount);
      
      // Verify oldest chunks were removed and newest are kept
      const firstKeptChunkIndex = MAX_CHUNKS_IN_MEMORY - CHUNKS_TO_KEEP_ON_OVERFLOW + 1;
      expect(result.chunks[0].id).toBe(`chunk-${firstKeptChunkIndex}`);
      expect(result.chunks[result.chunks.length - 1].id).toBe('overflow-chunk');
    });

    it('should handle multiple overflow scenarios', () => {
      let state = createMockRecordingState();
      let overflowCount = 0;
      
      // Simulate long recording session
      for (let i = 0; i < MAX_CHUNKS_IN_MEMORY * 3; i++) {
        const newChunk = createMockChunk(`chunk-${i}`, i * 8000);
        const prevLength = state.chunks.length;
        state = chunkManager.addChunk(state, newChunk);
        
        // Track when overflow cleanup happens
        if (prevLength === MAX_CHUNKS_IN_MEMORY && state.chunks.length === CHUNKS_TO_KEEP_ON_OVERFLOW) {
          overflowCount++;
        }
        
        // Chunks should never exceed MAX_CHUNKS_IN_MEMORY
        expect(state.chunks.length).toBeLessThanOrEqual(MAX_CHUNKS_IN_MEMORY);
      }
      
      // Should have overflowed at least twice in a 3x session
      expect(overflowCount).toBeGreaterThanOrEqual(2);
      
      // Final state should be at CHUNKS_TO_KEEP_ON_OVERFLOW after last overflow
      // But if we ended on a non-overflow iteration, we might have up to MAX_CHUNKS_IN_MEMORY
      expect(state.chunks.length).toBeGreaterThanOrEqual(CHUNKS_TO_KEEP_ON_OVERFLOW);
      expect(state.chunks.length).toBeLessThanOrEqual(MAX_CHUNKS_IN_MEMORY);
    });

    it('should log warning when removing chunks', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation();
      const chunks: ProcessedChunk[] = [];

      // Fill to limit
      for (let i = 0; i < MAX_CHUNKS_IN_MEMORY; i++) {
        chunks.push(createMockChunk(`chunk-${i}`));
      }

      const state = createMockRecordingState(chunks);

      // Trigger overflow
      chunkManager.addChunk(state, createMockChunk('overflow'));

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ [MEDICAL-MEMORY] Chunk limit reached (100). Removing oldest chunks...')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Chunk Operations', () => {
    it('should toggle chunk playback state', () => {
      const chunks = [
        createMockChunk('chunk-1'),
        createMockChunk('chunk-2'),
        createMockChunk('chunk-3'),
      ];

      const result = chunkManager.toggleChunkPlayback(chunks, 'chunk-2', true);

      expect(result[0].isPlaying).toBe(false);
      expect(result[1].isPlaying).toBe(true);
      expect(result[2].isPlaying).toBe(false);
    });

    it('should stop all other chunks when playing one', () => {
      const chunks = [
        { ...createMockChunk('chunk-1'), isPlaying: true },
        { ...createMockChunk('chunk-2'), isPlaying: true },
        createMockChunk('chunk-3'),
      ];

      const result = chunkManager.toggleChunkPlayback(chunks, 'chunk-3', true);

      expect(result[0].isPlaying).toBe(false);
      expect(result[1].isPlaying).toBe(false);
      expect(result[2].isPlaying).toBe(true);
    });

    it('should toggle chunk expansion', () => {
      const chunks = [
        createMockChunk('chunk-1'),
        createMockChunk('chunk-2'),
      ];

      const result = chunkManager.toggleChunkExpansion(chunks, 'chunk-1');

      expect(result[0].isExpanded).toBe(true);
      expect(result[1].isExpanded).toBe(false);
    });

    it('should find chunk by ID', () => {
      const chunks = [
        createMockChunk('chunk-1'),
        createMockChunk('chunk-2'),
        createMockChunk('chunk-3'),
      ];

      const found = chunkManager.findChunk(chunks, 'chunk-2');
      expect(found?.id).toBe('chunk-2');

      const notFound = chunkManager.findChunk(chunks, 'non-existent');
      expect(notFound).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty chunks array', () => {
      const state = createMockRecordingState();
      const result = chunkManager.addChunk(state, createMockChunk('first-chunk'));
      expect(result.chunks).toHaveLength(1);
    });

    it('should handle toggling non-existent chunk', () => {
      const chunks = [createMockChunk('chunk-1')];
      
      const result = chunkManager.toggleChunkPlayback(chunks, 'non-existent', true);
      expect(result).toEqual(chunks); // Should return unchanged
    });

    it('should handle concurrent modifications safely', () => {
      const state = createMockRecordingState();
      
      // Simulate concurrent additions
      const promises = Array.from({ length: 10 }, (_, i) => 
        Promise.resolve(chunkManager.addChunk(state, createMockChunk(`chunk-${i}`)))
      );

      return Promise.all(promises).then(results => {
        // Each result should be valid
        results.forEach(result => {
          expect(result).toBeDefined();
          expect(result.chunks).toBeDefined();
          expect(Array.isArray(result.chunks)).toBe(true);
        });
      });
    });
  });

  describe('Performance', () => {
    it('should handle large chunk operations efficiently', () => {
      const chunks: ProcessedChunk[] = [];
      
      // Create many chunks
      for (let i = 0; i < CHUNKS_TO_KEEP_ON_OVERFLOW; i++) {
        chunks.push(createMockChunk(`chunk-${i}`));
      }

      const startTime = Date.now();
      
      // Perform multiple operations
      let result = chunks;
      for (let i = 0; i < 100; i++) {
        result = chunkManager.toggleChunkPlayback(result, `chunk-${i % CHUNKS_TO_KEEP_ON_OVERFLOW}`, true);
      }

      const endTime = Date.now();
      
      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(50); // Less than 50ms for 100 operations
    });
  });
});