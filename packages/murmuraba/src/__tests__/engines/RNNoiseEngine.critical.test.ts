import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RNNoiseEngine } from '../../engines/rnnoise-engine';

describe('RNNoiseEngine - Critical Noise Reduction Tests', () => {
  let engine: RNNoiseEngine;
  let mockModule: any;
  let mockWindow: any;

  beforeEach(() => {
    // Mock WASM module
    mockModule = {
      _rnnoise_create: vi.fn(() => 12345), // Mock state pointer
      _rnnoise_destroy: vi.fn(),
      _rnnoise_process_frame: vi.fn((state, output, input) => {
        // Simulate noise reduction
        const vad = 0.8; // Voice activity detection probability
        return vad;
      }),
      _malloc: vi.fn((size) => size), // Mock memory allocation
      _free: vi.fn(),
      HEAPF32: {
        set: vi.fn(),
        subarray: vi.fn(() => new Float32Array(480))
      }
    };

    // Mock window for script loading fallback
    mockWindow = {
      createRNNWasmModule: vi.fn(() => Promise.resolve(mockModule))
    };
    global.window = mockWindow as any;

    // Mock document for script loading
    global.document = {
      createElement: vi.fn(() => ({
        onload: null,
        onerror: null,
        src: ''
      })),
      head: {
        appendChild: vi.fn((script) => {
          // Simulate script loading
          setTimeout(() => script.onload?.(), 0);
        })
      }
    } as any;

    engine = new RNNoiseEngine();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization with Multiple Fallback Strategies', () => {
    it('should initialize successfully with dynamic import', async () => {
      // Mock successful dynamic import
      vi.doMock('@jitsi/rnnoise-wasm', () => ({
        default: vi.fn(() => Promise.resolve(mockModule))
      }));

      await engine.initialize();

      expect(engine.isInitialized).toBe(true);
      expect(mockModule._rnnoise_create).toHaveBeenCalledWith(0);
      expect(mockModule._malloc).toHaveBeenCalledTimes(2); // input and output buffers
    });

    it('should fallback to embedded loader when import fails', async () => {
      // Mock failed dynamic import
      vi.doMock('@jitsi/rnnoise-wasm', () => {
        throw new Error('Module not found');
      });

      // Mock embedded loader
      vi.doMock('../../engines/rnnoise-universal-loader', () => ({
        initializeRNNoise: vi.fn(() => Promise.resolve({
          module: mockModule,
          state: 12345
        }))
      }));

      await engine.initialize();

      expect(engine.isInitialized).toBe(true);
    });

    it('should fallback to script tag when both imports fail', async () => {
      // Mock all imports failing
      vi.doMock('@jitsi/rnnoise-wasm', () => {
        throw new Error('Module not found');
      });
      
      vi.doMock('../../engines/rnnoise-universal-loader', () => {
        throw new Error('Embedded loader failed');
      });

      const customPath = '/custom/path';
      const engineWithPath = new RNNoiseEngine({ scriptPath: customPath });

      await engineWithPath.initialize();

      expect(document.createElement).toHaveBeenCalledWith('script');
      expect(engine.isInitialized).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      vi.doMock('@jitsi/rnnoise-wasm', () => ({
        default: vi.fn(() => Promise.resolve(mockModule))
      }));

      await engine.initialize();
      const firstState = (engine as any).state;
      
      await engine.initialize();
      
      expect((engine as any).state).toBe(firstState);
      expect(mockModule._rnnoise_create).toHaveBeenCalledTimes(1);
    });

    it('should handle RNNoise state creation failure', async () => {
      mockModule._rnnoise_create = vi.fn(() => null);
      
      vi.doMock('@jitsi/rnnoise-wasm', () => ({
        default: vi.fn(() => Promise.resolve(mockModule))
      }));

      await expect(engine.initialize()).rejects.toThrow('Failed to create RNNoise state');
    });
  });

  describe('Audio Processing', () => {
    beforeEach(async () => {
      vi.doMock('@jitsi/rnnoise-wasm', () => ({
        default: vi.fn(() => Promise.resolve(mockModule))
      }));
      await engine.initialize();
    });

    it('should process audio frame correctly', () => {
      const inputFrame = new Float32Array(480).fill(0.5);
      
      const output = engine.process(inputFrame);

      expect(mockModule.HEAPF32.set).toHaveBeenCalledWith(inputFrame, expect.any(Number));
      expect(mockModule._rnnoise_process_frame).toHaveBeenCalled();
      expect(output).toBeInstanceOf(Float32Array);
      expect(output.length).toBe(480);
    });

    it('should throw if processing before initialization', () => {
      const uninitializedEngine = new RNNoiseEngine();
      const inputFrame = new Float32Array(480);

      expect(() => uninitializedEngine.process(inputFrame)).toThrow('RNNoiseEngine not initialized');
    });

    it('should handle VAD probability correctly', () => {
      const inputFrame = new Float32Array(480).fill(0.1);
      mockModule._rnnoise_process_frame.mockReturnValue(0.95); // High voice probability
      
      const output = engine.process(inputFrame);
      
      // Should apply less noise reduction for voice
      expect(output).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    beforeEach(async () => {
      vi.doMock('@jitsi/rnnoise-wasm', () => ({
        default: vi.fn(() => Promise.resolve(mockModule))
      }));
      await engine.initialize();
    });

    it('should allocate memory for correct buffer sizes', async () => {
      const expectedSize = 480 * 4; // 480 samples * 4 bytes per float32
      
      expect(mockModule._malloc).toHaveBeenCalledWith(expectedSize);
      expect(mockModule._malloc).toHaveBeenCalledTimes(2); // input and output
    });

    it('should cleanup resources properly', () => {
      engine.cleanup();

      expect(mockModule._rnnoise_destroy).toHaveBeenCalledWith(12345);
      expect(mockModule._free).toHaveBeenCalledTimes(2); // input and output pointers
      expect(engine.isInitialized).toBe(false);
    });
  });
});