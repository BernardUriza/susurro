import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMurmubaraEngine } from '../../hooks/murmuraba-engine';
import * as api from '../../api';

vi.mock('../../api');

describe('Audio Engine Integration Tests', () => {
  let mockStream: MediaStream;
  let mockProcessedStream: MediaStream;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create real-ish MediaStream mocks
    mockStream = new MediaStream();
    mockProcessedStream = new MediaStream();
    
    // Mock API responses
    (api.initializeAudioEngine as any).mockResolvedValue(undefined);
    (api.getEngineStatus as any).mockReturnValue('ready');
    (api.processStream as any).mockResolvedValue({
      stream: mockProcessedStream,
      destroy: vi.fn()
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Real-world Recording Workflow', () => {
    it('should handle complete recording lifecycle', async () => {
      const { result } = renderHook(() => useMurmubaraEngine({
        noiseReductionLevel: 'high',
        algorithm: 'rnnoise',
        defaultChunkDuration: 5,
      }));

      // 1. Initialize engine
      await act(async () => {
        await result.current.initialize();
      });

      expect(api.initializeAudioEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          noiseReductionLevel: 'high',
          algorithm: 'rnnoise',
        })
      );
      expect(result.current.isEngineReady).toBe(true);

      // 2. Start recording
      await act(async () => {
        await result.current.startRecording(5);
      });

      expect(result.current.recordingState.isRecording).toBe(true);
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
        }
      });

      // 3. Simulate chunk recording
      const mockRecorder = (global.MediaRecorder as any).mock.results[0].value;
      
      await act(async () => {
        // Simulate data available
        mockRecorder.ondataavailable({ 
          data: new Blob(['chunk-data'], { type: 'audio/webm' }) 
        });
        mockRecorder.onstop();
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      await waitFor(() => {
        expect(result.current.recordingState.chunks.length).toBeGreaterThan(0);
      });

      // 4. Stop recording
      act(() => {
        result.current.stopRecording();
      });

      expect(result.current.recordingState.isRecording).toBe(false);
      
      // 5. Export chunk
      const chunk = result.current.recordingState.chunks[0];
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(new Blob(['wav-data'], { type: 'audio/wav' })),
      });

      const exportedBlob = await result.current.exportChunkAsWav(chunk.id, 'processed');
      expect(exportedBlob).toBeDefined();
      expect(exportedBlob.type).toBe('audio/wav');

      // 6. Cleanup
      await act(async () => {
        await result.current.cleanup();
      });

      expect(api.destroyEngine).toHaveBeenCalled();
    });

    it('should handle concurrent operations gracefully', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await result.current.initialize();
      });

      // Start multiple recordings concurrently (should be prevented)
      const startPromises = [
        result.current.startRecording(),
        result.current.startRecording(),
        result.current.startRecording(),
      ];

      await act(async () => {
        await Promise.allSettled(startPromises);
      });

      // Only one should succeed
      expect(result.current.recordingState.isRecording).toBe(true);
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    });

    it('should maintain performance under continuous recording', async () => {
      const { result } = renderHook(() => useMurmubaraEngine({
        defaultChunkDuration: 2, // 2-second chunks for faster test
      }));

      await act(async () => {
        await result.current.initialize();
        await result.current.startRecording(2);
      });

      const mockRecorder = (global.MediaRecorder as any).mock.results[0].value;
      const metricsCallback = (api.onMetricsUpdate as any).mock.calls[0][0];

      // Simulate continuous recording for 10 chunks
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          // Add chunk
          mockRecorder.ondataavailable({ 
            data: new Blob([`chunk-${i}`], { type: 'audio/webm' }) 
          });
          mockRecorder.onstop();
          
          // Update metrics
          metricsCallback({
            processingLatency: 10 + Math.random() * 5,
            frameCount: 100 * (i + 1),
            inputLevel: 0.7,
            outputLevel: 0.5,
            noiseReductionLevel: 0.8,
            timestamp: Date.now(),
            droppedFrames: 0,
          });
          
          await new Promise(resolve => setTimeout(resolve, 5));
        });
      }

      // Verify all chunks were processed
      expect(result.current.recordingState.chunks.length).toBe(10);
      
      // Verify metrics are reasonable
      expect(result.current.metrics?.processingLatency).toBeLessThan(20);
      expect(result.current.metrics?.droppedFrames).toBe(0);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from getUserMedia failure', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      // First attempt fails
      (navigator.mediaDevices.getUserMedia as any).mockRejectedValueOnce(
        new Error('Permission denied')
      );

      await act(async () => {
        await result.current.initialize();
      });

      // Try to start recording - should fail
      await act(async () => {
        try {
          await result.current.startRecording();
        } catch (error) {
          // Expected
        }
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.recordingState.isRecording).toBe(false);

      // Second attempt succeeds
      (navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce(mockStream);

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.error).toBeUndefined();
      expect(result.current.recordingState.isRecording).toBe(true);
    });

    it('should handle engine initialization failure', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      (api.initializeAudioEngine as any).mockRejectedValueOnce(
        new Error('WASM load failed')
      );

      await act(async () => {
        try {
          await result.current.initialize();
        } catch (error) {
          // Expected
        }
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.isEngineReady).toBe(false);
    });
  });

  describe('Advanced Features', () => {
    it('should support pause and resume during recording', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await result.current.initialize();
        await result.current.startRecording();
      });

      // Pause
      act(() => {
        result.current.pauseRecording();
      });

      expect(result.current.recordingState.isPaused).toBe(true);
      const mockRecorder = (global.MediaRecorder as any).mock.results[0].value;
      expect(mockRecorder.pause).toHaveBeenCalled();

      // Resume
      act(() => {
        result.current.resumeRecording();
      });

      expect(result.current.recordingState.isPaused).toBe(false);
      expect(mockRecorder.resume).toHaveBeenCalled();
    });

    it('should handle chunk validation and filtering', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await result.current.initialize();
      });

      const mockRecorder = (global.MediaRecorder as any).mock.results[0].value;

      // Add mix of valid and invalid chunks
      const chunks = [
        new Blob(['valid-chunk-1'], { type: 'audio/webm' }), // Valid
        new Blob([], { type: 'audio/webm' }), // Empty - invalid
        new Blob(['tiny'], { type: 'audio/webm' }), // Too small - invalid
        new Blob(['valid-chunk-2'.repeat(100)], { type: 'audio/webm' }), // Valid
      ];

      await act(async () => {
        await result.current.startRecording();
        
        for (const chunk of chunks) {
          mockRecorder.ondataavailable({ data: chunk });
          mockRecorder.onstop();
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      });

      // Should only have valid chunks (size > 100 bytes)
      const validChunks = result.current.recordingState.chunks.filter(c => c.isValid);
      expect(validChunks.length).toBe(2);
    });
  });
});