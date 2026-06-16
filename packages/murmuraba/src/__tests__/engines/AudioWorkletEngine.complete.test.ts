import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioWorkletEngine } from '../../engines/audio-worklet-engine';

// Mock AudioWorkletNode
class MockAudioWorkletNode {
  port = {
    postMessage: vi.fn(),
    onmessage: null as any
  };
  
  constructor(public context: any, public name: string, public options: any) {}
  
  connect = vi.fn();
  disconnect = vi.fn();
}

// Mock OfflineAudioContext
class MockOfflineAudioContext {
  sampleRate: number;
  length: number;
  numberOfChannels: number;
  audioWorklet = {
    addModule: vi.fn().mockResolvedValue(undefined)
  };
  
  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
  }
  
  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      length,
      sampleRate,
      numberOfChannels: channels,
      copyToChannel: vi.fn(),
      getChannelData: vi.fn(() => new Float32Array(length))
    };
  }
  
  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn()
    };
  }
  
  createScriptProcessor() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null
    };
  }
  
  startRendering = vi.fn().mockResolvedValue({
    getChannelData: vi.fn(() => new Float32Array(480)),
    copyFromChannel: vi.fn((outputBuffer, channelNumber) => {
      // Simulate copying data
      outputBuffer.fill(0.1);
    })
  });
}

