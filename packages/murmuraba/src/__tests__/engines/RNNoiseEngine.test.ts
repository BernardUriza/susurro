import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RNNoiseEngine } from '../../engines/rnnoise-engine';

// Global mocks
let mockModule: any;
let mockWindow: any;
let mockDocument: any;

// Mock dynamic imports
vi.mock('@jitsi/rnnoise-wasm', () => ({
  default: vi.fn(() => Promise.resolve(mockModule))
}));

vi.mock('../../engines/rnnoise-universal-loader', () => ({
  initializeRNNoise: vi.fn(() => Promise.resolve({
    module: mockModule,
    state: 12345
  }))
}));

describe('RNNoiseEngine', () => {
  let engine: RNNoiseEngine;
  let consoleLogSpy: vi.SpyInstance;
  let consoleErrorSpy: vi.SpyInstance;

  beforeEach(() => {
    // Reset mocks
    mockModule = {
      _rnnoise_create: vi.fn(() => 12345), // Mock state pointer
      _rnnoise_destroy: vi.fn(),
      _rnnoise_process_frame: vi.fn((state, output, input) => {
        // Simulate noise reduction with VAD
        return 0.8; // Voice activity detection probability
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
    mockDocument = {
      createElement: vi.fn(() => {
        const script = {
          onload: null,
          onerror: null,
          src: ''
        };
        return script;
      }),
      head: {
        appendChild: vi.fn((script: any) => {
          // Simulate script loading success
          setTimeout(() => script.onload?.(), 0);
        })
      }
    };
    global.document = mockDocument as any;

    // Console spies
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();

    engine = new RNNoiseEngine();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      expect(engine).toBeDefined();
      expect(engine.name).toBe('RNNoise');
      expect(engine.description).toBe('Neural network-based noise suppression');
      expect(engine.isInitialized).toBe(false);
    });

    it('should accept custom config', () => {
      const customEngine = new RNNoiseEngine({
        wasmPath: '/custom/wasm',
        scriptPath: '/custom/script.js'
      });
      
      expect(customEngine).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should not reinitialize if already initialized', async () => {
      // First initialization
      await engine.initialize();
      expect(engine.isInitialized).toBe(true);
      
      // Clear mocks
      mockModule._rnnoise_create.mockClear();
      
      // Second initialization should return early
      await engine.initialize();
      
      expect(mockModule._rnnoise_create).not.toHaveBeenCalled();
    });

    it('should check WebAssembly support', async () => {
      // Remove WebAssembly
      const originalWebAssembly = global.WebAssembly;
      delete (global as any).WebAssembly;
      
      await expect(engine.initialize()).rejects.toThrow('WebAssembly is not supported');
      
      // Restore
      global.WebAssembly = originalWebAssembly;
    });

    it('should initialize with dynamic import (Option 1)', async () => {
      await engine.initialize();
      
      expect(engine.isInitialized).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith('[RNNoiseEngine] Starting initialization...');
      expect(consoleLogSpy).toHaveBeenCalledWith('[RNNoiseEngine] Initialization complete!');
      expect(mockModule._rnnoise_create).toHaveBeenCalledWith(0);
      expect(mockModule._malloc).toHaveBeenCalledTimes(2); // input and output buffers
    });

    it('should fallback to embedded loader when dynamic import fails (Option 2)', async () => {
      // Make dynamic import fail
      vi.mocked(require('@jitsi/rnnoise-wasm').default).mockRejectedValueOnce(new Error('Import failed'));
      
      await engine.initialize();
      
      expect(engine.isInitialized).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[RNNoiseEngine] Failed to load from import:',
        'Import failed'
      );
    });

    it('should fallback to script tag when both imports fail (Option 3)', async () => {
      // Make both imports fail
      vi.mocked(require('@jitsi/rnnoise-wasm').default).mockRejectedValueOnce(new Error('Import failed'));
      vi.mocked(require('../../engines/rnnoise-universal-loader').initializeRNNoise).mockRejectedValueOnce(new Error('Embedded failed'));
      
      await engine.initialize();
      
      expect(mockDocument.createElement).toHaveBeenCalledWith('script');
      expect(engine.isInitialized).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[RNNoiseEngine] Failed to load embedded:',
        'Embedded failed'
      );
    });

    it('should handle script loading with custom paths', async () => {
      const customEngine = new RNNoiseEngine({
        wasmPath: '/custom/wasm',
        scriptPath: '/custom/rnnoise.js'
      });
      
      // Make imports fail to trigger script loading
      vi.mocked(require('@jitsi/rnnoise-wasm').default).mockRejectedValueOnce(new Error('Import failed'));
      vi.mocked(require('../../engines/rnnoise-universal-loader').initializeRNNoise).mockRejectedValueOnce(new Error('Embedded failed'));
      
      await customEngine.initialize();
      
      const createdScript = mockDocument.createElement.mock.results[0].value;
      expect(createdScript.src).toBe('/custom/rnnoise.js');
    });

    it('should handle script loading errors', async () => {
      // Make all imports fail
      vi.mocked(require('@jitsi/rnnoise-wasm').default).mockRejectedValueOnce(new Error('Import failed'));
      vi.mocked(require('../../engines/rnnoise-universal-loader').initializeRNNoise).mockRejectedValueOnce(new Error('Embedded failed'));
      
      // Make script loading fail
      mockDocument.head.appendChild = vi.fn((script: any) => {
        setTimeout(() => script.onerror?.(new Error('Script load failed')), 0);
      });
      
      await expect(engine.initialize()).rejects.toThrow('Failed to initialize RNNoise');
    });

    it('should handle missing createRNNWasmModule after script load', async () => {
      // Make imports fail
      vi.mocked(require('@jitsi/rnnoise-wasm').default).mockRejectedValueOnce(new Error('Import failed'));
      vi.mocked(require('../../engines/rnnoise-universal-loader').initializeRNNoise).mockRejectedValueOnce(new Error('Embedded failed'));
      
      // Remove createRNNWasmModule
      delete mockWindow.createRNNWasmModule;
      
      await expect(engine.initialize()).rejects.toThrow('createRNNWasmModule not found on window');
    });

    it('should handle WASM loading errors with specific message', async () => {
      // Make imports fail
      vi.mocked(require('@jitsi/rnnoise-wasm').default).mockRejectedValueOnce(new Error('Import failed'));
      vi.mocked(require('../../engines/rnnoise-universal-loader').initializeRNNoise).mockRejectedValueOnce(new Error('Embedded failed'));
      
      // Make script loading fail with WASM error
      mockDocument.head.appendChild = vi.fn((script: any) => {
        setTimeout(() => script.onerror?.(new Error('Aborted() wasm loading error')), 0);
      });
      
      await expect(engine.initialize()).rejects.toThrow('WASM file could not be loaded');
    });

    it('should handle RNNoise state creation failure', async () => {
      mockModule._rnnoise_create.mockReturnValue(null);
      
      await expect(engine.initialize()).rejects.toThrow('Failed to create RNNoise state');
    });

    it('should perform warmup with silent frames', async () => {
      await engine.initialize();
      
      // Should call process_frame 10 times for warmup
      expect(mockModule._rnnoise_process_frame).toHaveBeenCalledTimes(10);
      expect(mockModule.HEAPF32.set).toHaveBeenCalledTimes(10);
    });
  });

  describe('process', () => {
    beforeEach(async () => {
      await engine.initialize();
      vi.clearAllMocks(); // Clear warmup calls
    });

    it('should throw if not initialized', () => {
      const uninitializedEngine = new RNNoiseEngine();
      const input = new Float32Array(480);
      
      expect(() => uninitializedEngine.process(input)).toThrow('RNNoiseEngine not initialized');
    });

    it('should validate input buffer size', () => {
      const wrongSizeInput = new Float32Array(256);
      
      expect(() => engine.process(wrongSizeInput)).toThrow('RNNoise requires exactly 480 samples per frame');
    });

    it('should process audio frame correctly', () => {
      const input = new Float32Array(480).fill(0.5);
      
      // Mock HEAPF32 behavior
      const heapData = new Float32Array(1920); // Enough for input and output
      mockModule.HEAPF32 = {
        set: vi.fn((data, offset) => {
          for (let i = 0; i < data.length; i++) {
            heapData[offset + i] = data[i];
          }
        }),
        [(mockModule._malloc(480 * 4) >> 2) + 0]: 0.1,
        [(mockModule._malloc(480 * 4) >> 2) + 1]: 0.2,
        // ... simplified for test
      };
      
      // Create getter for array access
      for (let i = 0; i < 480; i++) {
        Object.defineProperty(mockModule.HEAPF32, (mockModule._malloc(480 * 4) >> 2) + i, {
          get: () => heapData[480 + i] || 0.3, // Output data
          configurable: true
        });
      }
      
      const output = engine.process(input);
      
      expect(mockModule.HEAPF32.set).toHaveBeenCalledWith(input, expect.any(Number));
      expect(mockModule._rnnoise_process_frame).toHaveBeenCalledWith(
        12345, // state
        expect.any(Number), // output ptr
        expect.any(Number)  // input ptr
      );
      expect(output).toBeInstanceOf(Float32Array);
      expect(output.length).toBe(480);
    });

    it('should store VAD value from processing', () => {
      const input = new Float32Array(480);
      mockModule._rnnoise_process_frame.mockReturnValue(0.95);
      
      engine.process(input);
      
      expect((engine as any).lastVad).toBe(0.95);
    });

    it('should handle zero VAD value', () => {
      const input = new Float32Array(480);
      mockModule._rnnoise_process_frame.mockReturnValue(0);
      
      engine.process(input);
      
      expect((engine as any).lastVad).toBe(0);
    });

    it('should handle undefined VAD value', () => {
      const input = new Float32Array(480);
      mockModule._rnnoise_process_frame.mockReturnValue(undefined);
      
      engine.process(input);
      
      expect((engine as any).lastVad).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should clean up resources when initialized', async () => {
      await engine.initialize();
      
      engine.cleanup();
      
      expect(mockModule._free).toHaveBeenCalledTimes(2); // input and output pointers
      expect(mockModule._rnnoise_destroy).toHaveBeenCalledWith(12345);
      expect(engine.isInitialized).toBe(false);
      expect((engine as any).module).toBeNull();
      expect((engine as any).state).toBeNull();
    });

    it('should handle cleanup when not initialized', () => {
      expect(() => engine.cleanup()).not.toThrow();
    });

    it('should handle cleanup when partially initialized', async () => {
      // Manually set module without state
      (engine as any).module = mockModule;
      (engine as any).state = null;
      
      expect(() => engine.cleanup()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle multiple initialization attempts after cleanup', async () => {
      // First initialization
      await engine.initialize();
      expect(engine.isInitialized).toBe(true);
      
      // Cleanup
      engine.cleanup();
      expect(engine.isInitialized).toBe(false);
      
      // Re-initialize
      await engine.initialize();
      expect(engine.isInitialized).toBe(true);
    });

    it('should handle process with special float values', async () => {
      await engine.initialize();
      
      const input = new Float32Array(480);
      input[0] = NaN;
      input[1] = Infinity;
      input[2] = -Infinity;
      
      // Should not throw
      const output = engine.process(input);
      expect(output).toBeInstanceOf(Float32Array);
    });

    it('should handle concurrent initialization attempts', async () => {
      // Start multiple initializations
      const promise1 = engine.initialize();
      const promise2 = engine.initialize();
      const promise3 = engine.initialize();
      
      await Promise.all([promise1, promise2, promise3]);
      
      // Should only create state once
      expect(mockModule._rnnoise_create).toHaveBeenCalledTimes(1);
    });
  });
});