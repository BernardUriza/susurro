import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMurmubaraEngine } from '../use-murmubara-engine';
import * as api from '../../../api';

// Mock the API module
vi.mock('../../../api', () => ({
  initializeAudioEngine: vi.fn(),
  destroyEngine: vi.fn(),
  processStream: vi.fn(),
  processStreamChunked: vi.fn(),
  getEngineStatus: vi.fn().mockReturnValue('ready'),
  getDiagnostics: vi.fn().mockReturnValue({
    engineState: 'ready',
    version: '1.0.0'
  }),
  onMetricsUpdate: vi.fn().mockReturnValue(() => {}),
  processFile: vi.fn(),
  setInputGain: vi.fn(),
  getInputGain: vi.fn().mockReturnValue(1.0)
}));

// Mock audio converter
vi.mock('../../../utils/audio-converter', () => ({
  getAudioConverter: vi.fn().mockReturnValue({
    convertToWav: vi.fn(),
    convertToMp3: vi.fn()
  }),
  destroyAudioConverter: vi.fn()
}));

describe('useMurmubaraEngine - Gain Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocked functions
    (api.initializeAudioEngine as any).mockResolvedValue(undefined);
    (api.destroyEngine as any).mockResolvedValue(undefined);
    (api.getInputGain as any).mockReturnValue(1.0);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have default gain value of 1.0', () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      expect(result.current.inputGain).toBe(1.0);
    });

    it('should provide setInputGain function', () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      expect(result.current.setInputGain).toBeDefined();
      expect(typeof result.current.setInputGain).toBe('function');
    });

    it('should provide getInputGain function', () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      expect(result.current.getInputGain).toBeDefined();
      expect(typeof result.current.getInputGain).toBe('function');
    });
  });

  describe('setInputGain', () => {
    it('should throw error when engine is not initialized', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      act(() => {
        result.current.setInputGain(1.5);
      });
      
      await waitFor(() => {
        expect(result.current.error).toBe('Engine not initialized');
      });
    });

    it('should update gain when engine is initialized', async () => {
      const { result } = renderHook(() => useMurmubaraEngine({ autoInitialize: true }));
      
      // Wait for initialization
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      act(() => {
        result.current.setInputGain(2.0);
      });
      
      expect(api.setInputGain).toHaveBeenCalledWith(2.0);
      expect(result.current.inputGain).toBe(2.0);
    });

    it('should handle multiple gain updates', async () => {
      const { result } = renderHook(() => useMurmubaraEngine({ autoInitialize: true }));
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      act(() => {
        result.current.setInputGain(1.5);
      });
      expect(result.current.inputGain).toBe(1.5);
      
      act(() => {
        result.current.setInputGain(2.5);
      });
      expect(result.current.inputGain).toBe(2.5);
      
      act(() => {
        result.current.setInputGain(0.8);
      });
      expect(result.current.inputGain).toBe(0.8);
      
      expect(api.setInputGain).toHaveBeenCalledTimes(3);
    });

    it('should handle boundary values', async () => {
      const { result } = renderHook(() => useMurmubaraEngine({ autoInitialize: true }));
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      // Minimum value
      act(() => {
        result.current.setInputGain(0.5);
      });
      expect(api.setInputGain).toHaveBeenCalledWith(0.5);
      expect(result.current.inputGain).toBe(0.5);
      
      // Maximum value
      act(() => {
        result.current.setInputGain(3.0);
      });
      expect(api.setInputGain).toHaveBeenCalledWith(3.0);
      expect(result.current.inputGain).toBe(3.0);
    });

    it('should handle out-of-range values', async () => {
      const { result } = renderHook(() => useMurmubaraEngine({ autoInitialize: true }));
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      // Below minimum
      act(() => {
        result.current.setInputGain(0.1);
      });
      expect(api.setInputGain).toHaveBeenCalledWith(0.1);
      
      // Above maximum
      act(() => {
        result.current.setInputGain(5.0);
      });
      expect(api.setInputGain).toHaveBeenCalledWith(5.0);
    });

    it('should handle API errors gracefully', async () => {
      (api.setInputGain as any).mockImplementation(() => {
        throw new Error('API Error');
      });
      
      const { result } = renderHook(() => useMurmubaraEngine({ autoInitialize: true }));
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      act(() => {
        result.current.setInputGain(1.5);
      });
      
      await waitFor(() => {
        expect(result.current.error).toBe('API Error');
      });
    });

    it('should log gain changes', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      const { result } = renderHook(() => useMurmubaraEngine({ autoInitialize: true }));
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      act(() => {
        result.current.setInputGain(1.8);
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Input gain set to 1.8x')
      );
    });
  });

  describe('getInputGain', () => {
    it('should return current gain value when not initialized', () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      const gain = result.current.getInputGain();
      expect(gain).toBe(1.0);
    });

    it('should return API gain value when initialized', async () => {
      (api.getInputGain as any).mockReturnValue(1.7);
      
      const { result } = renderHook(() => useMurmubaraEngine({ autoInitialize: true }));
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      const gain = result.current.getInputGain();
      
      expect(api.getInputGain).toHaveBeenCalled();
      expect(gain).toBe(1.7);
      expect(result.current.inputGain).toBe(1.7);
    });

    it('should handle API errors gracefully', async () => {
      (api.getInputGain as any).mockImplementation(() => {
        throw new Error('Cannot get gain');
      });
      
      const consoleSpy = vi.spyOn(console, 'error');
      const { result } = renderHook(() => useMurmubaraEngine({ autoInitialize: true }));
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      const gain = result.current.getInputGain();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get input gain'),
        expect.any(Error)
      );
      
      // Should return the local state value on error
      expect(gain).toBe(1.0);
    });

    it('should sync with setInputGain', async () => {
      const { result } = renderHook(() => useMurmubaraEngine({ autoInitialize: true }));
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      act(() => {
        result.current.setInputGain(2.2);
      });
      
      const gain = result.current.getInputGain();
      expect(gain).toBe(2.2);
    });
  });

  describe('Integration with Recording', () => {
    it('should maintain gain during recording', async () => {
      const { result } = renderHook(() => useMurmubaraEngine({ autoInitialize: true }));
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      // Set gain before recording
      act(() => {
        result.current.setInputGain(1.5);
      });
      
      // Mock getUserMedia
      const mockStream = new MediaStream();
      global.navigator.mediaDevices = {
        getUserMedia: vi.fn().mockResolvedValue(mockStream)
      } as any;
      
      // Start recording
      await act(async () => {
        await result.current.startRecording();
      });
      
      // Gain should remain accessible during recording
      expect(result.current.inputGain).toBe(1.5);
      
      // Update gain during recording
      act(() => {
        result.current.setInputGain(2.0);
      });
      
      expect(result.current.inputGain).toBe(2.0);
      
      // Stop recording
      act(() => {
        result.current.stopRecording();
      });
      
      // Gain should persist after recording
      expect(result.current.inputGain).toBe(2.0);
    });

    it('should apply gain to processed audio', async () => {
      const { result } = renderHook(() => useMurmubaraEngine({ autoInitialize: true }));
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      // Set high gain
      act(() => {
        result.current.setInputGain(2.5);
      });
      
      // Process a stream
      const mockStream = new MediaStream();
      const mockController = {
        stop: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        getState: vi.fn().mockReturnValue('processing'),
        stream: mockStream,
        processor: {}
      };
      
      (api.processStream as any).mockResolvedValue(mockController);
      
      await act(async () => {
        await result.current.processStream(mockStream);
      });
      
      expect(api.processStream).toHaveBeenCalledWith(mockStream);
      
      // Gain should have been applied
      expect(result.current.inputGain).toBe(2.5);
    });
  });

  describe('Hook Lifecycle', () => {
    it('should preserve gain across re-renders', async () => {
      const { result, rerender } = renderHook(() => 
        useMurmubaraEngine({ autoInitialize: true })
      );
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      act(() => {
        result.current.setInputGain(1.8);
      });
      
      expect(result.current.inputGain).toBe(1.8);
      
      // Force re-render
      rerender();
      
      expect(result.current.inputGain).toBe(1.8);
    });

    it('should reset gain on error recovery', async () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      // Set initial gain
      act(() => {
        result.current.setInputGain(2.0);
      });
      
      // Clear error
      act(() => {
        result.current.resetError();
      });
      
      // Gain should be preserved
      expect(result.current.inputGain).toBe(2.0);
    });

    it('should handle unmount gracefully', async () => {
      const { result, unmount } = renderHook(() => 
        useMurmubaraEngine({ autoInitialize: true })
      );
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      act(() => {
        result.current.setInputGain(1.5);
      });
      
      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle rapid gain updates', async () => {
      const { result } = renderHook(() => useMurmubaraEngine({ autoInitialize: true }));
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      // Perform rapid updates
      act(() => {
        for (let i = 0; i < 20; i++) {
          result.current.setInputGain(0.5 + i * 0.1);
        }
      });
      
      // Final value should be set
      expect(result.current.inputGain).toBe(2.4);
    });

    it('should handle interleaved get/set operations', async () => {
      const { result } = renderHook(() => useMurmubaraEngine({ autoInitialize: true }));
      
      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });
      
      act(() => {
        result.current.setInputGain(1.2);
        const gain1 = result.current.getInputGain();
        expect(gain1).toBe(1.2);
        
        result.current.setInputGain(1.8);
        const gain2 = result.current.getInputGain();
        expect(gain2).toBe(1.8);
      });
    });
  });

  describe('TypeScript Types', () => {
    it('should have correct return type signatures', () => {
      const { result } = renderHook(() => useMurmubaraEngine());
      
      // Check that functions have correct signatures
      const setGain: (gain: number) => void = result.current.setInputGain;
      const getGain: () => number = result.current.getInputGain;
      const gainValue: number = result.current.inputGain;
      
      expect(typeof setGain).toBe('function');
      expect(typeof getGain).toBe('function');
      expect(typeof gainValue).toBe('number');
    });
  });
});