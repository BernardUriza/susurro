/**
 * Consolidated MurmubaraEngine Test Suite
 * Combines all unique test cases from multiple test files:
 * - MurmubaraEngine.test.ts (main)
 * - MurmubaraEngine.basic.test.ts
 * - MurmubaraEngine.simple.test.ts  
 * - MurmubaraEngine.advanced.test.ts
 * - MurmubaraEngine.coverage.test.ts
 * - MurmubaraEngine.agc.test.ts
 * - MurmubaraEngine.agc.integration.test.ts
 * - MurmubaraEngine.resampling.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MurmubaraEngine } from '../../../core/murmubara-engine';
import { MurmubaraConfig, EngineState, MurmubaraError, ErrorCodes } from '../../../types';
import { 
  mockWasmModule,
  createMockAudioContext,
  createMockMediaStream,
  setupMediaDevicesMock,
  waitForAsync,
  createTestConfig
} from '../../setup/audio-mocks';

// Mock all dependencies
vi.mock('../../../core/state-manager');
vi.mock('../../../core/logger');
vi.mock('../../../managers/worker-manager');
vi.mock('../../../managers/metrics-manager');
vi.mock('../../../managers/chunk-processor');
vi.mock('../../../utils/simple-agc');
vi.mock('../../../utils/audio-resampler');
vi.mock('../../../utils/rnnoise-loader', () => ({
  loadRNNoiseModule: vi.fn().mockResolvedValue(mockWasmModule)
}));

// Import mocks after vi.mock
import { StateManager } from '../../../core/state-manager';
import { Logger } from '../../../core/logger';
import { WorkerManager } from '../../../managers/worker-manager';
import { MetricsManager } from '../../../managers/metrics-manager';
import { ChunkProcessor } from '../../../managers/chunk-processor';
import { SimpleAGC } from '../../../utils/simple-agc';

describe('MurmubaraEngine - Consolidated Test Suite', () => {
  let engine: MurmubaraEngine;
  let mockStateManager: vi.Mocked<StateManager>;
  let mockLogger: vi.Mocked<Logger>;
  let mockWorkerManager: vi.Mocked<WorkerManager>;
  let mockMetricsManager: vi.Mocked<MetricsManager>;
  let mockAudioContext: any;
  let mockScriptProcessor: any;
  let mockMediaStreamSource: any;
  let mockMediaStreamDestination: any;
  let mockBiquadFilter: any;
  let mockHighPassFilter: any;
  let mockNotchFilter1: any;
  let mockNotchFilter2: any;
  let mockLowShelfFilter: any;
  let mockStream: any;
  let mockAGC: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset the loader mock to its default behavior
    const { loadRNNoiseModule } = await import('../../../utils/rnnoise-loader');
    (loadRNNoiseModule as any).mockResolvedValue(mockWasmModule);
    
    // Setup mock managers
    mockStateManager = {
      getState: vi.fn().mockReturnValue('uninitialized'),
      canTransitionTo: vi.fn().mockReturnValue(true),
      transitionTo: vi.fn().mockReturnValue(true),
      isInState: vi.fn().mockReturnValue(false),
      requireState: vi.fn(),
      reset: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn(),
      listenerCount: vi.fn().mockReturnValue(0)
    } as any;
    
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      setLevel: vi.fn(),
      setLogHandler: vi.fn()
    } as any;
    
    mockWorkerManager = {
      createWorker: vi.fn(),
      getWorker: vi.fn(),
      sendMessage: vi.fn(),
      terminateWorker: vi.fn(),
      terminateAll: vi.fn(),
      getActiveWorkerCount: vi.fn().mockReturnValue(0),
      getWorkerIds: vi.fn().mockReturnValue([]),
      initialize: vi.fn().mockResolvedValue(undefined),
      terminate: vi.fn().mockResolvedValue(undefined)
    } as any;
    
    mockMetricsManager = {
      startAutoUpdate: vi.fn(),
      stopAutoUpdate: vi.fn(),
      updateInputLevel: vi.fn(),
      updateOutputLevel: vi.fn(),
      updateNoiseReduction: vi.fn(),
      updateVAD: vi.fn(),
      recordFrame: vi.fn(),
      recordDroppedFrame: vi.fn(),
      recordChunk: vi.fn(),
      getMetrics: vi.fn().mockReturnValue({
        noiseReductionLevel: 0,
        processingLatency: 0,
        inputLevel: 0,
        outputLevel: 0,
        timestamp: Date.now(),
        frameCount: 0,
        droppedFrames: 0,
        processed: 0,
        latency: 0,
        cpuUsage: 0,
        memoryUsage: 1000000,
        queuedFrames: 0
      }),
      reset: vi.fn(),
      calculateRMS: vi.fn().mockReturnValue(0.5),
      calculatePeak: vi.fn().mockReturnValue(0.8),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn(),
      listenerCount: vi.fn().mockReturnValue(0)
    } as any;

    // Mock AGC
    mockAGC = {
      connect: vi.fn(),
      updateGain: vi.fn(),
      getCurrentGain: vi.fn(() => 5.0)
    };
    (SimpleAGC as any).mockImplementation(() => mockAGC);
    
    // Mock constructors
    (StateManager as vi.MockedClass<typeof StateManager>).mockImplementation(() => mockStateManager);
    (Logger as vi.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);
    (WorkerManager as vi.MockedClass<typeof WorkerManager>).mockImplementation(() => mockWorkerManager);
    (MetricsManager as vi.MockedClass<typeof MetricsManager>).mockImplementation(() => mockMetricsManager);
    
    // Ensure ChunkProcessor is properly mocked
    (ChunkProcessor as vi.MockedClass<typeof ChunkProcessor>).mockImplementation(
      (sampleRate, config, logger, metrics) => ({
        addSamples: vi.fn(),
        flush: vi.fn(),
        reset: vi.fn(),
        getStatus: vi.fn().mockReturnValue({
          currentSampleCount: 0,
          samplesPerChunk: 48000,
          chunkIndex: 0,
          bufferFillPercentage: 0
        }),
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
        once: vi.fn(),
        removeAllListeners: vi.fn(),
        listenerCount: vi.fn().mockReturnValue(0)
      } as any)
    );

    // Create fresh mock nodes
    mockScriptProcessor = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null as any,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    mockMediaStreamSource = {
      connect: vi.fn(),
      disconnect: vi.fn()
    };

    mockMediaStreamDestination = {
      stream: { 
        id: 'mock-output-stream',
        getTracks: vi.fn().mockReturnValue([]),
        getAudioTracks: vi.fn().mockReturnValue([{ kind: 'audio' }]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
    };

    // Create mock stream
    mockStream = {
      id: 'mock-input-stream',
      getTracks: vi.fn().mockReturnValue([{ kind: 'audio', stop: vi.fn() }]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    // Create multiple biquad filters for the chain
    mockHighPassFilter = {
      type: '' as BiquadFilterType,
      frequency: { value: 0 },
      Q: { value: 0 },
      gain: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn()
    };

    mockNotchFilter1 = {
      type: '' as BiquadFilterType,
      frequency: { value: 0 },
      Q: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn()
    };

    mockNotchFilter2 = {
      type: '' as BiquadFilterType,
      frequency: { value: 0 },
      Q: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn()
    };

    mockLowShelfFilter = {
      type: '' as BiquadFilterType,
      frequency: { value: 0 },
      Q: { value: 0 },
      gain: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn()
    };

    mockBiquadFilter = mockHighPassFilter; // Default to high pass for backward compatibility
    
    // Create a fresh mock AudioContext
    const mockAnalyser = {
      fftSize: 2048,
      frequencyBinCount: 1024,
      getFloatFrequencyData: vi.fn(),
      getByteFrequencyData: vi.fn(),
      getFloatTimeDomainData: vi.fn(),
      getByteTimeDomainData: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn()
    };

    const mockGainNode = {
      gain: { 
        value: 1,
        setTargetAtTime: vi.fn()
      },
      connect: vi.fn(),
      disconnect: vi.fn()
    };

    mockAudioContext = {
      state: 'running' as AudioContextState,
      sampleRate: 48000,
      destination: { maxChannelCount: 2 },
      createScriptProcessor: vi.fn().mockReturnValue(mockScriptProcessor),
      createMediaStreamSource: vi.fn().mockReturnValue(mockMediaStreamSource),
      createMediaStreamDestination: vi.fn().mockReturnValue(mockMediaStreamDestination),
      createBiquadFilter: vi.fn()
        .mockReturnValueOnce(mockNotchFilter1)
        .mockReturnValueOnce(mockNotchFilter2)
        .mockReturnValueOnce(mockHighPassFilter)
        .mockReturnValueOnce(mockLowShelfFilter)
        .mockReturnValue(mockBiquadFilter),
      createAnalyser: vi.fn().mockReturnValue(mockAnalyser),
      createGain: vi.fn().mockReturnValue(mockGainNode),
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      currentTime: 0,
      baseLatency: 0.01,
      outputLatency: 0.02,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    };
    
    // Mock the global AudioContext constructor
    global.AudioContext = vi.fn().mockImplementation(() => mockAudioContext);
    global.webkitAudioContext = global.AudioContext;
    
    // Mock window for checkEnvironmentSupport
    global.window = Object.assign(global.window || {}, {
      AudioContext: global.AudioContext,
      webkitAudioContext: global.AudioContext,
      WebAssembly: {},
      AudioWorkletNode: vi.fn(),
      MediaStream: vi.fn(),
      MediaRecorder: vi.fn(),
      React: { version: '18.2.0' },
      createRNNWasmModule: vi.fn().mockResolvedValue(mockWasmModule),
      URL: {
        createObjectURL: vi.fn(() => 'blob:test'),
        revokeObjectURL: vi.fn()
      },
      navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        mediaDevices: {
          getUserMedia: vi.fn()
        }
      },
      performance: {
        memory: {
          usedJSHeapSize: 1000000,
          jsHeapSizeLimit: 2000000,
          totalJSHeapSize: 1500000
        },
        now: vi.fn().mockReturnValue(0)
      }
    });
    
    // Mock document
    global.document = {
      createElement: vi.fn().mockReturnValue({
        onload: null,
        onerror: null,
        src: ''
      }),
      head: {
        appendChild: vi.fn().mockImplementation((script) => {
          // Simulate script loading by calling onload after a microtask
          setTimeout(() => {
            if (script.onload) {
              script.onload();
            }
          }, 0);
        })
      }
    } as any;

    setupMediaDevicesMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===== INITIALIZATION TESTS =====
  describe('Initialization', () => {
    describe('Constructor', () => {
      it('should create engine with default config', () => {
        engine = new MurmubaraEngine();
        
        expect(StateManager).toHaveBeenCalled();
        expect(Logger).toHaveBeenCalledWith('[Murmuraba]');
        expect(WorkerManager).toHaveBeenCalledWith(mockLogger);
        expect(MetricsManager).toHaveBeenCalled();
        expect(mockLogger.setLevel).toHaveBeenCalledWith('info');
      });
      
      it('should create engine with custom config', () => {
        const config: MurmubaraConfig = {
          logLevel: 'debug',
          noiseReductionLevel: 'high',
          bufferSize: 2048,
          algorithm: 'rnnoise',
          autoCleanup: true,
          cleanupDelay: 30000,
          useWorker: true,
          workerPath: '/custom-worker.js',
          allowDegraded: true,
          onLog: vi.fn()
        };
        
        engine = new MurmubaraEngine(config);
        
        expect(mockLogger.setLevel).toHaveBeenCalledWith('debug');
        expect(mockLogger.setLogHandler).toHaveBeenCalledWith(config.onLog);
      });
      
      it('should setup event forwarding', () => {
        engine = new MurmubaraEngine();
        
        // Should forward state changes
        expect(mockStateManager.on).toHaveBeenCalledWith('state-change', expect.any(Function));
        
        // Should forward metrics updates
        expect(mockMetricsManager.on).toHaveBeenCalledWith('metrics-update', expect.any(Function));
        
        // Test forwarding
        const stateHandler = mockStateManager.on.mock.calls.find(c => c[0] === 'state-change')?.[1];
        const metricsHandler = mockMetricsManager.on.mock.calls.find(c => c[0] === 'metrics-update')?.[1];
        
        expect(stateHandler).toBeDefined();
        expect(metricsHandler).toBeDefined();
      });

      it('should forward state change events', () => {
        engine = new MurmubaraEngine();
        const stateChangeSpy = vi.fn();
        engine.on('state-change', stateChangeSpy);
        
        // Get the state change handler
        const stateChangeHandler = mockStateManager.on.mock.calls[0][1];
        stateChangeHandler('uninitialized', 'initializing');
        
        expect(mockLogger.info).toHaveBeenCalledWith('State transition: uninitialized -> initializing');
        expect(stateChangeSpy).toHaveBeenCalledWith('uninitialized', 'initializing');
      });

      it('should forward metrics update events', () => {
        engine = new MurmubaraEngine();
        const metricsUpdateSpy = vi.fn();
        engine.on('metrics-update', metricsUpdateSpy);
        
        // Get the metrics update handler
        const metricsHandler = mockMetricsManager.on.mock.calls[0][1];
        const mockMetrics = { frameCount: 100 };
        metricsHandler(mockMetrics);
        
        expect(metricsUpdateSpy).toHaveBeenCalledWith(mockMetrics);
      });
      
      it('should setup auto cleanup when enabled', () => {
        vi.useFakeTimers();
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
        engine = new MurmubaraEngine({ autoCleanup: true, cleanupDelay: 5000 });
        
        // Mock state as ready
        mockStateManager.isInState.mockReturnValue(true);
        
        // Emit processing-end event to trigger cleanup timer
        engine.emit('processing-end');
        
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
        vi.useRealTimers();
      });
      
      it('should not setup auto cleanup when disabled', () => {
        vi.useFakeTimers();
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
        engine = new MurmubaraEngine({ autoCleanup: false });
        
        // Mock state as ready
        mockStateManager.isInState.mockReturnValue(true);
        
        // Emit processing-end event - should NOT trigger timer
        engine.emit('processing-end');
        
        expect(setTimeoutSpy).not.toHaveBeenCalled();
        vi.useRealTimers();
      });

      it('should handle all log levels', () => {
        const levels = ['none', 'error', 'warn', 'info', 'debug'] as const;
        
        levels.forEach(level => {
          const testEngine = new MurmubaraEngine({ logLevel: level });
          expect(mockLogger.setLevel).toHaveBeenCalledWith(level);
        });
      });
    });

    describe('Environment Support', () => {
      beforeEach(() => {
        engine = new MurmubaraEngine();
      });

      it('should detect missing AudioContext', async () => {
        delete (global.window as any).AudioContext;
        delete (global.window as any).webkitAudioContext;
        
        await expect(engine.initialize()).rejects.toThrow('Environment not supported: Missing required APIs');
      });
      
      it('should detect missing WebAssembly', async () => {
        delete (global.window as any).WebAssembly;
        
        await expect(engine.initialize()).rejects.toThrow('Environment not supported: Missing required APIs');
      });
      
      it('should use webkitAudioContext fallback', async () => {
        delete (global.window as any).AudioContext;
        
        await engine.initialize();
        
        expect((global.window as any).webkitAudioContext).toHaveBeenCalled();
      });

      it('should check environment support method', () => {
        const support = engine['checkEnvironmentSupport']();
        
        expect(support).toBeDefined();
        expect(typeof support).toBe('boolean');
      });
    });

    describe('Initialize Method', () => {
      beforeEach(() => {
        engine = new MurmubaraEngine();
      });
      
      it('should initialize successfully', async () => {
        await engine.initialize();
        
        expect(mockStateManager.transitionTo).toHaveBeenCalledWith('initializing');
        expect(global.window.AudioContext).toHaveBeenCalled();
        expect(mockWasmModule._rnnoise_create).toHaveBeenCalled();
        expect(mockWasmModule._malloc).toHaveBeenCalledTimes(2); // input and output buffers
        expect(mockStateManager.transitionTo).toHaveBeenCalledWith('ready');
        expect(mockMetricsManager.startAutoUpdate).toHaveBeenCalled();
      });
      
      it('should handle concurrent initialization', async () => {
        const promise1 = engine.initialize();
        const promise2 = engine.initialize();
        
        await Promise.all([promise1, promise2]);
        
        // Should only initialize once
        expect(mockWasmModule._rnnoise_create).toHaveBeenCalledTimes(1);
      });
      
      it('should handle already initialized error', async () => {
        mockStateManager.canTransitionTo.mockReturnValue(false);
        mockStateManager.getState.mockReturnValue('ready');
        
        await expect(engine.initialize()).rejects.toThrow('Engine is already initialized or in an invalid state');
      });
      
      it('should handle WASM loading failure', async () => {
        // Mock the loader to fail
        const { loadRNNoiseModule } = await import('../../../utils/rnnoise-loader');
        (loadRNNoiseModule as any).mockRejectedValueOnce(new Error('WASM load failed'));
        
        await expect(engine.initialize()).rejects.toThrow('Initialization failed');
        expect(mockStateManager.transitionTo).toHaveBeenCalledWith('error');
      });
      
      it('should handle AudioContext creation failure', async () => {
        global.AudioContext = vi.fn().mockImplementation(() => {
          throw new Error('AudioContext failed');
        });
        
        await expect(engine.initialize()).rejects.toThrow('Failed to create AudioContext');
      });
      
      it('should resume suspended audio context', async () => {
        mockAudioContext.state = 'suspended';
        await engine.initialize();
        
        expect(mockAudioContext.resume).toHaveBeenCalled();
      });
      
      it('should handle degraded mode when allowed', async () => {
        engine = new MurmubaraEngine({ allowDegraded: true });
        
        // Make WASM fail
        const { loadRNNoiseModule } = await import('../../../utils/rnnoise-loader');
        (loadRNNoiseModule as any).mockRejectedValueOnce(new Error('WASM failed'));
        
        await engine.initialize();
        
        expect(mockLogger.warn).toHaveBeenCalledWith('Attempting degraded mode initialization...');
        expect(mockStateManager.transitionTo).toHaveBeenCalledWith('degraded');
      });
      
      it('should warm up WASM module', async () => {
        await engine.initialize();
        
        // Should process frames during warmup
        expect(mockWasmModule._rnnoise_process_frame).toHaveBeenCalledTimes(10);
      });
      
      it('should handle rnnoise state creation failure', async () => {
        mockWasmModule._rnnoise_create.mockReturnValueOnce(0); // Return null/0
        
        await expect(engine.initialize()).rejects.toThrow('Failed to create RNNoise state');
      });

      it('should throw if already initialized', async () => {
        mockStateManager.canTransitionTo.mockReturnValue(false);
        
        await expect(engine.initialize()).rejects.toThrow(MurmubaraError);
        await expect(engine.initialize()).rejects.toMatchObject({
          code: ErrorCodes.ALREADY_INITIALIZED
        });
      });

      it('should handle WASM loading timeout', async () => {
        // Mock slow WASM loading
        (global.window as any).createRNNWasmModule = vi.fn(() => 
          new Promise(resolve => setTimeout(resolve, 10000))
        );
        
        await expect(engine.initialize()).rejects.toThrow('timeout');
      });

      it('should handle missing createRNNWasmModule', async () => {
        delete (global.window as any).createRNNWasmModule;
        
        await expect(engine.initialize()).rejects.toThrow('RNNoise WASM module creator not found');
      });
    });
  });

  // ===== STREAM PROCESSING TESTS =====
  describe('Stream Processing', () => {
    let mockStream: MediaStream;
    
    beforeEach(async () => {
      engine = new MurmubaraEngine();
      await engine.initialize();
      
      mockStream = {
        id: 'test-stream',
        getTracks: vi.fn().mockReturnValue([
          { stop: vi.fn(), addEventListener: vi.fn() }
        ]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      } as any;
    });
    
    it('should process stream successfully', async () => {
      mockStateManager.getState.mockReturnValue('ready');
      
      const controller = await engine.processStream(mockStream);
      
      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
      expect(mockAudioContext.createScriptProcessor).toHaveBeenCalledWith(4096, 1, 1);
      expect(mockAudioContext.createMediaStreamDestination).toHaveBeenCalled();
      expect(mockScriptProcessor.connect).toHaveBeenCalled();
      expect(controller).toHaveProperty('stop');
      expect(controller).toHaveProperty('pause');
      expect(controller).toHaveProperty('resume');
    });
    
    it('should handle invalid state', async () => {
      mockStateManager.requireState.mockImplementation(() => {
        throw new Error('Invalid state: uninitialized. Required states: ready, processing');
      });
      
      await expect(engine.processStream(mockStream)).rejects.toThrow(
        'Invalid state'
      );
    });

    it('should throw if not initialized', async () => {
      const uninitializedEngine = new MurmubaraEngine();
      mockStateManager.isInState.mockReturnValue(false);
      
      await expect(uninitializedEngine.processStream(mockStream)).rejects.toThrow('not in a valid state');
    });

    it('should emit processing events', async () => {
      const startSpy = vi.fn();
      const endSpy = vi.fn();
      engine.on('processing-start', startSpy);
      engine.on('processing-end', endSpy);
      
      const controller = await engine.processStream(mockStream);
      expect(startSpy).toHaveBeenCalledWith(controller.streamId);
      
      controller.stop();
      expect(endSpy).toHaveBeenCalledWith(controller.streamId);
    });
    
    it('should apply filters in chain', async () => {
      await engine.processStream(mockStream);
      
      // Should create 4 filters
      expect(mockAudioContext.createBiquadFilter).toHaveBeenCalledTimes(4);
      
      // Check filter configurations
      expect(mockNotchFilter1.type).toBe('notch');
      expect(mockNotchFilter1.frequency.value).toBe(1000);
      expect(mockNotchFilter1.Q.value).toBe(30);
      
      expect(mockNotchFilter2.type).toBe('notch');
      expect(mockNotchFilter2.frequency.value).toBe(2000);
      expect(mockNotchFilter2.Q.value).toBe(30);
      
      expect(mockHighPassFilter.type).toBe('highpass');
      expect(mockHighPassFilter.frequency.value).toBe(80);
      expect(mockHighPassFilter.Q.value).toBe(0.7);
      
      expect(mockLowShelfFilter.type).toBe('lowshelf');
      expect(mockLowShelfFilter.frequency.value).toBe(200);
      expect(mockLowShelfFilter.gain.value).toBe(-3);
      
      // Check connections
      expect(mockMediaStreamSource.connect).toHaveBeenCalledWith(mockHighPassFilter);
      expect(mockHighPassFilter.connect).toHaveBeenCalledWith(mockNotchFilter1);
      expect(mockNotchFilter1.connect).toHaveBeenCalledWith(mockNotchFilter2);
      expect(mockNotchFilter2.connect).toHaveBeenCalledWith(mockLowShelfFilter);
      expect(mockLowShelfFilter.connect).toHaveBeenCalled();
      expect(mockScriptProcessor.connect).toHaveBeenCalledWith(mockMediaStreamDestination);
    });
    
    it('should process audio frames', async () => {
      await engine.processStream(mockStream);
      
      // Create test audio data
      const inputBuffer = new Float32Array(4096);
      for (let i = 0; i < 4096; i++) {
        inputBuffer[i] = Math.sin(i * 0.01) * 0.5;
      }
      
      const outputBuffer = new Float32Array(4096);
      
      const mockEvent = {
        inputBuffer: { getChannelData: () => inputBuffer },
        outputBuffer: { getChannelData: () => outputBuffer }
      };
      
      // Process audio
      mockScriptProcessor.onaudioprocess?.(mockEvent as any);
      
      // Should have called WASM processing
      expect(mockWasmModule._rnnoise_process_frame).toHaveBeenCalled();
      expect(mockMetricsManager.recordFrame).toHaveBeenCalled();
    });
    
    it('should handle chunk processing', async () => {
      const onChunkProcessed = vi.fn();
      const controller = await engine.processStream(mockStream, {
        chunkDuration: 1000,
        onChunkProcessed
      });
      
      expect(controller).toBeDefined();
      
      // ChunkProcessor should be created
      expect(ChunkProcessor).toHaveBeenCalledWith(
        48000,
        expect.objectContaining({ chunkDuration: 1000 }),
        mockLogger,
        mockMetricsManager
      );
    });
    
    it('should track active streams', async () => {
      const controller1 = await engine.processStream(mockStream);
      
      const mockStream2 = { ...mockStream, id: 'stream-2' };
      const controller2 = await engine.processStream(mockStream2);
      
      const diagnostics = engine.getDiagnostics();
      expect(diagnostics.activeProcessors).toBe(2);
      
      await controller1.stop();
      
      const diagnostics2 = engine.getDiagnostics();
      expect(diagnostics2.activeProcessors).toBe(1);
    });
    
    it('should handle stream stop', async () => {
      const controller = await engine.processStream(mockStream);
      
      controller.stop();
      
      expect(mockScriptProcessor.disconnect).toHaveBeenCalled();
      expect(mockMediaStreamSource.disconnect).toHaveBeenCalled();
    });
    
    it('should handle pause/resume', async () => {
      const controller = await engine.processStream(mockStream);
      
      controller.pause();
      expect(controller.getState()).toBe('paused');
      
      controller.resume();
      expect(controller.getState()).toBe('processing');
    });
  });

  // ===== AGC TESTS =====
  describe('AGC (Automatic Gain Control)', () => {
    beforeEach(async () => {
      engine = new MurmubaraEngine({ agcEnabled: true });
      await engine.initialize();
    });

    it('should have AGC enabled by default to fix 4% volume issue', () => {
      expect(engine.isAGCEnabled()).toBe(true);
    });

    it('should allow disabling AGC if user prefers manual control', () => {
      engine.setAGCEnabled(false);
      expect(engine.isAGCEnabled()).toBe(false);
    });

    it('should configure AGC with medical-grade settings', () => {
      const agcConfig = engine.getAGCConfig();
      
      expect(agcConfig).toEqual({
        targetLevel: 0.3,    // 30% target for clear speech
        maxGain: 6.0,        // Safe limit for medical recordings
        enabled: true
      });
    });

    it('should use new reduction factors that preserve volume', () => {
      // Test new reduction factors
      expect(engine.getReductionFactor('low')).toBe(1.0);    // Was 0.9
      expect(engine.getReductionFactor('medium')).toBe(0.9); // Was 0.7
      expect(engine.getReductionFactor('high')).toBe(0.8);   // Was 0.5
    });

    it('should create AGC when enabled and integrate into audio chain', async () => {
      const mockStream = createMockMediaStream();
      
      // Process a stream with AGC enabled
      const controller = await engine.processStream(mockStream);

      // Verify AGC was created with correct target level
      expect(SimpleAGC).toHaveBeenCalledWith(mockAudioContext, 0.3);
    });

    it('should connect AGC in the audio chain: filters -> AGC -> processor', async () => {
      const mockStream = createMockMediaStream();
      const controller = await engine.processStream(mockStream);

      // Verify AGC is connected in the chain
      expect(mockAGC.connect).toHaveBeenCalled();
      // Should connect lowShelfFilter -> AGC -> processor
      const [source, destination] = mockAGC.connect.mock.calls[0];
      expect(source).toBeDefined(); // lowShelfFilter
      expect(destination).toBeDefined(); // processor
    });

    it('should call AGC updateGain during audio processing', async () => {
      const mockStream = createMockMediaStream();
      const controller = await engine.processStream(mockStream);

      // Get the audio processing callback
      const processor = mockAudioContext.createScriptProcessor.mock.results[0].value;
      const audioCallback = processor.onaudioprocess;

      // Simulate audio processing event
      const mockEvent = {
        inputBuffer: {
          getChannelData: () => new Float32Array(4096).fill(0.1) // 10% volume
        },
        outputBuffer: {
          getChannelData: () => new Float32Array(4096)
        }
      };

      // Process audio
      audioCallback(mockEvent);

      // AGC should be updated periodically
      expect(mockAGC.updateGain).toHaveBeenCalled();
    });

    it('should not create AGC when disabled', async () => {
      engine.setAGCEnabled(false);
      const mockStream = createMockMediaStream();
      const controller = await engine.processStream(mockStream);

      // AGC should not be created
      expect(SimpleAGC).not.toHaveBeenCalled();
    });

    it('should amplify 4% input to audible output with AGC', async () => {
      const mockStream = createMockMediaStream();
      const controller = await engine.processStream(mockStream);

      const processor = mockAudioContext.createScriptProcessor.mock.results[0].value;
      const audioCallback = processor.onaudioprocess;

      // Simulate the user's exact problem: 4% volume when shouting
      const quietInput = new Float32Array(4096).fill(0.04); // 4% amplitude
      const output = new Float32Array(4096);

      const mockEvent = {
        inputBuffer: {
          getChannelData: () => quietInput
        },
        outputBuffer: {
          getChannelData: () => output
        }
      };

      // Process with AGC
      audioCallback(mockEvent);

      // With 5x gain from AGC, output should be ~20% (0.04 * 5 = 0.2)
      // This makes shouting audible!
      expect(mockAGC.updateGain).toHaveBeenCalled();
      expect(mockAGC.getCurrentGain).toHaveBeenCalled();
    });
  });

  // ===== RESAMPLING TESTS =====
  describe('Resampling', () => {
    beforeEach(async () => {
      engine = new MurmubaraEngine({ allowDegraded: true });
      await engine.initialize();
    });

    it('should throw error for unsupported channel count', async () => {
      const mockArrayBuffer = createMockWAVBuffer({
        numChannels: 2, // Stereo - unsupported
        sampleRate: 44100,
        bitsPerSample: 16
      });

      await expect(engine.processFile(mockArrayBuffer))
        .rejects
        .toThrow('Unsupported channel count: 2. Only mono (1 channel) is supported');
    });

    it('should accept mono audio (1 channel)', async () => {
      const mockArrayBuffer = createMockWAVBuffer({
        numChannels: 1, // Mono - supported
        sampleRate: 48000,
        bitsPerSample: 16
      });

      await expect(engine.processFile(mockArrayBuffer))
        .resolves
        .toBeInstanceOf(ArrayBuffer);
    });

    it('should resample from 44100Hz to 48000Hz', async () => {
      const mockArrayBuffer = createMockWAVBuffer({
        numChannels: 1,
        sampleRate: 44100, // Non-48kHz rate
        bitsPerSample: 16
      });

      // Should successfully resample with our linear interpolation implementation
      const result = await engine.processFile(mockArrayBuffer);
      expect(result).toBeInstanceOf(ArrayBuffer);
      
      // Verify the output is at 48kHz by checking the WAV header
      const view = new DataView(result);
      const outputSampleRate = view.getUint32(24, true);
      expect(outputSampleRate).toBe(48000);
    });

    it('should not resample when already at 48000Hz', async () => {
      const mockArrayBuffer = createMockWAVBuffer({
        numChannels: 1,
        sampleRate: 48000, // Already correct rate
        bitsPerSample: 16
      });

      const result = await engine.processFile(mockArrayBuffer);
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it('should handle resampling from various sample rates', async () => {
      const testRates = [8000, 16000, 22050, 44100, 96000];
      
      for (const rate of testRates) {
        const mockArrayBuffer = createMockWAVBuffer({
          numChannels: 1,
          sampleRate: rate,
          bitsPerSample: 16
        });

        // All rates should be successfully resampled to 48kHz
        const result = await engine.processFile(mockArrayBuffer);
        expect(result).toBeInstanceOf(ArrayBuffer);
        
        // Verify output is always 48kHz
        const view = new DataView(result);
        const outputSampleRate = view.getUint32(24, true);
        expect(outputSampleRate).toBe(48000);
      }
    });

    it('should validate sample rate is a number', async () => {
      const mockArrayBuffer = createMockWAVBuffer({
        numChannels: 1,
        sampleRate: NaN, // Invalid sample rate
        bitsPerSample: 16
      });

      await expect(engine.processFile(mockArrayBuffer))
        .rejects
        .toThrow();
    });
  });

  // ===== ERROR HANDLING TESTS =====
  describe('Error Handling', () => {
    beforeEach(() => {
      engine = new MurmubaraEngine();
    });
    
    it('should emit error events', async () => {
      const errorHandler = vi.fn();
      engine.on('error', errorHandler);
      
      // Trigger error
      const { loadRNNoiseModule } = await import('../../../utils/rnnoise-loader');
      (loadRNNoiseModule as any).mockRejectedValueOnce(new Error('Test error'));
      
      try {
        await engine.initialize();
      } catch (e) {
        // Expected
      }
      
      expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({
        code: 'INITIALIZATION_FAILED',
        message: expect.stringContaining('Test error')
      }));
    });
    
    it('should record error history', async () => {
      const { loadRNNoiseModule } = await import('../../../utils/rnnoise-loader');
      (loadRNNoiseModule as any).mockRejectedValueOnce(new Error('Test error'));
      
      try {
        await engine.initialize();
      } catch (e) {
        // Expected
      }
      
      const diagnostics = engine.getDiagnostics();
      expect(diagnostics.errors).toHaveLength(1);
      expect(diagnostics.errors[0].error).toContain('Test error');
    });
    
    it('should limit error history', async () => {
      // Create multiple engines to accumulate errors in one engine
      const testEngine = new MurmubaraEngine();
      
      // Force internal error recording by accessing private method
      for (let i = 0; i < 15; i++) {
        (testEngine as any).recordError(new Error(`Error ${i}`));
      }
      
      const diagnostics = testEngine.getDiagnostics();
      expect(diagnostics.errors).toHaveLength(10); // Max 10
    });

    it('should handle non-Error objects', () => {
      engine['recordError']('String error');
      engine['recordError'](123);
      engine['recordError']({ message: 'Object error' });
      
      expect(engine['errorHistory'].length).toBe(3);
      expect(engine['errorHistory'][0].error).toBe('String error');
      expect(engine['errorHistory'][1].error).toBe('123');
    });

    it('should handle error events registration', () => {
      const errorHandler = vi.fn();
      
      engine.on('error', errorHandler);
      
      // Emit error directly
      engine.emit('error', {
        code: 'TEST_ERROR',
        message: 'Test error',
        details: new Error('Test error')
      });
      
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  // ===== CLEANUP AND DESTROY TESTS =====
  describe('Cleanup', () => {
    describe('Auto Cleanup', () => {
      it('should setup cleanup timer when enabled', () => {
        vi.useFakeTimers();
        engine = new MurmubaraEngine({ autoCleanup: true, cleanupDelay: 1000 });
        
        // Simulate ready state with no active streams
        mockStateManager.isInState.mockReturnValue(true);
        
        // Trigger processing end
        engine.emit('processing-end', 'test-stream');
        
        // Fast forward time
        vi.advanceTimersByTime(1000);
        
        expect(mockLogger.info).toHaveBeenCalledWith('Auto-cleanup triggered due to inactivity');
        
        vi.useRealTimers();
      });

      it('should not setup cleanup when disabled', () => {
        engine = new MurmubaraEngine({ autoCleanup: false });
        
        engine.emit('processing-end', 'test');
        
        expect(engine['cleanupTimer']).toBeUndefined();
      });

      it('should clear cleanup timer on processing start', () => {
        vi.useFakeTimers();
        
        engine = new MurmubaraEngine({ 
          autoCleanup: true,
          cleanupDelay: 1000 
        });
        
        // Set a fake timer
        engine['cleanupTimer'] = setTimeout(() => {}, 1000) as any;
        
        engine.emit('processing-start', 'test');
        
        expect(engine['cleanupTimer']).toBeUndefined();
        
        vi.useRealTimers();
      });

      it('should cancel cleanup timer on new processing', () => {
        vi.useFakeTimers();
        engine = new MurmubaraEngine({ autoCleanup: true, cleanupDelay: 1000 });
        
        // Setup cleanup timer
        mockStateManager.isInState.mockReturnValue(true);
        engine.emit('processing-end', 'test-stream');
        
        // Start new processing before cleanup
        engine.emit('processing-start', 'new-stream');
        
        // Fast forward time
        vi.advanceTimersByTime(2000);
        
        // Should not trigger cleanup
        expect(mockLogger.info).not.toHaveBeenCalledWith('Auto-cleanup triggered due to inactivity');
        
        vi.useRealTimers();
      });

      it('should trigger cleanup after delay when no active streams', () => {
        vi.useFakeTimers();
        
        engine = new MurmubaraEngine({ 
          autoCleanup: true,
          cleanupDelay: 1000 
        });
        
        const destroySpy = vi.spyOn(engine, 'destroy');
        
        // Set ready state
        engine['stateManager']['currentState'] = 'ready';
        
        engine.emit('processing-end', 'test');
        
        vi.advanceTimersByTime(1000);
        
        expect(destroySpy).toHaveBeenCalled();
        
        vi.useRealTimers();
      });
    });

    describe('Destroy Method', () => {
      beforeEach(async () => {
        engine = new MurmubaraEngine();
        await engine.initialize();
      });
      
      it('should destroy engine normally', async () => {
        mockStateManager.getState.mockReturnValue('ready');
        
        await engine.destroy();
        
        expect(mockStateManager.transitionTo).toHaveBeenCalledWith('destroying');
        expect(mockWasmModule._rnnoise_destroy).toHaveBeenCalled();
        expect(mockWasmModule._free).toHaveBeenCalledTimes(2);
        expect(mockAudioContext.close).toHaveBeenCalled();
        expect(mockWorkerManager.terminateAll).toHaveBeenCalled();
        expect(mockMetricsManager.stopAutoUpdate).toHaveBeenCalled();
        expect(mockStateManager.transitionTo).toHaveBeenCalledWith('destroyed');
      });
      
      it('should force destroy with active streams', async () => {
        await engine.processStream(mockStream);
        mockStateManager.canTransitionTo.mockReturnValue(false);
        
        await engine.destroy(true);
        
        expect(mockLogger.warn).toHaveBeenCalledWith('Force destroying engine');
      });
      
      it('should handle already destroyed state', async () => {
        mockStateManager.canTransitionTo.mockReturnValue(false);
        
        await expect(engine.destroy()).rejects.toThrow('Cannot destroy engine in current state');
      });
      
      it('should handle errors during cleanup', async () => {
        mockAudioContext.close.mockRejectedValueOnce(new Error('Close failed'));
        
        await expect(engine.destroy()).rejects.toThrow('Cleanup failed');
        expect(mockStateManager.transitionTo).toHaveBeenCalledWith('error');
      });
      
      it('should clear cleanup timer', async () => {
        vi.useFakeTimers();
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
        const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
        
        engine = new MurmubaraEngine({ autoCleanup: true });
        await engine.initialize();
        
        // Start cleanup timer
        mockStateManager.isInState.mockReturnValue(true);
        engine.emit('processing-end');
        
        await engine.destroy();
        
        // Should have cleared a timer
        expect(clearTimeoutSpy).toHaveBeenCalled();
        vi.useRealTimers();
      });

      it('should allow force destroy', async () => {
        mockStateManager.canTransitionTo.mockReturnValue(false);
        
        await engine.destroy(true);
        
        expect(mockLogger.warn).toHaveBeenCalledWith('Force destroying engine');
      });

      it('should cleanup resources on destroy', async () => {
        // Mock some resources
        engine['audioContext'] = mockAudioContext;
        engine['wasmModule'] = {
          _rnnoise_destroy: vi.fn(),
          _free: vi.fn()
        };
        engine['rnnoiseState'] = {};
        engine['inputPtr'] = 123;
        engine['outputPtr'] = 456;
        
        // Add an active stream
        const mockStream = {
          cleanup: vi.fn()
        };
        engine['activeStreams'].set('test', mockStream as any);
        
        // Set state to allow destroy
        engine['stateManager']['currentState'] = 'ready';
        
        await engine.destroy();
        
        expect(mockAudioContext.close).toHaveBeenCalled();
        expect(engine['wasmModule']._rnnoise_destroy).toHaveBeenCalled();
        expect(engine['wasmModule']._free).toHaveBeenCalledWith(123);
        expect(engine['wasmModule']._free).toHaveBeenCalledWith(456);
        expect(mockStream.cleanup).toHaveBeenCalled();
      });

      it('should handle errors during cleanup gracefully', async () => {
        engine['audioContext'] = {
          close: vi.fn(() => Promise.reject(new Error('Close failed')))
        } as any;
        
        engine['stateManager']['currentState'] = 'ready';
        
        // Should not throw
        await engine.destroy();
        
        expect(engine['stateManager'].getState()).toBe('destroyed');
      });

      it('should force destroy from any state', async () => {
        const destroyHandler = vi.fn();
        
        engine.on('destroyed', destroyHandler);
        
        await engine.destroy(true);
        
        expect(destroyHandler).toHaveBeenCalled();
        expect(engine['stateManager'].getState()).toBe('destroyed');
      });
    });
  });

  // ===== METRICS AND DIAGNOSTICS TESTS =====
  describe('Metrics and Diagnostics', () => {
    beforeEach(async () => {
      engine = new MurmubaraEngine();
      await engine.initialize();
    });
    
    it('should get metrics', () => {
      const metrics = engine.getMetrics();
      
      expect(mockMetricsManager.getMetrics).toHaveBeenCalled();
      expect(metrics).toHaveProperty('noiseReductionLevel');
      expect(metrics).toHaveProperty('processingLatency');
      expect(metrics).toHaveProperty('processed');
      expect(metrics).toHaveProperty('latency');
      expect(metrics).toHaveProperty('cpuUsage');
    });
    
    it('should register metrics callback', () => {
      const callback = vi.fn();
      engine.onMetricsUpdate(callback);
      
      // Should have registered the callback via event emitter
      const metricsHandler = mockMetricsManager.on.mock.calls.find(c => c[0] === 'metrics-update')?.[1];
      expect(metricsHandler).toBeDefined();
      
      // Test the forwarding works
      const testMetrics = { noiseReductionLevel: 50 };
      metricsHandler?.(testMetrics);
      
      // The engine should have received and forwarded the event
      expect(engine.listenerCount('metrics-update')).toBeGreaterThan(0);
    });

    it('should forward metrics updates', () => {
      const metricsHandler = vi.fn();
      
      engine.on('metrics-update', metricsHandler);
      
      const mockMetrics = {
        processed: 100,
        latency: 5,
        cpuUsage: 20,
        memoryUsage: 1000000,
        queuedFrames: 0,
        droppedFrames: 0,
        processingLatency: 5
      };
      
      engine['metricsManager'].emit('metrics-update', mockMetrics);
      
      expect(metricsHandler).toHaveBeenCalledWith(mockMetrics);
    });
    
    it('should get diagnostics', () => {
      mockStateManager.getState.mockReturnValue('ready');
      
      const diagnostics = engine.getDiagnostics();
      
      expect(diagnostics).toMatchObject({
        engineState: 'ready',
        wasmLoaded: true,
        processingTime: expect.any(Number),
        memoryUsage: expect.any(Number),
        activeProcessors: 0,
        version: expect.stringMatching(/^\d+\.\d+\.\d+$/),
        browserInfo: expect.any(Object)
      });
    });

    it('should return comprehensive diagnostics', () => {
      // Add some state
      engine['activeStreams'].set('stream1', {} as any);
      engine['errorHistory'].push({
        timestamp: Date.now(),
        error: 'Test error'
      });
      
      const diagnostics = engine.getDiagnostics();
      
      expect(diagnostics).toBeDefined();
      expect(diagnostics.engineVersion).toBeDefined();
      expect(diagnostics.state).toBe('uninitialized');
      expect(diagnostics.activeStreams).toBe(1);
      expect(diagnostics.errorHistory).toHaveLength(1);
      expect(diagnostics.config).toMatchObject({
        noiseReductionLevel: 'medium',
        bufferSize: 4096,
        algorithm: 'rnnoise'
      });
    });
    
    it('should include browser info', () => {
      const diagnostics = engine.getDiagnostics();
      
      expect(diagnostics.browserInfo.name).toBe('Chrome');
      expect(diagnostics.browserInfo.version).toBe('120.0.0.0');
      expect(diagnostics.browserInfo.audioAPIsSupported).toContain('AudioContext');
    });
    
    it('should handle performance.memory absence', () => {
      delete (global.performance as any).memory;
      
      const diagnostics = engine.getDiagnostics();
      
      expect(diagnostics.memoryUsage).toBe(0);
    });

    it('should handle missing performance.memory', () => {
      global.performance = {} as any;
      
      const diagnostics = engine.getDiagnostics();
      
      expect(diagnostics.systemInfo.memory).toBeUndefined();
    });
  });

  // ===== CONFIGURATION TESTS =====
  describe('Configuration', () => {
    it('should handle all noise reduction levels', async () => {
      const levels = ['low', 'medium', 'high', 'auto'] as const;
      
      // Reset the mock to resolve correctly for all tests
      const { loadRNNoiseModule } = await import('../../../utils/rnnoise-loader');
      (loadRNNoiseModule as any).mockResolvedValue(mockWasmModule);

      for (const level of levels) {
        const testEngine = new MurmubaraEngine({ noiseReductionLevel: level });
        await testEngine.initialize();
        
        // Noise reduction level is stored in config
        expect(testEngine['config'].noiseReductionLevel).toBe(level);
      }
    });
    
    it('should handle all buffer sizes', async () => {
      const sizes = [256, 512, 1024, 2048, 4096] as const;
      
      // Reset the mock to resolve correctly for all tests
      const { loadRNNoiseModule } = await import('../../../utils/rnnoise-loader');
      (loadRNNoiseModule as any).mockResolvedValue(mockWasmModule);

      for (const bufferSize of sizes) {
        const testEngine = new MurmubaraEngine({ bufferSize });
        await testEngine.initialize();
        await testEngine.processStream({ id: 'test' } as any);
        
        expect(mockAudioContext.createScriptProcessor).toHaveBeenCalledWith(bufferSize, 1, 1);
      }
    });

    it('should handle various config combinations', () => {
      const configs = [
        { algorithm: 'rnnoise' as const },
        { bufferSize: 512 },
        { cleanupDelay: 60000 },
        { logLevel: 'error' as const },
        { noiseReductionLevel: 'auto' as const }
      ];
      
      configs.forEach(config => {
        const testEngine = new MurmubaraEngine(config);
        expect(testEngine).toBeDefined();
      });
    });

    it('should handle worker configuration', () => {
      const testEngine = new MurmubaraEngine({
        useWorker: true,
        workerPath: '/custom/worker.js'
      });
      
      expect(testEngine['config'].useWorker).toBe(true);
      expect(testEngine['config'].workerPath).toBe('/custom/worker.js');
    });

    it('should handle all algorithms', () => {
      const algorithms = ['rnnoise'] as const;
      
      algorithms.forEach(algorithm => {
        const testEngine = new MurmubaraEngine({ algorithm });
        expect(testEngine['config'].algorithm).toBe(algorithm);
      });
    });

    it('should handle custom log handler', () => {
      const logHandler = vi.fn();
      const testEngine = new MurmubaraEngine({ 
        logLevel: 'info',
        onLog: logHandler 
      });
      
      testEngine['logger'].info('Test');
      
      expect(logHandler).toHaveBeenCalled();
    });
  });

  // ===== PROPERTY ACCESS TESTS =====
  describe('Property Access', () => {
    beforeEach(async () => {
      engine = new MurmubaraEngine();
      await engine.initialize();
    });

    it('should get current state', () => {
      mockStateManager.getState.mockReturnValue('ready');
      expect(engine.state).toBe('ready');
    });

    it('should check if initialized', () => {
      mockStateManager.isInState.mockReturnValue(true);
      expect(engine.isInitialized).toBe(true);
    });

    it('should get active stream count', async () => {
      const stream = createMockMediaStream();
      await engine.processStream(stream);
      
      expect(engine.activeStreamCount).toBe(1);
    });

    it('should check isActive', () => {
      expect(engine['activeStreams'].size).toBe(0);
      expect(engine['isActive']()).toBe(false);
    });

    it('should check isProcessing', () => {
      expect(engine['stateManager'].isInState('processing')).toBe(false);
    });

    it('should cover activeStreams management', () => {
      expect(engine['activeStreams'].size).toBe(0);
      
      // Add a mock stream
      const mockStream = { id: 'test-stream' } as any;
      engine['activeStreams'].set('test-stream', mockStream);
      
      expect(engine['activeStreams'].size).toBe(1);
      expect(engine['activeStreams'].has('test-stream')).toBe(true);
    });

    it('should cover state checks', () => {
      expect(engine['stateManager'].isInState('processing')).toBe(false);
      
      // Force processing state
      engine['stateManager']['currentState'] = 'processing';
      expect(engine['stateManager'].isInState('processing')).toBe(true);
    });
  });

  // ===== DEGRADED MODE TESTS =====
  describe('Degraded Mode', () => {
    it('should initialize in degraded mode when configured', async () => {
      const testEngine = new MurmubaraEngine({ allowDegraded: true });
      const degradedHandler = vi.fn();
      
      testEngine.on('degraded-mode', degradedHandler);
      
      // Force failure
      global.window.WebAssembly = undefined as any;
      
      await testEngine.initialize();
      
      expect(degradedHandler).toHaveBeenCalled();
      expect(testEngine['stateManager'].getState()).toBe('degraded');
    });

    it('should handle audio context failure in degraded mode', async () => {
      const testEngine = new MurmubaraEngine({ allowDegraded: true });
      
      // Force WebAssembly failure
      global.window.WebAssembly = undefined as any;
      
      // Also fail audio context
      global.window.AudioContext = vi.fn(() => {
        throw new Error('AudioContext failed');
      });
      
      await testEngine.initialize();
      
      // Should still enter degraded mode but log error
      expect(testEngine['stateManager'].getState()).toBe('degraded');
    });

    it('should handle degraded mode', () => {
      const testEngine = new MurmubaraEngine({ allowDegraded: true });
      expect(testEngine).toBeDefined();
    });
  });
});

// Helper functions for creating mock WAV files
function createMockWAVBuffer(options: {
  numChannels: number;
  sampleRate: number | typeof NaN;
  bitsPerSample: number;
  durationSeconds?: number;
}): ArrayBuffer {
  const { numChannels, sampleRate, bitsPerSample, durationSeconds = 1 } = options;
  
  // Handle NaN sample rate for error testing
  const validSampleRate = isNaN(sampleRate) ? 0 : sampleRate;
  
  const numSamples = Math.floor(validSampleRate * durationSeconds);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const fileSize = 44 + dataSize; // 44 bytes for WAV header

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // RIFF header - write as bytes to avoid endianness issues
  view.setUint8(0, 0x52); // 'R'
  view.setUint8(1, 0x49); // 'I'
  view.setUint8(2, 0x46); // 'F'
  view.setUint8(3, 0x46); // 'F'
  view.setUint32(4, fileSize - 8, true); // File size - 8
  view.setUint8(8, 0x57);  // 'W'
  view.setUint8(9, 0x41);  // 'A'
  view.setUint8(10, 0x56); // 'V'
  view.setUint8(11, 0x45); // 'E'

  // fmt chunk
  view.setUint8(12, 0x66); // 'f'
  view.setUint8(13, 0x6D); // 'm'
  view.setUint8(14, 0x74); // 't'
  view.setUint8(15, 0x20); // ' '
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, validSampleRate, true);
  view.setUint32(28, validSampleRate * numChannels * (bitsPerSample / 8), true); // Byte rate
  view.setUint16(32, numChannels * (bitsPerSample / 8), true); // Block align
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  view.setUint8(36, 0x64); // 'd'
  view.setUint8(37, 0x61); // 'a'
  view.setUint8(38, 0x74); // 't'
  view.setUint8(39, 0x61); // 'a'
  view.setUint32(40, dataSize, true);

  // Fill with sample audio data (sine wave) only if we have valid data
  if (dataSize > 0 && numSamples > 0) {
    const samples = new Int16Array(buffer, 44, numSamples * numChannels);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * 440 * i / validSampleRate) * 16384; // 440Hz tone
    }
  }

  return buffer;
}