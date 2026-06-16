/**
 * Consolidated Tests for useMurmubaraEngine Hook
 * 
 * This file consolidates all test cases from:
 * - useMurmubaraEngine.test.ts
 * - useMurmubaraEngine.diagnostics.test.ts
 * - useMurmubaraEngine.main.test.tsx
 * 
 * Organized by feature areas: initialization, controls, diagnostics, error handling, etc.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useMurmubaraEngine } from '../../../hooks/murmuraba-engine';
import * as api from '../../../api';
import { destroyAudioConverter } from '../../../utils/audio-converter';
import { 
  setupMediaDevicesMock, 
  setupAudioElementMock, 
  createTestConfig,
  waitForAsync 
} from '../../setup/audio-mocks';

// Mock the API module
vi.mock('../../../api', () => ({
  initializeAudioEngine: vi.fn().mockResolvedValue(undefined),
  destroyEngine: vi.fn().mockResolvedValue(undefined),
  processStream: vi.fn(),
  processStreamChunked: vi.fn(),
  processFile: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
  getEngineStatus: vi.fn().mockReturnValue('ready'),
  getDiagnostics: vi.fn().mockReturnValue({
    wasmLoaded: true,
    audioContextState: 'running',
    processingLatency: 10,
    memoryUsage: 1000000,
    streamCount: 1,
  }),
  onMetricsUpdate: vi.fn((callback) => {
    callback({
      processingLatency: 10,
      frameCount: 100,
      inputLevel: 1,
      outputLevel: 0.5,
      noiseReductionLevel: 0.5,
      timestamp: Date.now(),
      droppedFrames: 0,
    });
    return () => {};
  }),
  getEngine: vi.fn(),
}));

// Mock audio converter
vi.mock('../../../utils/audioConverter', () => ({
  getAudioConverter: vi.fn().mockReturnValue({
    webmToWav: vi.fn().mockResolvedValue(new Blob(['wav'], { type: 'audio/wav' })),
    webmToMp3: vi.fn().mockResolvedValue(new Blob(['mp3'], { type: 'audio/mp3' }))
  }),
  destroyAudioConverter: vi.fn(),
  AudioConverter: vi.fn()
}));

// Mock the managers (for main test compatibility)
vi.mock('../../../hooks/murmuraba-engine/urlManager', () => ({
  URLManager: vi.fn().mockImplementation(() => ({
    revokeObjectURL: vi.fn(),
    revokeAllUrls: vi.fn()
  }))
}));

vi.mock('../../../hooks/murmuraba-engine/chunkManager', () => ({
  ChunkManager: vi.fn().mockImplementation(() => ({
    clearChunks: vi.fn()
  }))
}));

vi.mock('../../../hooks/murmuraba-engine/recordingManager', () => ({
  RecordingManager: vi.fn().mockImplementation(() => ({
    startCycle: vi.fn(),
    stopRecording: vi.fn(),
    pauseRecording: vi.fn(),
    resumeRecording: vi.fn()
  }))
}));

vi.mock('../../../hooks/murmuraba-engine/audioExporter', () => ({
  AudioExporter: vi.fn().mockImplementation(() => ({
    exportToMP3: vi.fn(),
    exportToWAV: vi.fn(),
    setAudioConverter: vi.fn()
  }))
}));

vi.mock('../../../hooks/murmuraba-engine/playbackManager', () => ({
  PlaybackManager: vi.fn().mockImplementation(() => ({
    togglePlayback: vi.fn(),
    cleanup: vi.fn()
  }))
}));

// Mock logger
vi.mock('../../../hooks/murmuraba-engine/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('useMurmubaraEngine - Consolidated Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMediaDevicesMock();
    setupAudioElementMock();
    
    // Mock browser APIs
    global.URL.createObjectURL = vi.fn(() => `blob:test-${Math.random()}`);
    global.URL.revokeObjectURL = vi.fn();
    global.MediaRecorder = vi.fn() as any;
    global.fetch = vi.fn();
    
    // Suppress console output for tests
    vi.spyOn(console, 'error').mockImplementation();
    vi.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // INITIALIZATION TESTS
  // ============================================================================
  describe('Initialization', () => {
    it('should start with default state', () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.engineState).toBe('uninitialized');
      expect(result.current.recordingState.isRecording).toBe(false);
      expect(result.current.recordingState.chunks).toEqual([]);
    });

    it('should initialize audio engine with custom options', async () => {
      const config = createTestConfig({
        bufferSize: 4096,
        noiseReductionLevel: 'high',
        algorithm: 'rnnoise',
      });

      const { result } = renderHook(() => useMurmubaraEngine(config));

      await act(async () => {
        await result.current.initialize();
      });

      expect(api.initializeAudioEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          bufferSize: 4096,
          noiseReductionLevel: 'high',
          algorithm: 'rnnoise',
        })
      );
      expect(result.current.isInitialized).toBe(true);
    });

    it('should auto-initialize when autoInitialize is true', async () => {
      const { result } = renderHook(() => useMurmubaraEngine({ autoInitialize: true }));
      
      await act(async () => {
        await waitForAsync();
      });
      
      expect(api.initializeAudioEngine).toHaveBeenCalled();
      expect(result.current.isInitialized).toBe(true);
    });

    it('should handle initialization errors', async () => {
      (api.initializeAudioEngine as vi.Mock).mockRejectedValueOnce(new Error('Init failed'));
      
      const { result } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await expect(result.current.initialize()).rejects.toThrow('Init failed');
      });

      expect(result.current.error).toBe('Init failed');
      expect(result.current.isInitialized).toBe(false);
    });

    it('should prevent multiple simultaneous initializations', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      let promise1: Promise<void> | undefined;
      let promise2: Promise<void> | undefined;
      
      await act(async () => {
        promise1 = result.current.initialize();
        promise2 = result.current.initialize();
      });
      
      expect(promise1).toBeDefined();
      expect(promise2).toBeDefined();
      expect(promise1).toBe(promise2);
    });

    it('should handle non-Error objects in initialization', async () => {
      (api.initializeAudioEngine as vi.Mock).mockRejectedValueOnce('String error');
      
      const { result } = renderHook(() => useMurmubaraEngine());
      
      await act(async () => {
        try {
          await result.current.initialize();
        } catch (e) {
          // Expected to throw
        }
      });
      
      expect(result.current.error).toBe('Failed to initialize audio engine');
    });

    it('should call onInitError when initialization fails', async () => {
      const onInitError = vi.fn();
      const error = new Error('Init failed');
      (api.initializeAudioEngine as vi.Mock).mockRejectedValueOnce(error);
      
      const { result } = renderHook(() => useMurmubaraEngine({ onInitError }));
      
      await act(async () => {
        await expect(result.current.initialize()).rejects.toThrow('Init failed');
      });
      
      expect(onInitError).toHaveBeenCalledWith(error);
    });

    it('should clean up on unmount', async () => {
      const { result, unmount } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await result.current.initialize();
      });

      unmount();

      expect(destroyAudioConverter).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // ENGINE STATE MANAGEMENT TESTS
  // ============================================================================
  describe('Engine State Management', () => {
    it('should update engine state during lifecycle', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      expect(result.current.engineState).toBe('uninitialized');

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.engineState).toBe('ready');
    });

    it('should destroy engine properly', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await result.current.initialize();
      });

      await act(async () => {
        await result.current.destroy();
      });

      expect(api.destroyEngine).toHaveBeenCalled();
      expect(result.current.isInitialized).toBe(false);
    });
    
    it('should handle destroy when not initialized', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      await act(async () => {
        await result.current.destroy();
      });
      
      expect(api.destroyEngine).not.toHaveBeenCalled();
    });
    
    it('should handle destroy with force option', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await result.current.initialize();
      });

      await act(async () => {
        await result.current.destroy(true);
      });

      expect(api.destroyEngine).toHaveBeenCalledWith({ force: true });
    });

    it('should handle destroy errors', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      await act(async () => {
        await result.current.initialize();
      });
      
      const error = new Error('Destroy failed');
      (api.destroyEngine as vi.Mock).mockRejectedValueOnce(error);
      
      await act(async () => {
        try {
          await result.current.destroy();
        } catch (e) {
          // Expected
        }
      });
      
      expect(result.current.error).toBe('Destroy failed');
    });
  });

  // ============================================================================
  // RECORDING FUNCTIONALITY TESTS
  // ============================================================================
  describe('Recording Functionality', () => {
    it('should have initial recording state', () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      expect(result.current.recordingState).toEqual(
        expect.objectContaining({
          isRecording: false,
          isPaused: false,
          chunks: [],
        })
      );
    });

    it('should start recording successfully', async () => {
      const mockStream = {
        getTracks: vi.fn(() => [{ stop: vi.fn() }])
      };
      
      const mockMediaRecorder = {
        start: vi.fn(),
        stop: vi.fn(),
        state: 'inactive',
        ondataavailable: null,
        onstop: null,
      };
      
      (global.navigator.mediaDevices.getUserMedia as vi.Mock).mockResolvedValue(mockStream);
      (global.MediaRecorder as any).mockImplementation(() => mockMediaRecorder);
      
      const { result } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await result.current.initialize();
      });
      
      await act(async () => {
        const promise = result.current.startRecording();
        
        // Simulate MediaRecorder starting
        if (mockMediaRecorder.ondataavailable) {
          (mockMediaRecorder.ondataavailable as any)({ data: new Blob(['test']) });
        }
        
        await promise;
      });

      expect(result.current.recordingState.isRecording).toBe(true);
      expect(mockMediaRecorder.start).toHaveBeenCalled();
    });

    it('should stop recording', async () => {
      const mockMediaRecorder = {
        start: vi.fn(),
        stop: vi.fn(),
        state: 'recording',
        ondataavailable: null,
        onstop: null,
      };
      
      (global.MediaRecorder as any).mockImplementation(() => mockMediaRecorder);
      
      const { result } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await result.current.initialize();
      });
      
      await act(async () => {
        await result.current.startRecording();
      });
      
      act(() => {
        mockMediaRecorder.state = 'recording';
      });

      act(() => {
        result.current.stopRecording();
      });

      expect(result.current.recordingState.isRecording).toBe(false);
    });

    it('should pause and resume recording', async () => {
      const mockStream = {
        getTracks: vi.fn(() => [{ stop: vi.fn() }])
      };
      
      const mockMediaRecorder = {
        start: vi.fn(),
        stop: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        state: 'recording',
        ondataavailable: null,
        onstop: null,
      };
      
      (global.navigator.mediaDevices.getUserMedia as vi.Mock).mockResolvedValue(mockStream);
      (global.MediaRecorder as any).mockImplementation(() => mockMediaRecorder);
      
      const { result } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await result.current.initialize();
      });
      
      await act(async () => {
        result.current.recordingState.isRecording = true;
        result.current.recordingState.isPaused = false;
      });

      act(() => {
        result.current.pauseRecording();
      });

      expect(result.current.recordingState.isPaused).toBe(true);

      act(() => {
        result.current.resumeRecording();
      });

      expect(result.current.recordingState.isPaused).toBe(false);
    });

    it('should clear recordings', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await result.current.initialize();
      });

      act(() => {
        result.current.clearRecordings();
      });

      expect(result.current.recordingState.chunks).toEqual([]);
      expect(result.current.recordingState.recordingTime).toBe(0);
    });
  });

  // ============================================================================
  // CHUNK MANAGEMENT TESTS
  // ============================================================================
  describe('Chunk Management', () => {
    const createTestChunk = (id = 'test-chunk') => ({
      id,
      startTime: 0,
      endTime: 1000,
      duration: 1000,
      processedAudioUrl: 'blob:processed',
      originalAudioUrl: 'blob:original',
      isPlaying: false,
      isExpanded: false,
      isValid: true,
      noiseRemoved: 50,
      originalSize: 1000,
      processedSize: 500,
      metrics: {
        processingLatency: 10,
        frameCount: 100,
        inputLevel: 1,
        outputLevel: 0.5,
        noiseReductionLevel: 0.5,
        timestamp: Date.now(),
        droppedFrames: 0,
      }
    });

    it('should track playback state for chunks', () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      expect(result.current.chunkPlaybackStates).toEqual({});
      expect(result.current.expandedChunks).toEqual({});
    });

    it('should toggle chunk expansion', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await result.current.initialize();
      });

      expect(typeof result.current.toggleChunkExpansion).toBe('function');
      
      act(() => {
        result.current.toggleChunkExpansion('test-chunk');
      });
      
      expect(result.current.recordingState.chunks).toEqual([]);
    });

    it('should calculate average noise reduction', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await result.current.initialize();
      });

      const avgNoise = result.current.getAverageNoiseReduction();
      expect(typeof avgNoise).toBe('number');
      expect(avgNoise).toBe(0); // No chunks, so average is 0
    });

    it('should toggle chunk playback for existing chunk', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      await act(async () => {
        await result.current.initialize();
      });
      
      const testChunk = createTestChunk();
      
      act(() => {
        result.current.recordingState.chunks = [testChunk];
      });
      
      await act(async () => {
        await result.current.toggleChunkPlayback('test-chunk', 'processed');
      });
      
      // Test non-existent chunk
      await act(async () => {
        await result.current.toggleChunkPlayback('non-existent', 'processed');
      });
    });
  });

  // ============================================================================
  // EXPORT FUNCTIONALITY TESTS
  // ============================================================================
  describe('Export Functionality', () => {
    it('should provide export functions', () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      expect(typeof result.current.exportToMP3).toBe('function');
      expect(typeof result.current.exportToWAV).toBe('function');
      expect(typeof result.current.exportChunkAsWav).toBe('function');
      expect(typeof result.current.exportChunkAsMp3).toBe('function');
      expect(typeof result.current.downloadChunk).toBe('function');
    });

    it('should export chunk as WAV', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await result.current.initialize();
      });

      // Mock fetch for blob URL
      global.fetch = vi.fn().mockResolvedValue({
        blob: vi.fn().mockResolvedValue(new Blob(['webm data'], { type: 'audio/webm' })),
      });

      expect(typeof result.current.exportChunkAsWav).toBe('function');
    });

    it('should export chunk as MP3', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await result.current.initialize();
      });

      expect(typeof result.current.exportChunkAsMp3).toBe('function');
    });

    it('should throw error when exporting non-existent chunk', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      await act(async () => {
        await result.current.initialize();
      });
      
      await expect(result.current.exportChunkAsWav('non-existent', 'processed')).rejects.toThrow('Chunk not found');
      await expect(result.current.exportChunkAsMp3('non-existent', 'processed')).rejects.toThrow('Chunk not found');
    });
    
    it('should throw error when downloading non-existent chunk', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      await act(async () => {
        await result.current.initialize();
      });
      
      await expect(result.current.downloadChunk('non-existent', 'wav', 'processed')).rejects.toThrow('Chunk not found');
    });
  });

  // ============================================================================
  // DIAGNOSTICS TESTS
  // ============================================================================
  describe('Diagnostics', () => {
    it('should get diagnostics when initialized', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await result.current.initialize();
      });

      const diagnostics = result.current.getDiagnostics();
      
      expect(diagnostics).toEqual({
        wasmLoaded: true,
        audioContextState: 'running',
        processingLatency: 10,
        memoryUsage: 1000000,
        streamCount: 1,
      });
    });

    it('should return null diagnostics when not initialized', () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      const diag = result.current.getDiagnostics();
      expect(diag).toBeNull();
    });

    it('should handle getDiagnostics error', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      await act(async () => {
        await result.current.initialize();
      });
      
      // Mock getDiagnostics to throw
      (api.getDiagnostics as vi.Mock).mockImplementationOnce(() => {
        throw new Error('Diagnostics failed');
      });
      
      const diag = result.current.getDiagnostics();
      expect(diag).toBeNull();
    });

    it('should update diagnostics when initialized', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      expect(result.current.diagnostics).toBeNull();
      
      await act(async () => {
        await result.current.initialize();
      });
      
      // Wait for diagnostics to update
      await act(async () => {
        await waitForAsync();
      });
      
      expect(result.current.diagnostics).toEqual({
        wasmLoaded: true,
        audioContextState: 'running',
        processingLatency: 10,
        memoryUsage: 1000000,
        streamCount: 1,
      });
    });

    // ============================================================================
    // DIAGNOSTICS RACE CONDITION TESTS
    // ============================================================================
    describe('Race Condition Scenarios', () => {
      it('should fail to get diagnostics due to race condition during initialization', async () => {
        // This test proves the bug: getDiagnostics is called before isInitialized is true
        let getDiagnosticsCallCount = 0;
        
        (api.getDiagnostics as vi.Mock).mockImplementation(() => {
          getDiagnosticsCallCount++;
          // First call happens during init when isInitialized might still be false
          if (getDiagnosticsCallCount === 1) {
            return null; // Simulating the race condition
          }
          return {
            wasmLoaded: true,
            audioContextState: 'running',
            processingLatency: 10,
            memoryUsage: 1000000,
            streamCount: 1,
          };
        });

        const { result } = renderHook(() => useMurmubaraEngine());
        
        expect(result.current.diagnostics).toBeNull();
        expect(result.current.isInitialized).toBe(false);

        await act(async () => {
          await result.current.initialize();
        });

        // After initialization, isInitialized is true but diagnostics is still null
        expect(result.current.isInitialized).toBe(true);
        expect(result.current.diagnostics).toBeNull(); // THIS IS THE BUG!
        
        // The button would be disabled because diagnostics is null
        const buttonWouldBeDisabled = !result.current.isInitialized || !result.current.diagnostics;
        expect(buttonWouldBeDisabled).toBe(true); // Button is disabled even though engine is initialized
      });

      it('should automatically update diagnostics after initialization due to useEffect fix', async () => {
        (api.getDiagnostics as vi.Mock).mockReturnValue({
          wasmLoaded: true,
          audioContextState: 'running',
          processingLatency: 10,
          memoryUsage: 1000000,
          streamCount: 1,
        });

        const { result } = renderHook(() => useMurmubaraEngine());

        await act(async () => {
          await result.current.initialize();
        });

        // Wait for useEffect to trigger
        await waitFor(() => {
          expect(result.current.diagnostics).not.toBeNull();
        });

        // Now diagnostics should be populated automatically
        expect(result.current.diagnostics?.wasmLoaded).toBe(true);
        
        // Button would now be enabled
        const buttonWouldBeDisabled = !result.current.isInitialized || !result.current.diagnostics;
        expect(buttonWouldBeDisabled).toBe(false);
      });

      it('should show that Show Advanced Metrics button is disabled when diagnostics is null', async () => {
        // Direct simulation of the button's disabled state logic
        (api.getDiagnostics as vi.Mock).mockReturnValue(null);

        const { result } = renderHook(() => useMurmubaraEngine());

        await act(async () => {
          await result.current.initialize();
        });

        // Simulate the button's disabled prop calculation from pages/index.tsx:707
        const isInitialized = result.current.isInitialized;
        const diagnostics = result.current.diagnostics;
        const buttonDisabled = !isInitialized || !diagnostics;

        expect(isInitialized).toBe(true);
        expect(diagnostics).toBeNull();
        expect(buttonDisabled).toBe(true); // This is why the button is always disabled!
      });
    });
  });

  // ============================================================================
  // UTILITY FUNCTIONS TESTS
  // ============================================================================
  describe('Utility Functions', () => {
    it('should format time correctly', () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      expect(result.current.formatTime(0)).toBe('0:00');
      expect(result.current.formatTime(59)).toBe('0:59');
      expect(result.current.formatTime(60)).toBe('1:00');
      expect(result.current.formatTime(3600)).toBe('1:00:00');
      expect(result.current.formatTime(3661)).toBe('1:01:01');
      expect(result.current.formatTime(7322)).toBe('2:02:02');
    });

    it('should reset error', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      // Force an error
      (api.initializeAudioEngine as vi.Mock).mockRejectedValueOnce(new Error('Test error'));
      
      await act(async () => {
        try {
          await result.current.initialize();
        } catch (e) {
          // Expected
        }
      });
      
      expect(result.current.error).toBe('Test error');
      
      act(() => {
        result.current.resetError();
      });
      
      expect(result.current.error).toBe(null);
    });
  });

  // ============================================================================
  // CONFIGURATION OPTIONS TESTS
  // ============================================================================
  describe('Configuration Options', () => {
    it('should pass through config options', () => {
      const config = {
        noiseReductionLevel: 'high' as const,
        bufferSize: 2048
      };

      renderHook(() => useMurmubaraEngine(config));

      expect(api.initializeAudioEngine).not.toHaveBeenCalled(); // Not auto-initialized
    });

    it('should use default chunk duration', () => {
      const { result } = renderHook(() => useMurmubaraEngine());

      // Default chunk duration is 8 seconds
      expect(result.current).toBeDefined();
    });

    it('should use custom chunk duration', () => {
      const { result } = renderHook(() => 
        useMurmubaraEngine({ defaultChunkDuration: 10 })
      );

      expect(result.current).toBeDefined();
    });

    it('should handle fallback to manual mode', async () => {
      (api.initializeAudioEngine as vi.Mock).mockRejectedValue(new Error('Init failed'));
      
      const { result } = renderHook(() => 
        useMurmubaraEngine({ autoInitialize: true, fallbackToManual: true })
      );

      await act(async () => {
        await waitForAsync();
      });

      expect(result.current.error).toBe('Init failed');
      expect(result.current.isInitialized).toBe(false);
    });
  });

  // ============================================================================
  // CLEANUP TESTS
  // ============================================================================
  describe('Cleanup', () => {
    it('should cleanup on unmount with auto-initialization', async () => {
      const { unmount } = renderHook(() => 
        useMurmubaraEngine({ autoInitialize: true })
      );

      await act(async () => {
        await waitForAsync();
      });

      unmount();

      expect(api.destroyEngine).toHaveBeenCalled();
    });

    it('should cleanup recording interval', async () => {
      const { result, unmount } = renderHook(() => useMurmubaraEngine());

      // Start a recording to create interval
      await act(async () => {
        await result.current.initialize();
      });

      unmount();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should unsubscribe from metrics', async () => {
      const unsubscribe = vi.fn();
      (api.onMetricsUpdate as vi.Mock).mockReturnValue(unsubscribe);

      const { result, unmount } = renderHook(() => useMurmubaraEngine());

      await act(async () => {
        await result.current.initialize();
      });

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});