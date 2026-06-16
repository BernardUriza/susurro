import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MurmurabaProcessor } from '../../utils/murmuraba-processor';
import { AudioEngine } from '../../engines/types';

describe('MurmurabaProcessor - Critical Audio Processing', () => {
  let processor: MurmurabaProcessor;
  let mockEngine: AudioEngine;
  let mockAudioContext: any;
  let mockScriptProcessor: any;
  let mockMediaStream: MediaStream;
  let mockSource: any;
  let mockDestination: any;

  beforeEach(() => {
    // Mock AudioEngine
    mockEngine = {
      isInitialized: true,
      initialize: vi.fn().mockResolvedValue(undefined),
      process: vi.fn((frame: Float32Array) => {
        // Simple processing: reduce amplitude by half
        const output = new Float32Array(frame.length);
        for (let i = 0; i < frame.length; i++) {
          output[i] = frame[i] * 0.5;
        }
        return output;
      }),
      cleanup: vi.fn()
    };

    // Mock ScriptProcessorNode
    mockScriptProcessor = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null,
      bufferSize: 4096,
      numberOfInputs: 1,
      numberOfOutputs: 1
    };

    // Mock MediaStreamAudioDestinationNode
    mockDestination = {
      stream: new MediaStream(),
      connect: vi.fn(),
      disconnect: vi.fn()
    };

    // Mock MediaStreamAudioSourceNode
    mockSource = {
      connect: vi.fn(),
      disconnect: vi.fn()
    };

    // Mock AudioContext
    mockAudioContext = {
      state: 'running',
      sampleRate: 48000,
      createScriptProcessor: vi.fn(() => mockScriptProcessor),
      createMediaStreamSource: vi.fn(() => mockSource),
      createMediaStreamDestination: vi.fn(() => mockDestination),
      close: vi.fn().mockResolvedValue(undefined)
    };

    // Mock global AudioContext
    global.AudioContext = vi.fn(() => mockAudioContext) as any;

    // Mock MediaStream
    mockMediaStream = new MediaStream();

    processor = new MurmurabaProcessor();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default frame size', () => {
      expect(processor).toBeDefined();
      expect((processor as any).frameSize).toBe(480);
    });

    it('should initialize with custom frame size', () => {
      const customProcessor = new MurmurabaProcessor(256);
      expect((customProcessor as any).frameSize).toBe(256);
    });

    it('should initialize audio context and processor', async () => {
      await processor.initialize(mockEngine);

      expect(global.AudioContext).toHaveBeenCalledWith({ sampleRate: 48000 });
      expect(mockAudioContext.createScriptProcessor).toHaveBeenCalledWith(4096, 1, 1);
      expect(mockScriptProcessor.onaudioprocess).toBeDefined();
    });

    it('should initialize engine if not already initialized', async () => {
      mockEngine.isInitialized = false;
      
      await processor.initialize(mockEngine);

      expect(mockEngine.initialize).toHaveBeenCalled();
    });

    it('should use custom sample rate', async () => {
      await processor.initialize(mockEngine, 44100);

      expect(global.AudioContext).toHaveBeenCalledWith({ sampleRate: 44100 });
    });
  });

  describe('Audio Processing', () => {
    beforeEach(async () => {
      await processor.initialize(mockEngine);
    });

    it('should process audio frames correctly', () => {
      const inputData = new Float32Array(4096).fill(0.5);
      const outputData = new Float32Array(4096);
      
      const event = {
        inputBuffer: {
          getChannelData: vi.fn(() => inputData)
        },
        outputBuffer: {
          getChannelData: vi.fn(() => outputData)
        }
      } as any;

      mockScriptProcessor.onaudioprocess(event);

      // Should process multiple frames
      const expectedFrames = Math.floor(4096 / 480);
      expect(mockEngine.process).toHaveBeenCalledTimes(expectedFrames);
    });

    it('should accumulate input buffer correctly', () => {
      const inputData = new Float32Array(100).fill(0.5);
      const outputData = new Float32Array(100);
      
      const event = {
        inputBuffer: {
          getChannelData: vi.fn(() => inputData)
        },
        outputBuffer: {
          getChannelData: vi.fn(() => outputData)
        }
      } as any;

      // Process multiple times to accumulate
      for (let i = 0; i < 5; i++) {
        mockScriptProcessor.onaudioprocess(event);
      }

      // Should have processed one frame after 5 * 100 = 500 samples
      expect(mockEngine.process).toHaveBeenCalledTimes(1);
    });

    it('should handle silence detection', () => {
      // Mock engine to return silence
      mockEngine.process = vi.fn(() => new Float32Array(480).fill(0));
      
      const inputData = new Float32Array(480).fill(0.5);
      const outputData = new Float32Array(480);
      
      const event = {
        inputBuffer: {
          getChannelData: vi.fn(() => inputData)
        },
        outputBuffer: {
          getChannelData: vi.fn(() => outputData)
        }
      } as any;

      mockScriptProcessor.onaudioprocess(event);

      const metrics = processor.getMetrics();
      expect(metrics.silenceFrames).toBe(1);
      expect(metrics.activeFrames).toBe(0);
    });

    it('should calculate peak values correctly', () => {
      const inputData = new Float32Array([0.1, -0.8, 0.5, -0.3]);
      const outputData = new Float32Array(4);
      
      const event = {
        inputBuffer: {
          getChannelData: vi.fn(() => inputData)
        },
        outputBuffer: {
          getChannelData: vi.fn(() => outputData)
        }
      } as any;

      mockScriptProcessor.onaudioprocess(event);

      const metrics = processor.getMetrics();
      expect(metrics.peakInput).toBeCloseTo(0.8);
    });

    it('should handle empty input gracefully', () => {
      const inputData = new Float32Array(0);
      const outputData = new Float32Array(100);
      
      const event = {
        inputBuffer: {
          getChannelData: vi.fn(() => inputData)
        },
        outputBuffer: {
          getChannelData: vi.fn(() => outputData)
        }
      } as any;

      expect(() => mockScriptProcessor.onaudioprocess(event)).not.toThrow();
    });
  });

  describe('Stream Connection', () => {
    it('should connect stream successfully', async () => {
      await processor.initialize(mockEngine);
      
      const destination = processor.connectStream(mockMediaStream);

      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockMediaStream);
      expect(mockSource.connect).toHaveBeenCalledWith(mockScriptProcessor);
      expect(mockScriptProcessor.connect).toHaveBeenCalledWith(mockDestination);
      expect(destination).toBe(mockDestination);
    });

    it('should throw if not initialized', () => {
      expect(() => processor.connectStream(mockMediaStream)).toThrow('Processor not initialized');
    });

    it('should handle multiple stream connections', async () => {
      await processor.initialize(mockEngine);
      
      const stream1 = new MediaStream();
      const stream2 = new MediaStream();
      
      processor.connectStream(stream1);
      processor.connectStream(stream2);

      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledTimes(2);
    });
  });

  describe('Metrics Management', () => {
    beforeEach(async () => {
      await processor.initialize(mockEngine);
    });

    it('should track input and output samples', () => {
      const inputData = new Float32Array(1000).fill(0.5);
      const outputData = new Float32Array(1000);
      
      const event = {
        inputBuffer: {
          getChannelData: vi.fn(() => inputData)
        },
        outputBuffer: {
          getChannelData: vi.fn(() => outputData)
        }
      } as any;

      mockScriptProcessor.onaudioprocess(event);

      const metrics = processor.getMetrics();
      expect(metrics.inputSamples).toBe(1000);
      expect(metrics.outputSamples).toBe(960); // 2 frames of 480
    });

    it('should calculate RMS energy correctly', () => {
      // Create a sine wave
      const inputData = new Float32Array(480);
      for (let i = 0; i < 480; i++) {
        inputData[i] = Math.sin(2 * Math.PI * i / 48); // 1kHz at 48kHz
      }
      const outputData = new Float32Array(480);
      
      const event = {
        inputBuffer: {
          getChannelData: vi.fn(() => inputData)
        },
        outputBuffer: {
          getChannelData: vi.fn(() => outputData)
        }
      } as any;

      mockScriptProcessor.onaudioprocess(event);

      const metrics = processor.getMetrics();
      expect(metrics.totalInputEnergy).toBeGreaterThan(0);
      expect(metrics.totalOutputEnergy).toBeGreaterThan(0);
    });

    it('should reset metrics correctly', () => {
      // Process some audio first
      const event = {
        inputBuffer: {
          getChannelData: vi.fn(() => new Float32Array(1000).fill(0.5))
        },
        outputBuffer: {
          getChannelData: vi.fn(() => new Float32Array(1000))
        }
      } as any;

      mockScriptProcessor.onaudioprocess(event);
      
      processor.resetMetrics();
      
      const metrics = processor.getMetrics();
      expect(metrics.inputSamples).toBe(0);
      expect(metrics.outputSamples).toBe(0);
      expect(metrics.silenceFrames).toBe(0);
      expect(metrics.activeFrames).toBe(0);
      expect(metrics.totalFrames).toBe(0);
      expect(metrics.peakInput).toBe(0);
      expect(metrics.peakOutput).toBe(0);
    });

    it('should track frame counts correctly', () => {
      const inputData = new Float32Array(2400); // 5 frames
      inputData.fill(0.5);
      const outputData = new Float32Array(2400);
      
      const event = {
        inputBuffer: {
          getChannelData: vi.fn(() => inputData)
        },
        outputBuffer: {
          getChannelData: vi.fn(() => outputData)
        }
      } as any;

      mockScriptProcessor.onaudioprocess(event);

      const metrics = processor.getMetrics();
      expect(metrics.totalFrames).toBe(5);
    });

    it('should return metrics copy not reference', () => {
      const metrics1 = processor.getMetrics();
      const metrics2 = processor.getMetrics();
      
      expect(metrics1).not.toBe(metrics2);
      expect(metrics1).toEqual(metrics2);
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup all resources', async () => {
      await processor.initialize(mockEngine);
      
      processor.cleanup();

      expect(mockScriptProcessor.disconnect).toHaveBeenCalled();
      expect(mockAudioContext.close).toHaveBeenCalled();
      expect(mockEngine.cleanup).toHaveBeenCalled();
    });

    it('should handle cleanup when not initialized', () => {
      expect(() => processor.cleanup()).not.toThrow();
    });

    it('should handle cleanup with closed audio context', async () => {
      await processor.initialize(mockEngine);
      mockAudioContext.state = 'closed';
      
      processor.cleanup();

      expect(mockAudioContext.close).not.toHaveBeenCalled();
    });

    it('should clear internal references after cleanup', async () => {
      await processor.initialize(mockEngine);
      
      processor.cleanup();

      expect((processor as any).processor).toBeNull();
      expect((processor as any).audioContext).toBeNull();
      expect((processor as any).engine).toBeNull();
    });

    it('should handle multiple cleanup calls', async () => {
      await processor.initialize(mockEngine);
      
      processor.cleanup();
      expect(() => processor.cleanup()).not.toThrow();
      
      expect(mockScriptProcessor.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases and Buffer Management', () => {
    beforeEach(async () => {
      await processor.initialize(mockEngine);
    });

    it('should handle buffer underrun gracefully', () => {
      const inputData = new Float32Array(100); // Less than frame size
      const outputData = new Float32Array(1000); // Large output request
      
      const event = {
        inputBuffer: {
          getChannelData: vi.fn(() => inputData)
        },
        outputBuffer: {
          getChannelData: vi.fn(() => outputData)
        }
      } as any;

      mockScriptProcessor.onaudioprocess(event);

      // Should fill remaining with zeros
      expect(outputData[500]).toBe(0);
    });

    it('should maintain buffer continuity across process calls', () => {
      // Send 250 samples (less than frame size)
      const event1 = {
        inputBuffer: {
          getChannelData: vi.fn(() => new Float32Array(250).fill(1))
        },
        outputBuffer: {
          getChannelData: vi.fn(() => new Float32Array(250))
        }
      } as any;

      mockScriptProcessor.onaudioprocess(event1);
      expect(mockEngine.process).not.toHaveBeenCalled();

      // Send another 250 samples to complete a frame
      const event2 = {
        inputBuffer: {
          getChannelData: vi.fn(() => new Float32Array(250).fill(1))
        },
        outputBuffer: {
          getChannelData: vi.fn(() => new Float32Array(250))
        }
      } as any;

      mockScriptProcessor.onaudioprocess(event2);
      expect(mockEngine.process).toHaveBeenCalledTimes(1);
    });
  });
});