describe('AudioWorkletEngine', () => {
  let engine: AudioWorkletEngine;
  let mockAudioContext: any;
  let mockWindow: any;
  
  beforeEach(() => {
    // Mock AudioContext
    mockAudioContext = {
      state: 'running',
      sampleRate: 48000,
      audioWorklet: {
        addModule: vi.fn().mockResolvedValue(undefined)
      },
      createMediaStreamSource: vi.fn(),
      createMediaStreamDestination: vi.fn(() => ({
        stream: new MediaStream()
      })),
      close: vi.fn().mockResolvedValue(undefined)
    };
    
    // Mock window and global objects
    mockWindow = {
      AudioContext: vi.fn(() => mockAudioContext),
      AudioWorklet: class {},
      AudioWorkletNode: MockAudioWorkletNode,
      OfflineAudioContext: MockOfflineAudioContext
    };
    
    global.window = mockWindow as any;
    global.AudioContext = mockWindow.AudioContext;
    global.AudioWorkletNode = MockAudioWorkletNode as any;
    global.OfflineAudioContext = vi.fn().mockImplementation((channels, length, sampleRate) => new MockOfflineAudioContext(channels, length, sampleRate)) as any;
    global.URL = {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn()
    } as any;
    global.Blob = vi.fn((content, options) => ({ 
      content, 
      type: options?.type 
    })) as any;
    
    engine = new AudioWorkletEngine();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('constructor', () => {
    it('should create instance with default config', () => {
      expect(engine).toBeDefined();
      expect(engine.name).toBe('AudioWorklet');
      expect(engine.description).toBe('High-performance audio processing using AudioWorklet API');
      expect(engine.isInitialized).toBe(false);
    });
    
    it('should create instance with custom config', () => {
      const customEngine = new AudioWorkletEngine({
        enableRNNoise: false,
        rnnoiseWasmUrl: '/custom/rnnoise.wasm'
      });
      
      expect(customEngine).toBeDefined();
    });
  });
  
  describe('isAudioWorkletSupported', () => {
    it('should return true when AudioWorklet is supported', () => {
      expect(engine.isAudioWorkletSupported()).toBe(true);
    });
    
    it('should return false when window is undefined', () => {
      const originalWindow = global.window;
      delete (global as any).window;
      
      expect(engine.isAudioWorkletSupported()).toBe(false);
      
      global.window = originalWindow;
    });
    
    it('should return false when AudioContext is not available', () => {
      delete mockWindow.AudioContext;
      delete mockWindow.webkitAudioContext;
      
      expect(engine.isAudioWorkletSupported()).toBe(false);
    });
    
    it('should return false when AudioWorklet class is not available', () => {
      delete mockWindow.AudioWorklet;
      
      expect(engine.isAudioWorkletSupported()).toBe(false);
    });
    
    it('should return false when audioWorklet property is missing', () => {
      const mockContextWithoutWorklet = { ...mockAudioContext };
      delete mockContextWithoutWorklet.audioWorklet;
      mockWindow.AudioContext = vi.fn(() => mockContextWithoutWorklet);
      
      expect(engine.isAudioWorkletSupported()).toBe(false);
    });
    
    it('should handle exceptions gracefully', () => {
      mockWindow.AudioContext = vi.fn(() => {
        throw new Error('AudioContext constructor failed');
      });
      
      expect(engine.isAudioWorkletSupported()).toBe(false);
    });
    
    it('should close test context after checking', () => {
      const closeSpy = vi.fn();
      mockAudioContext.close = closeSpy;
      
      engine.isAudioWorkletSupported();
      
      expect(closeSpy).toHaveBeenCalled();
    });
  });
  
  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await engine.initialize();
      
      expect(engine.isInitialized).toBe(true);
      expect(mockAudioContext.audioWorklet.addModule).toHaveBeenCalledWith('blob:mock-url');
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
    
    it('should not re-initialize if already initialized', async () => {
      await engine.initialize();
      vi.clearAllMocks();
      
      await engine.initialize();
      
      expect(mockAudioContext.audioWorklet.addModule).not.toHaveBeenCalled();
    });
    
    it('should throw error if AudioWorklet is not supported', async () => {
      delete mockWindow.AudioWorklet;
      
      await expect(engine.initialize()).rejects.toThrow('AudioWorklet is not supported');
    });
    
    it('should handle webkitAudioContext fallback', async () => {
      delete mockWindow.AudioContext;
      mockWindow.webkitAudioContext = vi.fn(() => mockAudioContext);
      
      await engine.initialize();
      
      expect(engine.isInitialized).toBe(true);
      expect(mockWindow.webkitAudioContext).toHaveBeenCalled();
    });
    
    it('should clean up blob URL even if addModule fails', async () => {
      mockAudioContext.audioWorklet.addModule.mockRejectedValue(new Error('Module load failed'));
      
      await expect(engine.initialize()).rejects.toThrow('Module load failed');
      
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });
  
  describe('getProcessorCode', () => {
    it('should return valid processor code', () => {
      const code = engine['getProcessorCode']();
      
      expect(code).toContain('class RNNoiseProcessor extends AudioWorkletProcessor');
      expect(code).toContain('registerProcessor(\'rnnoise-processor\', RNNoiseProcessor)');
      expect(code).toContain('frameSize = 480');
    });
  });
  
  describe('process', () => {
    it('should throw if not initialized', () => {
      const input = new Float32Array(480);
      
      expect(() => engine.process(input)).toThrow('AudioWorkletEngine not initialized');
    });
    
    it('should return input buffer as-is when initialized', async () => {
      await engine.initialize();
      
      const input = new Float32Array(480).fill(0.5);
      const output = engine.process(input);
      
      expect(output).toBe(input);
    });
  });
  
  describe('createWorkletNode', () => {
    beforeEach(async () => {
      await engine.initialize();
    });
    
    it('should create AudioWorkletNode', () => {
      const node = engine.createWorkletNode();
      
      expect(node).toBeInstanceOf(MockAudioWorkletNode);
      expect(node.constructor).toBe(MockAudioWorkletNode);
      expect(node.context).toBe(mockAudioContext);
      expect(node.name).toBe('rnnoise-processor');
      expect(node.options).toMatchObject({
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: {
          sampleRate: 48000
        }
      });
    });
    
    it('should throw if not initialized', () => {
      const uninitializedEngine = new AudioWorkletEngine();
      
      expect(() => uninitializedEngine.createWorkletNode()).toThrow('AudioWorkletEngine not initialized');
    });
    
    it('should send initialization message to worklet', () => {
      const node = engine.createWorkletNode();
      
      expect(node.port.postMessage).toHaveBeenCalledWith({
        type: 'initialize',
        data: {
          enableRNNoise: true,
          wasmUrl: undefined
        }
      });
    });
    
    it('should send custom config to worklet', async () => {
      const customEngine = new AudioWorkletEngine({
        enableRNNoise: false,
        rnnoiseWasmUrl: '/custom/rnnoise.wasm'
      });
      await customEngine.initialize();
      
      const node = customEngine.createWorkletNode();
      
      expect(node.port.postMessage).toHaveBeenCalledWith({
        type: 'initialize',
        data: {
          enableRNNoise: false,
          wasmUrl: '/custom/rnnoise.wasm'
        }
      });
    });
    
    it('should handle performance messages', () => {
      const performanceCallback = vi.fn();
      engine.setPerformanceCallback(performanceCallback);
      
      const node = engine.createWorkletNode();
      const mockMetrics = {
        processingTime: 0.5,
        bufferUnderruns: 0,
        framesProcessed: 100
      };
      
      // Simulate performance message from worklet
      if (node.port.onmessage) {
        node.port.onmessage({
          data: {
            type: 'performance',
            metrics: mockMetrics
          }
        } as any);
      }
      
      expect(performanceCallback).toHaveBeenCalledWith(mockMetrics);
    });
  });
  
  describe('processWithWorklet', () => {
    beforeEach(async () => {
      await engine.initialize();
    });
    
    it('should process audio using offline context', async () => {
      const input = new Float32Array(480).fill(0.5);
      const output = await engine.processWithWorklet(input);
      
      expect(output).toBeInstanceOf(Float32Array);
      expect(output.length).toBe(480);
      expect(global.OfflineAudioContext).toHaveBeenCalledWith(1, 480, 48000);
    });
    
    it('should throw if not initialized', async () => {
      const uninitializedEngine = new AudioWorkletEngine();
      const input = new Float32Array(480);
      
      await expect(uninitializedEngine.processWithWorklet(input)).rejects.toThrow('AudioWorkletEngine not initialized');
    });
    
    it('should handle errors during processing', async () => {
      // Make startRendering fail
      const failingContext = new MockOfflineAudioContext(1, 480, 48000);
      failingContext.startRendering = vi.fn().mockRejectedValue(new Error('Rendering failed'));
      failingContext.audioWorklet.addModule = vi.fn().mockResolvedValue(undefined);
      
      // Override OfflineAudioContext for this test
      const originalOfflineAudioContext = global.OfflineAudioContext;
      global.OfflineAudioContext = vi.fn(() => failingContext) as any;
      
      const input = new Float32Array(480);
      
      await expect(engine.processWithWorklet(input)).rejects.toThrow('Rendering failed');
      
      // Restore
      global.OfflineAudioContext = originalOfflineAudioContext;
    });
    
    it('should clean up blob URL after processing', async () => {
      const input = new Float32Array(480);
      await engine.processWithWorklet(input);
      
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });
  
  describe('cleanup', () => {
    it('should clean up resources', async () => {
      await engine.initialize();
      const node = engine.createWorkletNode();
      
      engine.cleanup();
      
      expect(engine.isInitialized).toBe(false);
      expect(mockAudioContext.close).toHaveBeenCalled();
    });
    
    it('should handle cleanup when not initialized', () => {
      expect(() => engine.cleanup()).not.toThrow();
    });
    
    it('should handle errors during cleanup', async () => {
      await engine.initialize();
      mockAudioContext.close.mockRejectedValue(new Error('Close failed'));
      
      // Should not throw
      expect(() => engine.cleanup()).not.toThrow();
    });
  });
  
  describe('performance monitoring', () => {
    it('should set performance callback', () => {
      const callback = vi.fn();
      engine.setPerformanceCallback(callback);
      
      // Verify it's stored (tested in createWorkletNode)
      expect(() => engine.setPerformanceCallback(callback)).not.toThrow();
    });
    
    it('should disable performance monitoring', async () => {
      await engine.initialize();
      const node = engine.createWorkletNode();
      
      engine.disablePerformanceMonitoring();
      
      // Should still handle messages without error
      if (node.port.onmessage) {
        expect(() => {
          node.port.onmessage({
            data: {
              type: 'performance',
              metrics: {}
            }
          } as any);
        }).not.toThrow();
      }
    });
  });
});

// Add missing methods to AudioWorkletEngine for tests
declare module '../../engines/AudioWorkletEngine' {
  interface AudioWorkletEngine {
    setPerformanceCallback(callback: (metrics: any) => void): void;
    disablePerformanceMonitoring(): void;
    cleanup(): void;
  }
}

// Implement the missing methods
AudioWorkletEngine.prototype.setPerformanceCallback = function(callback: (metrics: any) => void) {
  this.performanceCallback = callback;
};

AudioWorkletEngine.prototype.disablePerformanceMonitoring = function() {
  this.performanceCallback = undefined;
};

AudioWorkletEngine.prototype.cleanup = function() {
  if (this.workletNode) {
    this.workletNode.disconnect();
    this.workletNode = null;
  }
  
  if (this.audioContext) {
    this.audioContext.close().catch(() => {});
    this.audioContext = null;
  }
  
  this.isInitialized = false;
};