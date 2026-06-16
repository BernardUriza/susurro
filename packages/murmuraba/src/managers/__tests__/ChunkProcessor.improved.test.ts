import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChunkProcessor } from '../chunk-processor';

/**
 * Comprehensive tests for ChunkProcessor
 * Targeting improved coverage for critical audio processing logic
 */

describe('ChunkProcessor - Comprehensive Coverage', () => {
  let processor: ChunkProcessor;
  let mockLogger: any;
  let mockStateManager: any;
  let mockAudioEngine: any;

  beforeEach(() => {
    // Mock dependencies
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    mockStateManager = {
      getState: vi.fn().mockReturnValue({
        chunks: [],
        metrics: {},
        isProcessing: false
      }),
      setState: vi.fn(),
      subscribe: vi.fn(),
      emit: vi.fn()
    };

    mockAudioEngine = {
      processAudioData: vi.fn().mockResolvedValue({
        processedData: new Float32Array(1024),
        metrics: {
          noiseReduction: 0.75,
          processingLatency: 10.5,
          inputLevel: 0.8,
          outputLevel: 0.6
        }
      }),
      isInitialized: true,
      getVADData: vi.fn().mockReturnValue([
        { time: 0, vad: 0.2 },
        { time: 1, vad: 0.8 },
        { time: 2, vad: 0.9 }
      ])
    };

    processor = new ChunkProcessor(mockLogger, mockStateManager, mockAudioEngine);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Audio Chunk Processing', () => {
    it('should process valid audio chunk successfully', async () => {
      const audioData = new Float32Array(1024);
      // Fill with mock audio data
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * 0.5;
      }

      const chunkId = 'test-chunk-1';
      const startTime = Date.now();

      const result = await processor.processChunk(chunkId, audioData, startTime);

      expect(result).toBeDefined();
      expect(result.id).toBe(chunkId);
      expect(result.originalSize).toBe(audioData.length * 4); // Float32 = 4 bytes
      expect(result.processedSize).toBeGreaterThan(0);
      expect(result.metrics).toBeDefined();
      expect(result.vadData).toBeDefined();
      expect(mockAudioEngine.processAudioData).toHaveBeenCalledWith(audioData);
    });

    it('should handle empty audio data', async () => {
      const emptyData = new Float32Array(0);
      const chunkId = 'empty-chunk';
      const startTime = Date.now();

      await expect(processor.processChunk(chunkId, emptyData, startTime))
        .rejects.toThrow('Invalid audio data');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid audio data'),
        expect.any(Object)
      );
    });

    it('should handle audio engine processing failures', async () => {
      const audioData = new Float32Array(1024);
      audioData.fill(0.5);

      mockAudioEngine.processAudioData.mockRejectedValue(new Error('Engine error'));

      const chunkId = 'failing-chunk';
      const startTime = Date.now();

      await expect(processor.processChunk(chunkId, audioData, startTime))
        .rejects.toThrow('Engine error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Chunk processing failed'),
        expect.any(Object)
      );
    });

    it('should calculate accurate VAD metrics', async () => {
      const audioData = new Float32Array(1024);
      audioData.fill(0.5);

      const mockVADData = [
        { time: 0, vad: 0.1 },
        { time: 1, vad: 0.8 },
        { time: 2, vad: 0.9 },
        { time: 3, vad: 0.3 }
      ];

      mockAudioEngine.getVADData.mockReturnValue(mockVADData);

      const result = await processor.processChunk('vad-test', audioData, Date.now());

      expect(result.averageVad).toBeCloseTo(0.525, 3); // (0.1 + 0.8 + 0.9 + 0.3) / 4
      expect(result.vadData).toEqual(mockVADData);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple chunks in sequence', async () => {
      const chunks = [
        { id: 'chunk-1', data: new Float32Array(512), startTime: Date.now() },
        { id: 'chunk-2', data: new Float32Array(512), startTime: Date.now() + 1000 },
        { id: 'chunk-3', data: new Float32Array(512), startTime: Date.now() + 2000 }
      ];

      chunks.forEach(chunk => chunk.data.fill(Math.random()));

      const results = await processor.processBatch(chunks);

      expect(results).toHaveLength(3);
      expect(mockAudioEngine.processAudioData).toHaveBeenCalledTimes(3);
      
      results.forEach((result, index) => {
        expect(result.id).toBe(chunks[index].id);
        expect(result.isValid).toBe(true);
      });
    });

    it('should handle partial batch failures gracefully', async () => {
      const chunks = [
        { id: 'chunk-good-1', data: new Float32Array(512), startTime: Date.now() },
        { id: 'chunk-bad', data: new Float32Array(0), startTime: Date.now() + 1000 }, // Invalid
        { id: 'chunk-good-2', data: new Float32Array(512), startTime: Date.now() + 2000 }
      ];

      chunks[0].data.fill(0.5);
      chunks[2].data.fill(0.3);

      const results = await processor.processBatch(chunks, { continueOnError: true });

      expect(results).toHaveLength(2); // Only successful chunks
      expect(results[0].id).toBe('chunk-good-1');
      expect(results[1].id).toBe('chunk-good-2');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Performance Optimization', () => {
    it('should handle large audio chunks efficiently', async () => {
      // Test with 10 seconds of audio at 44.1kHz
      const largeAudioData = new Float32Array(441000);
      largeAudioData.fill(0.5);

      const startTime = performance.now();
      const result = await processor.processChunk('large-chunk', largeAudioData, Date.now());
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      // Should process within reasonable time (< 1 second for mocked processing)
      expect(processingTime).toBeLessThan(1000);
    });

    it('should optimize memory usage for multiple chunks', async () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Process 20 chunks
      const chunks = Array.from({ length: 20 }, (_, i) => ({
        id: `chunk-${i}`,
        data: new Float32Array(22050), // 0.5 seconds
        startTime: Date.now() + i * 500
      }));

      chunks.forEach(chunk => chunk.data.fill(Math.random()));

      await processor.processBatch(chunks);

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not increase memory by more than 100MB
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary engine failures', async () => {
      const audioData = new Float32Array(1024);
      audioData.fill(0.5);

      // First call fails, second succeeds
      mockAudioEngine.processAudioData
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          processedData: new Float32Array(1024),
          metrics: { noiseReduction: 0.7, processingLatency: 12 }
        });

      // Should retry and succeed
      const result = await processor.processChunk('retry-chunk', audioData, Date.now(), {
        retryAttempts: 1,
        retryDelay: 10
      });

      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(mockAudioEngine.processAudioData).toHaveBeenCalledTimes(2);
    });

    it('should handle corrupted audio data gracefully', async () => {
      const corruptedData = new Float32Array(1024);
      // Fill with NaN and Infinity values
      corruptedData.fill(NaN);
      corruptedData[100] = Infinity;
      corruptedData[200] = -Infinity;

      await expect(processor.processChunk('corrupted-chunk', corruptedData, Date.now()))
        .rejects.toThrow('Corrupted audio data detected');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Corrupted audio data'),
        expect.any(Object)
      );
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should calculate accurate noise reduction metrics', async () => {
      const audioData = new Float32Array(1024);
      // Create audio with noise pattern
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 440 * i / 44100) + (Math.random() - 0.5) * 0.3;
      }

      mockAudioEngine.processAudioData.mockResolvedValue({
        processedData: audioData.map(sample => sample * 0.7), // Simulated noise reduction
        metrics: {
          noiseReduction: 0.82,
          processingLatency: 8.5,
          inputLevel: 0.9,
          outputLevel: 0.63
        }
      });

      const result = await processor.processChunk('metrics-test', audioData, Date.now());

      expect(result.metrics.noiseReductionLevel).toBeCloseTo(0.82, 2);
      expect(result.metrics.processingLatency).toBe(8.5);
      expect(result.originalSize).toBe(audioData.length * 4);
      expect(result.processedSize).toBeGreaterThan(0);
      expect(result.noiseRemoved).toBeGreaterThan(0);
    });

    it('should track processing performance over time', async () => {
      const chunks = Array.from({ length: 5 }, (_, i) => ({
        id: `perf-chunk-${i}`,
        data: new Float32Array(1024),
        startTime: Date.now() + i * 1000
      }));

      chunks.forEach(chunk => chunk.data.fill(Math.random()));

      const results = await processor.processBatch(chunks);

      // Verify performance metrics are tracked
      results.forEach(result => {
        expect(result.metrics.processingLatency).toBeGreaterThan(0);
        expect(result.metrics.timestamp).toBeGreaterThan(0);
        expect(typeof result.metrics.inputLevel).toBe('number');
        expect(typeof result.metrics.outputLevel).toBe('number');
      });

      expect(mockStateManager.emit).toHaveBeenCalledWith('metricsUpdate', expect.any(Object));
    });
  });
});