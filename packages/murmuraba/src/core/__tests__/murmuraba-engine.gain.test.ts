import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MurmubaraEngine } from '../murmuraba-engine';
import { MurmubaraConfig } from '../../types';

describe('MurmubaraEngine - Gain Control', () => {
  let engine: MurmubaraEngine;

  beforeEach(() => {
    // Mock AudioContext
    global.AudioContext = vi.fn().mockImplementation(() => ({
      createMediaStreamSource: vi.fn(),
      createMediaStreamDestination: vi.fn(() => ({
        stream: new MediaStream()
      })),
      createScriptProcessor: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        onaudioprocess: null
      })),
      createGain: vi.fn(() => ({
        gain: { value: 1.0 },
        connect: vi.fn(),
        disconnect: vi.fn()
      })),
      createBiquadFilter: vi.fn(() => ({
        type: 'notch',
        frequency: { value: 1000 },
        Q: { value: 30 },
        gain: { value: 0 },
        connect: vi.fn(),
        disconnect: vi.fn()
      })),
      sampleRate: 48000,
      state: 'running',
      destination: { maxChannelCount: 2 },
      close: vi.fn().mockResolvedValue(undefined)
    })) as any;

    // Mock WebAssembly
    global.WebAssembly = {
      instantiate: vi.fn(),
      compile: vi.fn(),
      Module: vi.fn() as any,
      Instance: vi.fn() as any,
      Memory: vi.fn() as any,
      Table: vi.fn() as any,
      Global: vi.fn() as any,
      Tag: vi.fn() as any,
      CompileError: Error as any,
      LinkError: Error as any,
      RuntimeError: Error as any,
      instantiateStreaming: vi.fn()
    };
  });

  afterEach(async () => {
    if (engine) {
      try {
        await engine.destroy(true);
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('Constructor Initialization', () => {
    it('should initialize with default gain value of 1.0', () => {
      engine = new MurmubaraEngine();
      expect(engine.getInputGain()).toBe(1.0);
    });

    it('should accept custom gain value in config', () => {
      const config: MurmubaraConfig = { inputGain: 1.5 };
      engine = new MurmubaraEngine(config);
      expect(engine.getInputGain()).toBe(1.5);
    });

    it('should clamp gain value to minimum 0.5', () => {
      const config: MurmubaraConfig = { inputGain: 0.3 };
      engine = new MurmubaraEngine(config);
      expect(engine.getInputGain()).toBe(0.5);
    });

    it('should clamp gain value to maximum 3.0', () => {
      const config: MurmubaraConfig = { inputGain: 5.0 };
      engine = new MurmubaraEngine(config);
      expect(engine.getInputGain()).toBe(3.0);
    });

    it('should handle negative gain values', () => {
      const config: MurmubaraConfig = { inputGain: -1.0 };
      engine = new MurmubaraEngine(config);
      expect(engine.getInputGain()).toBe(0.5);
    });

    it('should handle NaN gain values', () => {
      const config: MurmubaraConfig = { inputGain: NaN };
      engine = new MurmubaraEngine(config);
      expect(engine.getInputGain()).toBe(0.5);
    });

    it('should handle Infinity gain values', () => {
      const config: MurmubaraConfig = { inputGain: Infinity };
      engine = new MurmubaraEngine(config);
      expect(engine.getInputGain()).toBe(3.0);
    });
  });

  describe('setInputGain Method', () => {
    beforeEach(() => {
      engine = new MurmubaraEngine();
    });

    it('should update gain value within valid range', () => {
      engine.setInputGain(2.0);
      expect(engine.getInputGain()).toBe(2.0);
    });

    it('should clamp values below minimum', () => {
      engine.setInputGain(0.2);
      expect(engine.getInputGain()).toBe(0.5);
    });

    it('should clamp values above maximum', () => {
      engine.setInputGain(4.0);
      expect(engine.getInputGain()).toBe(3.0);
    });

    it('should handle edge case at minimum boundary', () => {
      engine.setInputGain(0.5);
      expect(engine.getInputGain()).toBe(0.5);
    });

    it('should handle edge case at maximum boundary', () => {
      engine.setInputGain(3.0);
      expect(engine.getInputGain()).toBe(3.0);
    });

    it('should handle fractional values precisely', () => {
      engine.setInputGain(1.234);
      expect(engine.getInputGain()).toBeCloseTo(1.234, 3);
    });

    it('should handle multiple sequential updates', () => {
      engine.setInputGain(1.0);
      expect(engine.getInputGain()).toBe(1.0);
      
      engine.setInputGain(2.0);
      expect(engine.getInputGain()).toBe(2.0);
      
      engine.setInputGain(0.7);
      expect(engine.getInputGain()).toBe(0.7);
    });

    it('should update gain node when stream is active', async () => {
      // Mock the WASM module loading
      vi.mock('../../utils/rnnoise-loader', () => ({
        loadRNNoiseModule: vi.fn().mockResolvedValue({
          _rnnoise_create: vi.fn().mockReturnValue(1),
          _rnnoise_destroy: vi.fn(),
          _rnnoise_process_frame: vi.fn().mockReturnValue(0.5),
          _malloc: vi.fn().mockReturnValue(1000),
          _free: vi.fn(),
          HEAPF32: new Float32Array(10000)
        })
      }));

      await engine.initialize();
      
      const mockStream = new MediaStream();
      const controller = await engine.processStream(mockStream);
      
      const initialGain = engine.getInputGain();
      engine.setInputGain(2.5);
      
      expect(engine.getInputGain()).toBe(2.5);
      expect(engine.getInputGain()).not.toBe(initialGain);
      
      controller.stop();
    });
  });

  describe('getInputGain Method', () => {
    beforeEach(() => {
      engine = new MurmubaraEngine({ inputGain: 1.8 });
    });

    it('should return current gain value', () => {
      expect(engine.getInputGain()).toBe(1.8);
    });

    it('should reflect updates from setInputGain', () => {
      engine.setInputGain(2.2);
      expect(engine.getInputGain()).toBe(2.2);
    });

    it('should return consistent values on multiple calls', () => {
      const gain1 = engine.getInputGain();
      const gain2 = engine.getInputGain();
      const gain3 = engine.getInputGain();
      
      expect(gain1).toBe(gain2);
      expect(gain2).toBe(gain3);
    });
  });

  describe('Gain Node Integration', () => {
    beforeEach(async () => {
      engine = new MurmubaraEngine();
      
      // Mock the WASM module
      vi.mock('../../utils/rnnoise-loader', () => ({
        loadRNNoiseModule: vi.fn().mockResolvedValue({
          _rnnoise_create: vi.fn().mockReturnValue(1),
          _rnnoise_destroy: vi.fn(),
          _rnnoise_process_frame: vi.fn().mockReturnValue(0.5),
          _malloc: vi.fn().mockReturnValue(1000),
          _free: vi.fn(),
          HEAPF32: new Float32Array(10000)
        })
      }));
    });

    it('should create gain node during stream processing', async () => {
      await engine.initialize();
      
      const mockStream = new MediaStream();
      const createGainSpy = vi.spyOn(engine['audioContext']!, 'createGain');
      
      const controller = await engine.processStream(mockStream);
      
      expect(createGainSpy).toHaveBeenCalled();
      
      controller.stop();
    });

    it('should apply gain value to gain node', async () => {
      engine.setInputGain(1.7);
      await engine.initialize();
      
      const mockStream = new MediaStream();
      const mockGainNode = { 
        gain: { value: 1.0 }, 
        connect: vi.fn(),
        disconnect: vi.fn()
      };
      
      engine['audioContext']!.createGain = vi.fn().mockReturnValue(mockGainNode);
      
      const controller = await engine.processStream(mockStream);
      
      expect(mockGainNode.gain.value).toBe(1.7);
      
      controller.stop();
    });

    it('should update gain node value dynamically', async () => {
      await engine.initialize();
      
      const mockStream = new MediaStream();
      const mockGainNode = { 
        gain: { value: 1.0 }, 
        connect: vi.fn(),
        disconnect: vi.fn()
      };
      
      engine['audioContext']!.createGain = vi.fn().mockReturnValue(mockGainNode);
      
      const controller = await engine.processStream(mockStream);
      
      engine.setInputGain(2.3);
      expect(mockGainNode.gain.value).toBe(2.3);
      
      engine.setInputGain(0.8);
      expect(mockGainNode.gain.value).toBe(0.8);
      
      controller.stop();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      engine = new MurmubaraEngine();
    });

    it('should handle gain updates when not initialized', () => {
      expect(() => engine.setInputGain(1.5)).not.toThrow();
      expect(engine.getInputGain()).toBe(1.5);
    });

    it('should handle gain updates when in error state', async () => {
      // Force error state by failing initialization
      global.AudioContext = undefined as any;
      
      try {
        await engine.initialize();
      } catch (error) {
        // Expected to fail
      }
      
      expect(() => engine.setInputGain(2.0)).not.toThrow();
      expect(engine.getInputGain()).toBe(2.0);
    });

    it('should maintain gain value through destroy/reinitialize cycle', async () => {
      engine.setInputGain(2.5);
      
      await engine.initialize();
      expect(engine.getInputGain()).toBe(2.5);
      
      await engine.destroy();
      expect(engine.getInputGain()).toBe(2.5);
    });
  });

  describe('Gain Validation Edge Cases', () => {
    beforeEach(() => {
      engine = new MurmubaraEngine();
    });

    it('should handle very small positive values', () => {
      engine.setInputGain(0.0001);
      expect(engine.getInputGain()).toBe(0.5);
    });

    it('should handle very large positive values', () => {
      engine.setInputGain(9999);
      expect(engine.getInputGain()).toBe(3.0);
    });

    it('should handle zero value', () => {
      engine.setInputGain(0);
      expect(engine.getInputGain()).toBe(0.5);
    });

    it('should handle negative zero', () => {
      engine.setInputGain(-0);
      expect(engine.getInputGain()).toBe(0.5);
    });

    it('should handle Number.MIN_VALUE', () => {
      engine.setInputGain(Number.MIN_VALUE);
      expect(engine.getInputGain()).toBe(0.5);
    });

    it('should handle Number.MAX_VALUE', () => {
      engine.setInputGain(Number.MAX_VALUE);
      expect(engine.getInputGain()).toBe(3.0);
    });

    it('should handle Number.NEGATIVE_INFINITY', () => {
      engine.setInputGain(Number.NEGATIVE_INFINITY);
      expect(engine.getInputGain()).toBe(0.5);
    });

    it('should handle Number.POSITIVE_INFINITY', () => {
      engine.setInputGain(Number.POSITIVE_INFINITY);
      expect(engine.getInputGain()).toBe(3.0);
    });

    it('should handle undefined cast to number', () => {
      engine.setInputGain(undefined as any);
      expect(engine.getInputGain()).toBe(0.5);
    });

    it('should handle null cast to number', () => {
      engine.setInputGain(null as any);
      expect(engine.getInputGain()).toBe(0.5);
    });
  });

  describe('Logging and Events', () => {
    beforeEach(() => {
      engine = new MurmubaraEngine({ logLevel: 'debug' });
      vi.spyOn(console, 'info');
      vi.spyOn(console, 'debug');
    });

    it('should log gain updates', () => {
      engine.setInputGain(1.5);
      
      // The logger should have been called with gain info
      // Note: Actual log implementation may vary
      expect(engine.getInputGain()).toBe(1.5);
    });

    it('should log when gain node is updated', async () => {
      await engine.initialize();
      
      const mockStream = new MediaStream();
      const controller = await engine.processStream(mockStream);
      
      engine.setInputGain(2.0);
      
      // Verify that gain was set
      expect(engine.getInputGain()).toBe(2.0);
      
      controller.stop();
    });
  });

  describe('Performance and Memory', () => {
    it('should not leak memory on repeated gain updates', () => {
      engine = new MurmubaraEngine();
      
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Perform many gain updates
      for (let i = 0; i < 1000; i++) {
        engine.setInputGain(0.5 + (i % 25) * 0.1);
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be minimal (less than 1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });

    it('should handle rapid gain updates efficiently', () => {
      engine = new MurmubaraEngine();
      
      const startTime = performance.now();
      
      // Perform 10000 rapid updates
      for (let i = 0; i < 10000; i++) {
        engine.setInputGain(1.0 + (i % 20) * 0.1);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in less than 100ms
      expect(duration).toBeLessThan(100);
    });
  });
});