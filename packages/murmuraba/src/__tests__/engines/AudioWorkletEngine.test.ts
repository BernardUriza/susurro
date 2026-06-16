import { AudioWorkletEngine } from '../../engines/audio-worklet-engine';
import { vi } from 'vitest';
import { createFullTestEnvironment, MockFactories } from '../shared/test-utils';

describe('AudioWorkletEngine', () => {
  let testEnv: ReturnType<typeof createFullTestEnvironment>;

  beforeEach(() => {
    testEnv = createFullTestEnvironment();
    
    // Mock additional AudioWorklet-specific globals
    (global as any).Blob = vi.fn((content, options) => ({
      content,
      options
    }));
    
    (global as any).URL = {
      createObjectURL: vi.fn(() => 'blob://mock-url'),
      revokeObjectURL: vi.fn()
    };
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe('AudioWorklet Support Detection', () => {
    it('should detect when AudioWorklet is supported', () => {
      // Create AudioContext with audioWorklet support
      const mockAudioContext = MockFactories.createAudioContextMock({
        audioWorklet: {
          addModule: vi.fn()
        }
      });
      (global as any).AudioContext = vi.fn(() => mockAudioContext);
      (global as any).AudioWorklet = vi.fn();

      const engine = new AudioWorkletEngine();
      expect(engine.isAudioWorkletSupported()).toBe(true);
    });

    it('should detect when AudioWorklet is not supported', () => {
      // Create AudioContext without audioWorklet support
      const mockAudioContext = MockFactories.createAudioContextMock({});
      (global as any).AudioContext = vi.fn(() => mockAudioContext);
      delete (global as any).AudioWorklet;

      const engine = new AudioWorkletEngine();
      expect(engine.isAudioWorkletSupported()).toBe(false);
    });

    it('should handle when AudioContext is not available', () => {
      // Remove AudioContext entirely
      delete (global as any).AudioContext;
      delete (global as any).AudioWorklet;

      const engine = new AudioWorkletEngine();
      expect(engine.isAudioWorkletSupported()).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should throw error when AudioWorklet is not supported', async () => {
      // Mock no AudioWorklet support
      const mockAudioContext = {};
      (global as any).AudioContext = vi.fn(() => mockAudioContext);
      (global as any).AudioWorklet = undefined;

      const engine = new AudioWorkletEngine();
      await expect(engine.initialize()).rejects.toThrow('AudioWorklet is not supported in this browser');
    });

    it('should initialize successfully when AudioWorklet is supported', async () => {
      // Mock AudioWorklet support
      const mockAddModule = vi.fn().mockResolvedValue(undefined);
      const mockAudioContext = {
        audioWorklet: {
          addModule: mockAddModule
        }
      };
      (global as any).AudioContext = vi.fn(() => mockAudioContext);
      (global as any).AudioWorklet = vi.fn();

      const engine = new AudioWorkletEngine();
      await engine.initialize();

      expect(engine.isInitialized).toBe(true);
      expect(mockAddModule).toHaveBeenCalled();
    });
  });

  describe('AudioWorklet Processor Creation', () => {
    let mockAudioContext: any;
    let mockAddModule: vi.Mock;

    beforeEach(() => {
      mockAddModule = vi.fn().mockResolvedValue(undefined);
      mockAudioContext = {
        audioWorklet: {
          addModule: mockAddModule
        },
        createScriptProcessor: vi.fn(),
        createGain: vi.fn(() => ({
          connect: vi.fn(),
          disconnect: vi.fn(),
          gain: { value: 1 }
        })),
        destination: {}
      };
      (global as any).AudioContext = vi.fn(() => mockAudioContext);
      (global as any).AudioWorklet = vi.fn();
      (global as any).AudioWorkletNode = vi.fn((context, name, options) => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        port: {
          postMessage: vi.fn(),
          onmessage: null
        }
      }));
    });

    it('should create AudioWorkletNode after initialization', async () => {
      const engine = new AudioWorkletEngine();
      await engine.initialize();

      const workletNode = engine.createWorkletNode();
      expect(workletNode).toBeDefined();
      expect((global as any).AudioWorkletNode).toHaveBeenCalledWith(
        mockAudioContext,
        'rnnoise-processor',
        expect.any(Object)
      );
    });

    it('should throw error when creating node before initialization', () => {
      const engine = new AudioWorkletEngine();
      expect(() => engine.createWorkletNode()).toThrow('AudioWorkletEngine not initialized');
    });

    it('should include RNNoise processor code in the module', async () => {
      const engine = new AudioWorkletEngine();
      await engine.initialize();

      // Check that Blob was created with processor code
      expect((global as any).Blob).toHaveBeenCalled();
      const blobCall = (global as any).Blob.mock.calls[0];
      const processorCode = blobCall[0][0];
      
      expect(processorCode).toContain('class RNNoiseProcessor extends AudioWorkletProcessor');
      expect(processorCode).toContain("registerProcessor('rnnoise-processor'");
    });
  });

  describe('Audio Processing', () => {
    let mockAudioContext: any;
    let mockWorkletNode: any;
    let mockScriptProcessor: any;
    let mockOfflineContext: any;

    beforeEach(() => {
      mockScriptProcessor = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        onaudioprocess: null
      };
      
      mockWorkletNode = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        port: {
          postMessage: vi.fn(),
          onmessage: null
        }
      };
      
      mockAudioContext = {
        audioWorklet: {
          addModule: vi.fn().mockResolvedValue(undefined)
        },
        createScriptProcessor: vi.fn(() => mockScriptProcessor),
        createMediaStreamSource: vi.fn(() => ({
          connect: vi.fn(),
          disconnect: vi.fn()
        })),
        createGain: vi.fn(() => ({
          connect: vi.fn(),
          disconnect: vi.fn(),
          gain: { value: 1 }
        })),
        destination: {},
        sampleRate: 48000
      };
      
      (global as any).AudioContext = vi.fn(() => mockAudioContext);
      (global as any).AudioWorklet = vi.fn();
      (global as any).AudioWorkletNode = vi.fn(() => mockWorkletNode);
      
      // Mock OfflineAudioContext
      mockOfflineContext = {
        createBuffer: vi.fn(() => ({
          copyToChannel: vi.fn(),
          copyFromChannel: vi.fn((target) => {
            // Fill target with mock processed data
            for (let i = 0; i < target.length; i++) {
              target[i] = Math.sin(2 * Math.PI * i / 480) * 0.5; // Simulated processed audio
            }
          })
        })),
        createBufferSource: vi.fn(() => ({
          buffer: null,
          connect: vi.fn(),
          start: vi.fn()
        })),
        audioWorklet: {
          addModule: vi.fn().mockResolvedValue(undefined)
        },
        destination: {},
        sampleRate: 48000,
        startRendering: vi.fn().mockResolvedValue({
          copyFromChannel: vi.fn((target) => {
            for (let i = 0; i < target.length; i++) {
              target[i] = Math.sin(2 * Math.PI * i / 480) * 0.5;
            }
          })
        })
      };
      
      (global as any).OfflineAudioContext = vi.fn(() => mockOfflineContext);
    });

    it('should process audio buffer through worklet', async () => {
      const engine = new AudioWorkletEngine();
      await engine.initialize();
      
      const inputBuffer = new Float32Array(480);
      for (let i = 0; i < 480; i++) {
        inputBuffer[i] = Math.sin(2 * Math.PI * i / 480);
      }
      
      const outputBuffer = await engine.processWithWorklet(inputBuffer);
      expect(outputBuffer).toBeInstanceOf(Float32Array);
      expect(outputBuffer.length).toBe(480);
    });

    it('should throw error when processing before initialization', async () => {
      const engine = new AudioWorkletEngine();
      const inputBuffer = new Float32Array(480);
      
      await expect(engine.processWithWorklet(inputBuffer)).rejects.toThrow('AudioWorkletEngine not initialized');
    });

    it('should handle real-time stream processing', async () => {
      const engine = new AudioWorkletEngine();
      await engine.initialize();
      
      // Mock MediaStream
      const mockStream = {
        getTracks: vi.fn(() => [{ kind: 'audio' }])
      };
      
      const processor = await engine.createStreamProcessor(mockStream as any);
      expect(processor).toBeDefined();
      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
    });

    it('should send messages to worklet processor', async () => {
      const engine = new AudioWorkletEngine();
      await engine.initialize();
      const workletNode = engine.createWorkletNode();
      
      engine.sendToWorklet({ type: 'updateSettings', data: { noiseLevel: 0.5 } });
      expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
        type: 'updateSettings',
        data: { noiseLevel: 0.5 }
      });
    });
  });
});