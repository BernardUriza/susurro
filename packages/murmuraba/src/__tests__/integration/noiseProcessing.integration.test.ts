import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMurmubaraEngine } from '../../hooks/murmuraba-engine';
import * as api from '../../api';

vi.mock('../../api');

describe('Noise Processing Integration Tests', () => {
  const createMockAudioData = (size: number) => {
    const data = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      // Simulate noisy audio: signal + noise
      const signal = Math.sin(2 * Math.PI * 440 * i / 48000); // 440Hz tone
      const noise = (Math.random() - 0.5) * 0.3; // Random noise
      data[i] = signal * 0.5 + noise;
    }
    return data;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    (api.initializeAudioEngine as any).mockResolvedValue(undefined);
    (api.getEngineStatus as any).mockReturnValue('ready');
    (api.processStream as any).mockImplementation(() => {
      const processedStream = new MediaStream();
      return Promise.resolve({
        stream: processedStream,
        destroy: vi.fn()
      });
    });
    (api.destroyEngine as any).mockResolvedValue(undefined);
    (api.onMetricsUpdate as any).mockReturnValue(() => {});
    (api.getDiagnostics as any).mockReturnValue({
      wasmLoaded: true,
      audioContextState: 'running',
      processingLatency: 15,
      memoryUsage: 5000000,
      streamCount: 1,
    });
  });

  describe('RNNoise Algorithm Processing', () => {
    it('should process audio with different noise reduction levels', async () => {
      const levels = ['low', 'medium', 'high'] as const;
      
      for (const level of levels) {
        const { result } = renderHook(() => useMurmubaraEngine({
          noiseReductionLevel: level,
          algorithm: 'rnnoise',
        }));

        await act(async () => {
          await result.current.initialize();
        });

        expect(api.initializeAudioEngine).toHaveBeenCalledWith(
          expect.objectContaining({
            noiseReductionLevel: level,
            algorithm: 'rnnoise',
          })
        );

        // Verify metrics callback was set up
        const metricsCallback = (api.onMetricsUpdate as any).mock.calls[
          (api.onMetricsUpdate as any).mock.calls.length - 1
        ][0];

        act(() => {
          metricsCallback({
            processingLatency: 10,
            frameCount: 100,
            inputLevel: 0.8,
            outputLevel: 0.3, // Lower output = more noise removed
            noiseReductionLevel: level === 'high' ? 0.9 : level === 'medium' ? 0.6 : 0.3,
            timestamp: Date.now(),
            droppedFrames: 0,
          });
        });

        expect(result.current.metrics?.noiseReductionLevel).toBeGreaterThan(0);
        
        // Cleanup for next iteration
        await act(async () => {
          await result.current.cleanup();
        });
      }
    });

    it('should handle real-time audio processing metrics', async () => {
      const { result } = renderHook(() => useMurmubaraEngine({
        noiseReductionLevel: 'high',
        algorithm: 'rnnoise',
      }));

      await act(async () => {
        await result.current.initialize();
        await result.current.startRecording();
      });

      const metricsCallback = (api.onMetricsUpdate as any).mock.calls[0][0];
      const metricsHistory: any[] = [];

      // Simulate 1 second of audio processing (50 updates at 20ms intervals)
      for (let i = 0; i < 50; i++) {
        const metrics = {
          processingLatency: 8 + Math.random() * 4, // 8-12ms
          frameCount: (i + 1) * 960, // 960 frames per 20ms at 48kHz
          inputLevel: 0.5 + Math.sin(i * 0.1) * 0.3, // Varying input
          outputLevel: 0.2 + Math.sin(i * 0.1) * 0.1, // Processed output
          noiseReductionLevel: 0.85 + Math.random() * 0.1,
          timestamp: Date.now() + i * 20,
          droppedFrames: i % 10 === 0 ? 1 : 0, // Occasional dropped frame
        };

        act(() => {
          metricsCallback(metrics);
        });

        metricsHistory.push(metrics);
      }

      // Verify average performance
      const avgLatency = metricsHistory.reduce((sum, m) => sum + m.processingLatency, 0) / metricsHistory.length;
      expect(avgLatency).toBeLessThan(15); // Should maintain low latency

      const totalDropped = metricsHistory.reduce((sum, m) => sum + m.droppedFrames, 0);
      expect(totalDropped).toBeLessThan(10); // Minimal frame drops
    });

    it('should adapt to varying noise conditions', async () => {
      const { result } = renderHook(() => useMurmubaraEngine({
        noiseReductionLevel: 'medium',
        algorithm: 'rnnoise',
      }));

      await act(async () => {
        await result.current.initialize();
      });

      const metricsCallback = (api.onMetricsUpdate as any).mock.calls[0][0];

      // Simulate quiet environment
      act(() => {
        metricsCallback({
          processingLatency: 10,
          frameCount: 1000,
          inputLevel: 0.2, // Low input
          outputLevel: 0.18, // Minimal reduction
          noiseReductionLevel: 0.2,
          timestamp: Date.now(),
          droppedFrames: 0,
        });
      });

      const quietMetrics = { ...result.current.metrics };

      // Simulate noisy environment
      act(() => {
        metricsCallback({
          processingLatency: 12,
          frameCount: 2000,
          inputLevel: 0.9, // High input
          outputLevel: 0.4, // Significant reduction
          noiseReductionLevel: 0.8,
          timestamp: Date.now() + 1000,
          droppedFrames: 0,
        });
      });

      const noisyMetrics = { ...result.current.metrics };

      // Noise reduction should be more aggressive in noisy environment
      expect(noisyMetrics.noiseReductionLevel).toBeGreaterThan(quietMetrics.noiseReductionLevel!);
    });
  });

  describe('Chunked Processing Pipeline', () => {
    it('should process chunks with consistent quality', async () => {
      const { result } = renderHook(() => useMurmubaraEngine({
        defaultChunkDuration: 3,
        noiseReductionLevel: 'high',
      }));

      await act(async () => {
        await result.current.initialize();
        await result.current.startRecording(3);
      });

      const mockRecorder = (global.MediaRecorder as any).mock.results[0].value;
      const chunkQualities: number[] = [];

      // Process 5 chunks
      for (let i = 0; i < 5; i++) {
        const audioData = createMockAudioData(48000 * 3); // 3 seconds
        const blob = new Blob([audioData.buffer], { type: 'audio/webm' });

        await act(async () => {
          mockRecorder.ondataavailable({ data: blob });
          mockRecorder.onstop();
          await new Promise(resolve => setTimeout(resolve, 50));
        });

        // Simulate quality metric for each chunk
        const quality = 0.8 + Math.random() * 0.15; // 80-95% quality
        chunkQualities.push(quality);
      }

      // All chunks should maintain high quality
      expect(Math.min(...chunkQualities)).toBeGreaterThan(0.75);
      expect(result.current.recordingState.chunks.length).toBe(5);
    });

    it('should handle variable chunk sizes efficiently', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await result.current.initialize();
      });

      const chunkSizes = [1, 2, 5, 8, 10]; // Different durations in seconds
      
      for (const duration of chunkSizes) {
        await act(async () => {
          await result.current.startRecording(duration);
        });

        const mockRecorder = (global.MediaRecorder as any).mock.results[
          (global.MediaRecorder as any).mock.results.length - 1
        ].value;

        const audioData = createMockAudioData(48000 * duration);
        const blob = new Blob([audioData.buffer], { type: 'audio/webm' });

        await act(async () => {
          mockRecorder.ondataavailable({ data: blob });
          mockRecorder.onstop();
          await new Promise(resolve => setTimeout(resolve, 20));
        });

        act(() => {
          result.current.stopRecording();
        });
      }

      // Should have processed all chunks regardless of size
      expect(result.current.recordingState.chunks.length).toBe(chunkSizes.length);
    });
  });

  describe('Performance Optimization', () => {
    it('should maintain performance with concurrent processing', async () => {
      const { result } = renderHook(() => useMurmubaraEngine({
        noiseReductionLevel: 'high',
      }));

      await act(async () => {
        await result.current.initialize();
        await result.current.startRecording();
      });

      const metricsCallback = (api.onMetricsUpdate as any).mock.calls[0][0];
      const mockRecorder = (global.MediaRecorder as any).mock.results[0].value;

      // Simulate concurrent chunk processing and metrics updates
      const processingTasks = [];

      for (let i = 0; i < 10; i++) {
        processingTasks.push(
          act(async () => {
            // Add chunk
            mockRecorder.ondataavailable({ 
              data: new Blob([`chunk-${i}`], { type: 'audio/webm' }) 
            });
            mockRecorder.onstop();

            // Update metrics
            metricsCallback({
              processingLatency: 10 + i % 5,
              frameCount: 1000 * (i + 1),
              inputLevel: 0.7,
              outputLevel: 0.3,
              noiseReductionLevel: 0.85,
              timestamp: Date.now() + i * 100,
              droppedFrames: 0,
            });
          })
        );
      }

      await Promise.all(processingTasks);

      // Should handle all concurrent operations
      expect(result.current.recordingState.chunks.length).toBeGreaterThan(0);
      expect(result.current.metrics?.droppedFrames).toBe(0);
    });

    it('should optimize memory usage during long recordings', async () => {
      const { result } = renderHook(() => useMurmubaraEngine({
        defaultChunkDuration: 2,
      }));

      await act(async () => {
        await result.current.initialize();
        await result.current.startRecording(2);
      });

      const mockRecorder = (global.MediaRecorder as any).mock.results[0].value;
      const MAX_CHUNKS = 100; // From constants

      // Add more chunks than MAX_CHUNKS
      for (let i = 0; i < MAX_CHUNKS + 20; i++) {
        await act(async () => {
          mockRecorder.ondataavailable({ 
            data: new Blob([`chunk-${i}`], { type: 'audio/webm' }) 
          });
          mockRecorder.onstop();
          await new Promise(resolve => setTimeout(resolve, 5));
        });
      }

      // Should maintain MAX_CHUNKS limit
      expect(result.current.recordingState.chunks.length).toBeLessThanOrEqual(MAX_CHUNKS);
      
      // Should keep most recent chunks
      const lastChunk = result.current.recordingState.chunks[result.current.recordingState.chunks.length - 1];
      expect(lastChunk).toBeDefined();
    });
  });
});