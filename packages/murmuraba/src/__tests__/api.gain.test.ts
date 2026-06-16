import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initializeAudioEngine,
  destroyEngine,
  setInputGain,
  getInputGain,
  getEngine
} from '../api';
import { MurmubaraEngine } from '../core/murmuraba-engine';

// Mock the MurmubaraEngine
vi.mock('../core/murmuraba-engine', () => {
  const mockEngine = {
    initialize: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    setInputGain: vi.fn(),
    getInputGain: vi.fn().mockReturnValue(1.0),
    getDiagnostics: vi.fn().mockReturnValue({ engineState: 'ready' }),
    processStream: vi.fn(),
    processFile: vi.fn(),
    onMetricsUpdate: vi.fn(),
    off: vi.fn()
  };

  return {
    MurmubaraEngine: vi.fn().mockImplementation(() => mockEngine)
  };
});

describe('API - Gain Control Functions', () => {
  beforeEach(async () => {
    // Clean up any existing engine
    await destroyEngine();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up after each test
    await destroyEngine();
  });

  describe('setInputGain', () => {
    it('should throw error if engine is not initialized', () => {
      expect(() => setInputGain(1.5)).toThrow('Audio engine not initialized');
    });

    it('should call engine setInputGain when initialized', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      setInputGain(2.0);
      
      expect(engine.setInputGain).toHaveBeenCalledWith(2.0);
    });

    it('should handle multiple consecutive calls', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      setInputGain(1.0);
      setInputGain(1.5);
      setInputGain(2.0);
      
      expect(engine.setInputGain).toHaveBeenCalledTimes(3);
      expect(engine.setInputGain).toHaveBeenNthCalledWith(1, 1.0);
      expect(engine.setInputGain).toHaveBeenNthCalledWith(2, 1.5);
      expect(engine.setInputGain).toHaveBeenNthCalledWith(3, 2.0);
    });

    it('should pass through boundary values', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      setInputGain(0.5);
      expect(engine.setInputGain).toHaveBeenCalledWith(0.5);
      
      setInputGain(3.0);
      expect(engine.setInputGain).toHaveBeenCalledWith(3.0);
    });

    it('should pass through out-of-range values for engine to handle', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      setInputGain(0.1);
      expect(engine.setInputGain).toHaveBeenCalledWith(0.1);
      
      setInputGain(5.0);
      expect(engine.setInputGain).toHaveBeenCalledWith(5.0);
    });

    it('should handle NaN values', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      setInputGain(NaN);
      expect(engine.setInputGain).toHaveBeenCalledWith(NaN);
    });

    it('should handle Infinity values', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      setInputGain(Infinity);
      expect(engine.setInputGain).toHaveBeenCalledWith(Infinity);
      
      setInputGain(-Infinity);
      expect(engine.setInputGain).toHaveBeenCalledWith(-Infinity);
    });

    it('should handle negative values', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      setInputGain(-1.5);
      expect(engine.setInputGain).toHaveBeenCalledWith(-1.5);
    });

    it('should handle zero value', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      setInputGain(0);
      expect(engine.setInputGain).toHaveBeenCalledWith(0);
    });
  });

  describe('getInputGain', () => {
    it('should throw error if engine is not initialized', () => {
      expect(() => getInputGain()).toThrow('Audio engine not initialized');
    });

    it('should return engine gain value when initialized', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      engine.getInputGain = vi.fn().mockReturnValue(1.5);
      
      const gain = getInputGain();
      
      expect(engine.getInputGain).toHaveBeenCalled();
      expect(gain).toBe(1.5);
    });

    it('should return updated values after setInputGain', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      engine.getInputGain = vi.fn()
        .mockReturnValueOnce(1.0)
        .mockReturnValueOnce(2.0)
        .mockReturnValueOnce(0.5);
      
      expect(getInputGain()).toBe(1.0);
      expect(getInputGain()).toBe(2.0);
      expect(getInputGain()).toBe(0.5);
    });

    it('should handle multiple consecutive calls', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      engine.getInputGain = vi.fn().mockReturnValue(1.8);
      
      const gain1 = getInputGain();
      const gain2 = getInputGain();
      const gain3 = getInputGain();
      
      expect(engine.getInputGain).toHaveBeenCalledTimes(3);
      expect(gain1).toBe(1.8);
      expect(gain2).toBe(1.8);
      expect(gain3).toBe(1.8);
    });

    it('should return different types of numeric values', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      // Integer value
      engine.getInputGain = vi.fn().mockReturnValue(2);
      expect(getInputGain()).toBe(2);
      
      // Float value
      engine.getInputGain = vi.fn().mockReturnValue(1.234567);
      expect(getInputGain()).toBe(1.234567);
      
      // Very small value
      engine.getInputGain = vi.fn().mockReturnValue(0.00001);
      expect(getInputGain()).toBe(0.00001);
      
      // Scientific notation
      engine.getInputGain = vi.fn().mockReturnValue(1.5e-2);
      expect(getInputGain()).toBe(0.015);
    });
  });

  describe('Integration with Engine Lifecycle', () => {
    it('should maintain gain value across engine operations', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      // Mock the gain value persistence
      let currentGain = 1.0;
      engine.setInputGain = vi.fn((gain) => { currentGain = gain; });
      engine.getInputGain = vi.fn(() => currentGain);
      
      // Set initial gain
      setInputGain(1.5);
      expect(getInputGain()).toBe(1.5);
      
      // Simulate some operations
      engine.processStream = vi.fn();
      engine.processStream(new MediaStream());
      
      // Gain should remain
      expect(getInputGain()).toBe(1.5);
      
      // Update gain
      setInputGain(2.0);
      expect(getInputGain()).toBe(2.0);
    });

    it('should handle gain operations during stream processing', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      let currentGain = 1.0;
      engine.setInputGain = vi.fn((gain) => { currentGain = gain; });
      engine.getInputGain = vi.fn(() => currentGain);
      
      // Start processing
      const mockController = {
        stop: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        getState: vi.fn().mockReturnValue('processing')
      };
      engine.processStream = vi.fn().mockResolvedValue(mockController);
      
      const controller = await engine.processStream(new MediaStream());
      
      // Update gain during processing
      setInputGain(2.5);
      expect(getInputGain()).toBe(2.5);
      
      // Stop processing
      controller.stop();
      
      // Gain should still be accessible
      expect(getInputGain()).toBe(2.5);
    });
  });

  describe('Error Handling', () => {
    it('should handle engine throwing errors on setInputGain', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      engine.setInputGain = vi.fn().mockImplementation(() => {
        throw new Error('Gain update failed');
      });
      
      expect(() => setInputGain(1.5)).toThrow('Gain update failed');
    });

    it('should handle engine throwing errors on getInputGain', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      engine.getInputGain = vi.fn().mockImplementation(() => {
        throw new Error('Cannot retrieve gain');
      });
      
      expect(() => getInputGain()).toThrow('Cannot retrieve gain');
    });

    it('should handle engine returning undefined', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      engine.getInputGain = vi.fn().mockReturnValue(undefined);
      
      const gain = getInputGain();
      expect(gain).toBeUndefined();
    });

    it('should handle engine returning null', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      engine.getInputGain = vi.fn().mockReturnValue(null);
      
      const gain = getInputGain();
      expect(gain).toBeNull();
    });
  });

  describe('Type Safety', () => {
    it('should accept number type for setInputGain', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      // These should all be valid TypeScript calls
      setInputGain(1);
      setInputGain(1.5);
      setInputGain(0.5);
      setInputGain(3.0);
      
      expect(engine.setInputGain).toHaveBeenCalledTimes(4);
    });

    it('should return number type from getInputGain', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      engine.getInputGain = vi.fn().mockReturnValue(1.5);
      
      const gain: number = getInputGain();
      expect(typeof gain).toBe('number');
      expect(gain).toBe(1.5);
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle simultaneous setInputGain calls', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      const promises = [
        Promise.resolve(setInputGain(1.0)),
        Promise.resolve(setInputGain(1.5)),
        Promise.resolve(setInputGain(2.0))
      ];
      
      await Promise.all(promises);
      
      expect(engine.setInputGain).toHaveBeenCalledTimes(3);
    });

    it('should handle rapid successive calls', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      for (let i = 0; i < 100; i++) {
        setInputGain(0.5 + i * 0.01);
      }
      
      expect(engine.setInputGain).toHaveBeenCalledTimes(100);
    });

    it('should handle interleaved get and set calls', async () => {
      await initializeAudioEngine();
      const engine = getEngine();
      
      let currentGain = 1.0;
      engine.setInputGain = vi.fn((gain) => { currentGain = gain; });
      engine.getInputGain = vi.fn(() => currentGain);
      
      setInputGain(1.5);
      expect(getInputGain()).toBe(1.5);
      
      setInputGain(2.0);
      expect(getInputGain()).toBe(2.0);
      
      setInputGain(0.8);
      expect(getInputGain()).toBe(0.8);
    });
  });

  describe('API Surface Validation', () => {
    it('should export setInputGain function', () => {
      expect(setInputGain).toBeDefined();
      expect(typeof setInputGain).toBe('function');
    });

    it('should export getInputGain function', () => {
      expect(getInputGain).toBeDefined();
      expect(typeof getInputGain).toBe('function');
    });

    it('should have correct function signatures', async () => {
      await initializeAudioEngine();
      
      // setInputGain should accept a number
      expect(() => setInputGain(1.5)).not.toThrow();
      
      // getInputGain should return without parameters
      expect(() => getInputGain()).not.toThrow();
    });
  });
});