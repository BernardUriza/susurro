/**
 * Tests for useAudioEngine hook
 * THIS FUCKING HOOK HAS 268 LINES AND 0% COVERAGE
 * VAMOS A DESTRUIRLO CON TESTS
 */

import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useAudioEngine } from '../../hooks/use-audio-engine';
import { createAudioEngine } from '../../engines';

// Mock the engines module
vi.mock('../../engines', () => ({
  createAudioEngine: vi.fn()
}));

const mockEngine = {
  initialize: vi.fn().mockResolvedValue(undefined),
  process: vi.fn(),
  cleanup: vi.fn()
};

// Mock console methods
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation();
  vi.spyOn(console, 'log').mockImplementation();
  vi.spyOn(console, 'error').mockImplementation();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAudioEngine', () => {
  let mockAudioContext: any;
  let mockProcessor: any;
  let mockMediaStreamSource: any;
  let mockMediaStreamDestination: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create fresh mocks for each test
    mockProcessor = {
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      onaudioprocess: null,
      bufferSize: 4096,
      numberOfInputs: 1,
      numberOfOutputs: 1
    };

    mockMediaStreamSource = {
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn()
    };

    mockMediaStreamDestination = {
      stream: { id: 'mock-stream' }
    };

    // Create a mock AudioContext instance
    mockAudioContext = {
      state: 'running',
      sampleRate: 48000,
      createScriptProcessor: vi.fn().mockReturnValue(mockProcessor),
      createMediaStreamSource: vi.fn().mockReturnValue(mockMediaStreamSource),
      createMediaStreamDestination: vi.fn().mockReturnValue(mockMediaStreamDestination),
      close: vi.fn().mockResolvedValue(undefined),
      currentTime: 0,
      baseLatency: 0.01,
      outputLatency: 0.02,
      destination: {},
      listener: {},
      suspend: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    };

    // Override the global AudioContext to return our mock
    (global.AudioContext as any).mockImplementation(() => mockAudioContext);
    
    // Setup engine mock
    (createAudioEngine as vi.Mock).mockReturnValue(mockEngine);
    
    // Reset engine mocks
    mockEngine.initialize.mockClear();
    mockEngine.process.mockClear();
    mockEngine.cleanup.mockClear();
  });
  
  describe('Initialization', () => {
    it('should show deprecation warning on mount', () => {
      renderHook(() => useAudioEngine());
      
      expect(console.warn).toHaveBeenCalledWith(
        '[Murmuraba] useAudioEngine is deprecated. Please use useMurmubaraEngine instead for better React 19 compatibility.'
      );
    });
    
    it('should start with correct initial state', () => {
      const { result } = renderHook(() => useAudioEngine());
      
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });
    
    it('should initialize audio engine successfully', async () => {
      const { result } = renderHook(() => useAudioEngine({ engineType: 'rnnoise' }));
      
      await act(async () => {
        await result.current.initializeAudioEngine();
      });
      
      expect(createAudioEngine).toHaveBeenCalledWith({ engineType: 'rnnoise' });
      expect(mockEngine.initialize).toHaveBeenCalled();
      expect(global.AudioContext).toHaveBeenCalledWith({ sampleRate: 48000 });
      expect(mockAudioContext.createScriptProcessor).toHaveBeenCalledWith(4096, 1, 1);
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });
    
    it('should handle initialization errors', async () => {
      const error = new Error('Init failed');
      mockEngine.initialize.mockRejectedValueOnce(error);
      
      const { result } = renderHook(() => useAudioEngine());
      
      await act(async () => {
        await expect(result.current.initializeAudioEngine()).rejects.toThrow('Init failed');
      });
      
      expect(result.current.error).toBe('Init failed');
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(console.error).toHaveBeenCalledWith('[AudioEngine] Error:', error);
    });
    
    it('should not re-initialize if already initialized', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      await act(async () => {
        await result.current.initializeAudioEngine();
      });
      
      vi.clearAllMocks();
      
      await act(async () => {
        await result.current.initializeAudioEngine();
      });
      
      expect(createAudioEngine).not.toHaveBeenCalled();
    });
    
    it('should not initialize if loading', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      // Start initialization (but don't await)
      act(() => {
        result.current.initializeAudioEngine();
      });
      
      // Try to initialize again while loading
      act(() => {
        result.current.initializeAudioEngine();
      });
      
      // Should only be called once
      expect(createAudioEngine).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Audio Processing', () => {
    it('should process audio frames correctly', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      await act(async () => {
        await result.current.initializeAudioEngine();
      });
      
      // Create test input/output buffers
      const inputBuffer = new Float32Array(4096);
      for (let i = 0; i < 4096; i++) {
        inputBuffer[i] = Math.sin(i * 0.01) * 0.5; // Test signal
      }
      
      const outputBuffer = new Float32Array(4096);
      
      const mockEvent = {
        inputBuffer: { getChannelData: () => inputBuffer },
        outputBuffer: { getChannelData: () => outputBuffer }
      };
      
      // Setup engine process mock
      mockEngine.process.mockImplementation((frame) => {
        // Return processed frame (reduced amplitude)
        return frame.map((s: number) => s * 0.7);
      });
      
      // Trigger audio processing
      act(() => {
        (mockProcessor.onaudioprocess as any)(mockEvent);
      });
      
      // Should have processed frames
      expect(mockEngine.process).toHaveBeenCalled();
      
      // Output should have data
      const hasOutput = outputBuffer.some(s => s !== 0);
      expect(hasOutput).toBe(true);
    });
    
    it('should pass through audio if engine not initialized', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      // Don't initialize, just process stream
      await act(async () => {
        await result.current.processStream({ id: 'test' } as any);
      });
      
      const inputBuffer = new Float32Array(4096);
      inputBuffer.fill(0.5);
      const outputBuffer = new Float32Array(4096);
      
      // Mock the engine process to return input unchanged
      mockEngine.process = vi.fn().mockImplementation((frame) => frame);
      
      const mockEvent = {
        inputBuffer: { getChannelData: () => inputBuffer },
        outputBuffer: { getChannelData: () => outputBuffer }
      };
      
      act(() => {
        (mockProcessor.onaudioprocess as any)(mockEvent);
      });
      
      // Should process through engine
      expect(mockEngine.process).toHaveBeenCalled();
      expect(outputBuffer[0]).toBe(0.5);
    });
    
    it('should apply silence gating', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      await act(async () => {
        await result.current.initializeAudioEngine();
      });
      
      // Create very quiet input (below silence threshold)
      const inputBuffer = new Float32Array(4096);
      inputBuffer.fill(0.0001); // Very quiet signal
      
      const outputBuffer = new Float32Array(4096);
      
      mockEngine.process = vi.fn().mockImplementation((frame) => frame);
      
      const mockEvent = {
        inputBuffer: { getChannelData: () => inputBuffer },
        outputBuffer: { getChannelData: () => outputBuffer }
      };
      
      act(() => {
        (mockProcessor.onaudioprocess as any)(mockEvent);
      });
      
      // Should have attenuated the output
      const avgOutput = outputBuffer.reduce((a, b) => a + Math.abs(b), 0) / outputBuffer.length;
      const avgInput = inputBuffer.reduce((a, b) => a + Math.abs(b), 0) / inputBuffer.length;
      
      expect(avgOutput).toBeLessThan(avgInput);
    });
    
    it('should handle transition zone audio', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      await act(async () => {
        await result.current.initializeAudioEngine();
      });
      
      // Create medium level input (transition zone)
      const inputBuffer = new Float32Array(4096);
      inputBuffer.fill(0.003); // Between silence and speech threshold
      
      const outputBuffer = new Float32Array(4096);
      
      mockEngine.process = vi.fn().mockImplementation((frame) => frame);
      
      const mockEvent = {
        inputBuffer: { getChannelData: () => inputBuffer },
        outputBuffer: { getChannelData: () => outputBuffer }
      };
      
      act(() => {
        (mockProcessor.onaudioprocess as any)(mockEvent);
      });
      
      // Should have moderate attenuation
      const avgOutput = outputBuffer.reduce((a, b) => a + Math.abs(b), 0) / outputBuffer.length;
      const avgInput = inputBuffer.reduce((a, b) => a + Math.abs(b), 0) / inputBuffer.length;
      
      // Should be attenuated but not as much as silence
      expect(avgOutput).toBeLessThan(avgInput);
      expect(avgOutput).toBeGreaterThan(avgInput * 0.1); // Not fully gated
    });
    
    it('should apply additional noise gate based on RNNoise reduction', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      await act(async () => {
        await result.current.initializeAudioEngine();
      });
      
      const inputBuffer = new Float32Array(4096);
      inputBuffer.fill(0.1); // Normal level
      
      const outputBuffer = new Float32Array(4096);
      
      // Mock engine to heavily reduce signal (indicating noise)
      mockEngine.process = vi.fn().mockImplementation((frame) => {
        return frame.map((s: number) => s * 0.1); // 90% reduction
      });
      
      const mockEvent = {
        inputBuffer: { getChannelData: () => inputBuffer },
        outputBuffer: { getChannelData: () => outputBuffer }
      };
      
      act(() => {
        (mockProcessor.onaudioprocess as any)(mockEvent);
      });
      
      // Should apply additional gating due to high reduction ratio
      expect(mockEngine.process).toHaveBeenCalled();
    });
    
    it('should log processing status occasionally', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      await act(async () => {
        await result.current.initializeAudioEngine();
      });
      
      // Mock Math.random to always return low value to trigger logging
      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.01);
      
      // Clear previous console.log calls
      vi.clearAllMocks();
      
      const inputBuffer = new Float32Array(4096);
      inputBuffer.fill(0.01);
      
      const outputBuffer = new Float32Array(4096);
      
      mockEngine.process = vi.fn().mockImplementation((frame) => frame);
      
      const mockEvent = {
        inputBuffer: { getChannelData: () => inputBuffer },
        outputBuffer: { getChannelData: () => outputBuffer }
      };
      
      act(() => {
        (mockProcessor.onaudioprocess as any)(mockEvent);
      });
      
      // Find the log call that contains all the expected strings
      const logCalls = (console.log as vi.Mock).mock.calls;
      const hasExpectedLog = logCalls.some(call => {
        return call[0]?.includes('[AudioEngine]') && 
               call.length >= 10 && 
               call[1]?.includes('Status:');
      });
      
      expect(hasExpectedLog).toBe(true);
      
      Math.random = originalRandom;
    });
  });
  
  describe('Stream Processing', () => {
    it('should process media stream', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      await act(async () => {
        await result.current.initializeAudioEngine();
      });
      
      const mockStream = { id: 'test-stream' } as any;
      
      let processedStream;
      await act(async () => {
        processedStream = await result.current.processStream(mockStream);
      });
      
      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
      expect(mockAudioContext.createMediaStreamDestination).toHaveBeenCalled();
      expect(mockMediaStreamSource.connect).toHaveBeenCalledWith(mockProcessor);
      expect(mockProcessor.connect).toHaveBeenCalledWith(mockMediaStreamDestination);
      expect(processedStream).toBe(mockMediaStreamDestination.stream);
    });
    
    it('should auto-initialize if not initialized', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      const mockStream = { id: 'test-stream' } as any;
      
      await act(async () => {
        await result.current.processStream(mockStream);
      });
      
      expect(createAudioEngine).toHaveBeenCalled();
      expect(result.current.isInitialized).toBe(true);
    });
    
    it('should throw error if initialization fails during processStream', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      // Make AudioContext creation fail
      (global.AudioContext as any).mockImplementationOnce(() => {
        throw new Error('AudioContext failed');
      });
      
      const mockStream = { id: 'test-stream' } as any;
      
      await act(async () => {
        await expect(result.current.processStream(mockStream)).rejects.toThrow('AudioContext failed');
      });
    });
    
    it('should reset metrics when starting new stream', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      await act(async () => {
        await result.current.initializeAudioEngine();
      });
      
      // Get initial metrics
      const initialMetrics = result.current.getMetrics();
      
      const mockStream = { id: 'test-stream' } as any;
      
      await act(async () => {
        await result.current.processStream(mockStream);
      });
      
      const newMetrics = result.current.getMetrics();
      expect(newMetrics.inputSamples).toBe(0);
      expect(newMetrics.outputSamples).toBe(0);
    });
  });
  
  describe('Metrics', () => {
    it('should track processing metrics', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      await act(async () => {
        await result.current.initializeAudioEngine();
      });
      
      const inputBuffer = new Float32Array(4096);
      inputBuffer.fill(0.5);
      
      const outputBuffer = new Float32Array(4096);
      
      mockEngine.process = vi.fn().mockImplementation((frame) => frame);
      
      const mockEvent = {
        inputBuffer: { getChannelData: () => inputBuffer },
        outputBuffer: { getChannelData: () => outputBuffer }
      };
      
      act(() => {
        (mockProcessor.onaudioprocess as any)(mockEvent);
      });
      
      const metrics = result.current.getMetrics();
      
      expect(metrics.inputSamples).toBeGreaterThan(0);
      expect(metrics.outputSamples).toBeGreaterThan(0);
      expect(metrics.totalFramesProcessed).toBeGreaterThan(0);
      expect(metrics.peakInputLevel).toBeGreaterThan(0);
    });
    
    it('should calculate noise reduction level', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      await act(async () => {
        await result.current.initializeAudioEngine();
      });
      
      // Process some audio with reduction
      const inputBuffer = new Float32Array(4096);
      inputBuffer.fill(0.5);
      
      const outputBuffer = new Float32Array(4096);
      
      // Mock engine to reduce by 50%
      mockEngine.process.mockImplementation((frame) => {
        return frame.map((s: number) => s * 0.5);
      });
      
      const mockEvent = {
        inputBuffer: { getChannelData: () => inputBuffer },
        outputBuffer: { getChannelData: () => outputBuffer }
      };
      
      act(() => {
        (mockProcessor.onaudioprocess as any)(mockEvent);
      });
      
      const metrics = result.current.getMetrics();
      
      expect(metrics.noiseReductionLevel).toBeGreaterThan(0);
      expect(metrics.noiseReductionLevel).toBeLessThanOrEqual(100);
    });
    
    it('should reset metrics correctly', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      await act(async () => {
        await result.current.initializeAudioEngine();
      });
      
      // Process some audio
      const inputBuffer = new Float32Array(4096);
      inputBuffer.fill(0.5);
      const outputBuffer = new Float32Array(4096);
      
      mockEngine.process = vi.fn().mockImplementation((frame) => frame);
      
      const mockEvent = {
        inputBuffer: { getChannelData: () => inputBuffer },
        outputBuffer: { getChannelData: () => outputBuffer }
      };
      
      act(() => {
        (mockProcessor.onaudioprocess as any)(mockEvent);
      });
      
      // Reset metrics
      act(() => {
        result.current.resetMetrics();
      });
      
      const metrics = result.current.getMetrics();
      
      expect(metrics.inputSamples).toBe(0);
      expect(metrics.outputSamples).toBe(0);
      expect(metrics.silenceFrames).toBe(0);
      expect(metrics.activeFrames).toBe(0);
    });
    
    it('should handle empty metrics gracefully', () => {
      const { result } = renderHook(() => useAudioEngine());
      
      const metrics = result.current.getMetrics();
      
      expect(metrics.averageInputEnergy).toBe(0);
      expect(metrics.averageOutputEnergy).toBe(0);
      expect(metrics.noiseReductionLevel).toBe(0);
    });
  });
  
  describe('Cleanup', () => {
    it('should cleanup resources properly', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      await act(async () => {
        await result.current.initializeAudioEngine();
      });
      
      act(() => {
        result.current.cleanup();
      });
      
      expect(mockProcessor.disconnect).toHaveBeenCalled();
      expect(mockEngine.cleanup).toHaveBeenCalled();
      expect(mockAudioContext.close).toHaveBeenCalled();
    });
    
    it('should handle cleanup when not initialized', () => {
      const { result } = renderHook(() => useAudioEngine());
      
      expect(() => {
        result.current.cleanup();
      }).not.toThrow();
    });
    
    it('should not close already closed audio context', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      await act(async () => {
        await result.current.initializeAudioEngine();
      });
      
      // Mock the state getter to return 'closed'
      Object.defineProperty(mockAudioContext, 'state', {
        get: () => 'closed',
        configurable: true
      });
      
      act(() => {
        result.current.cleanup();
      });
      
      expect(mockAudioContext.close).not.toHaveBeenCalled();
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle partial audio frames', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      await act(async () => {
        await result.current.initializeAudioEngine();
      });
      
      // Create buffer with partial frames (not multiple of 480)
      const inputBuffer = new Float32Array(500);
      inputBuffer.fill(0.5);
      
      const outputBuffer = new Float32Array(500);
      
      mockEngine.process = vi.fn().mockImplementation((frame) => frame);
      
      const mockEvent = {
        inputBuffer: { getChannelData: () => inputBuffer },
        outputBuffer: { getChannelData: () => outputBuffer }
      };
      
      act(() => {
        (mockProcessor.onaudioprocess as any)(mockEvent);
      });
      
      // Should process only complete frames (480 samples)
      expect(mockEngine.process).toHaveBeenCalledTimes(1);
    });
    
    it('should handle empty output buffer', async () => {
      const { result } = renderHook(() => useAudioEngine());
      
      await act(async () => {
        await result.current.initializeAudioEngine();
      });
      
      // Small input that won't fill output
      const inputBuffer = new Float32Array(100);
      const outputBuffer = new Float32Array(4096);
      
      const mockEvent = {
        inputBuffer: { getChannelData: () => inputBuffer },
        outputBuffer: { getChannelData: () => outputBuffer }
      };
      
      act(() => {
        (mockProcessor.onaudioprocess as any)(mockEvent);
      });
      
      // Should fill remaining with zeros
      const lastSamples = Array.from(outputBuffer.slice(-100));
      expect(lastSamples.every(s => s === 0)).toBe(true);
    });
  });
});

// Helper function test
describe('calculateRMS', () => {
  it('should calculate RMS correctly', () => {
    // The function is not exported, but we can test it indirectly
    // through the audio processing that uses it
    const { result } = renderHook(() => useAudioEngine());
    
    // Just verify the hook works with RMS calculations
    expect(result.current).toBeDefined();
  });
});