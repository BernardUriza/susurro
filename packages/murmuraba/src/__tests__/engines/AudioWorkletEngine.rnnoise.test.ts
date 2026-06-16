import { AudioWorkletEngine } from '../../engines/audio-worklet-engine';
import { vi } from 'vitest';

describe('AudioWorkletEngine with RNNoise', () => {
  let originalAudioContext: any;
  let originalAudioWorklet: any;
  let originalBlob: any;
  let originalURL: any;
  let originalOfflineAudioContext: any;

  beforeEach(() => {
    // Save original values
    originalAudioContext = (global as any).AudioContext;
    originalAudioWorklet = (global as any).AudioWorklet;
    originalBlob = (global as any).Blob;
    originalURL = (global as any).URL;
    originalOfflineAudioContext = (global as any).OfflineAudioContext;
    
    // Mock Blob
    (global as any).Blob = vi.fn((content, options) => ({
      content,
      options
    }));
    
    // Mock URL
    (global as any).URL = {
      createObjectURL: vi.fn(() => 'blob://mock-url'),
      revokeObjectURL: vi.fn()
    };
  });

  afterEach(() => {
    // Restore original values
    (global as any).AudioContext = originalAudioContext;
    (global as any).AudioWorklet = originalAudioWorklet;
    (global as any).Blob = originalBlob;
    (global as any).URL = originalURL;
    (global as any).OfflineAudioContext = originalOfflineAudioContext;
  });

  describe('RNNoise Integration in AudioWorkletProcessor', () => {
    it('should include RNNoise WASM loading in processor code', async () => {
      const mockAudioContext = {
        audioWorklet: {
          addModule: vi.fn().mockResolvedValue(undefined)
        }
      };
      (global as any).AudioContext = vi.fn(() => mockAudioContext);
      (global as any).AudioWorklet = vi.fn();

      const engine = new AudioWorkletEngine();
      await engine.initialize();

      // Check that Blob was created with processor code
      expect((global as any).Blob).toHaveBeenCalled();
      const blobCall = (global as any).Blob.mock.calls[0];
      const processorCode = blobCall[0][0];
      
      // Check for RNNoise-specific code
      expect(processorCode).toContain('class RNNoiseProcessor extends AudioWorkletProcessor');
      expect(processorCode).toContain('this.frameSize = 480'); // RNNoise frame size
      expect(processorCode).toContain('this.isRNNoiseReady = false');
      expect(processorCode).toContain('initializeRNNoise');
    });

    it('should handle 480-sample frames for RNNoise processing', async () => {
      const mockAudioContext = {
        audioWorklet: {
          addModule: vi.fn().mockResolvedValue(undefined)
        },
        sampleRate: 48000
      };
      (global as any).AudioContext = vi.fn(() => mockAudioContext);
      (global as any).AudioWorklet = vi.fn();

      const engine = new AudioWorkletEngine();
      await engine.initialize();

      const processorCode = (global as any).Blob.mock.calls[0][0][0];
      
      // Check frame buffering logic
      expect(processorCode).toContain('this.inputBuffer = new Float32Array(this.frameSize)');
      expect(processorCode).toContain('this.bufferIndex = 0');
      expect(processorCode).toContain('processFrame');
    });

    it('should include message handling for RNNoise control', async () => {
      const mockAudioContext = {
        audioWorklet: {
          addModule: vi.fn().mockResolvedValue(undefined)
        }
      };
      (global as any).AudioContext = vi.fn(() => mockAudioContext);
      (global as any).AudioWorklet = vi.fn();

      const engine = new AudioWorkletEngine();
      await engine.initialize();

      const processorCode = (global as any).Blob.mock.calls[0][0][0];
      
      // Check message handling
      expect(processorCode).toContain('this.port.onmessage');
      expect(processorCode).toContain('updateSettings');
      expect(processorCode).toContain('loadWASM');
    });
  });

  describe('RNNoise Configuration', () => {
    it('should pass RNNoise configuration to worklet', async () => {
      let messageHandler: any = null;
      const mockWorkletNode = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        port: {
          postMessage: vi.fn(),
          get onmessage() { return messageHandler; },
          set onmessage(handler) { messageHandler = handler; }
        }
      };
      
      const mockAudioContext = {
        audioWorklet: {
          addModule: vi.fn().mockResolvedValue(undefined)
        },
        sampleRate: 48000
      };
      
      (global as any).AudioContext = vi.fn(() => mockAudioContext);
      (global as any).AudioWorklet = vi.fn();
      (global as any).AudioWorkletNode = vi.fn(() => mockWorkletNode);

      const engine = new AudioWorkletEngine({ 
        enableRNNoise: true,
        rnnoiseWasmUrl: 'https://example.com/rnnoise.wasm'
      });
      await engine.initialize();
      
      const workletNode = engine.createWorkletNode();
      
      expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
        type: 'initialize',
        data: {
          enableRNNoise: true,
          wasmUrl: 'https://example.com/rnnoise.wasm'
        }
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should collect performance metrics from worklet', async () => {
      let messageHandler: any = null;
      const mockWorkletNode = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        port: {
          postMessage: vi.fn(),
          get onmessage() { return messageHandler; },
          set onmessage(handler) { messageHandler = handler; }
        }
      };
      
      const mockAudioContext = {
        audioWorklet: {
          addModule: vi.fn().mockResolvedValue(undefined)
        },
        sampleRate: 48000
      };
      
      (global as any).AudioContext = vi.fn(() => mockAudioContext);
      (global as any).AudioWorklet = vi.fn();
      (global as any).AudioWorkletNode = vi.fn(() => mockWorkletNode);

      const engine = new AudioWorkletEngine();
      await engine.initialize();
      
      const workletNode = engine.createWorkletNode();
      
      // Set up performance callback
      const performanceCallback = vi.fn();
      engine.onPerformanceMetrics(performanceCallback);
      
      // Simulate performance message from worklet
      // The onmessage handler is set by the engine
      const onmessageHandler = mockWorkletNode.port.onmessage;
      if (typeof onmessageHandler === 'function') {
        onmessageHandler({
          data: {
            type: 'performance',
            metrics: {
              processingTime: 0.5,
              bufferUnderruns: 0,
              framesProcessed: 1000
            }
          }
        } as any);
      }
      
      expect(performanceCallback).toHaveBeenCalledWith({
        processingTime: 0.5,
        bufferUnderruns: 0,
        framesProcessed: 1000
      });
    });
  });
});