/**
 * BOSS FIGHT: MurmubaraEngine
 * 773 lines of pure complexity
 * This is where boys become men
 */

import { MurmubaraEngine } from '../../core/murmuraba-engine';
import { vi } from 'vitest';
import { StateManager } from '../../core/state-manager';
import { Logger } from '../../core/logger';
import { WorkerManager } from '../../managers/worker-manager';
import { MetricsManager } from '../../managers/metrics-manager';
import { ChunkProcessor } from '../../managers/chunk-processor';
import { MurmubaraConfig, EngineState } from '../../types';
import { createFullTestEnvironment, TestUtils } from '../shared/test-utils';

// Mock all dependencies
vi.mock('../../core/state-manager', () => ({
  StateManager: vi.fn()
}));
vi.mock('../../core/logger', () => ({
  Logger: vi.fn()
}));
vi.mock('../../managers/worker-manager', () => ({
  WorkerManager: vi.fn()
}));
vi.mock('../../managers/metrics-manager', () => ({
  MetricsManager: vi.fn()
}));
vi.mock('../../managers/chunk-processor', () => ({
  ChunkProcessor: vi.fn()
}));

// Mock WASM module
const mockWasmModule = {
  _rnnoise_create: vi.fn().mockReturnValue(123),
  _rnnoise_destroy: vi.fn(),
  _rnnoise_process_frame: vi.fn().mockReturnValue(1),
  _malloc: vi.fn().mockReturnValue(1000),
  _free: vi.fn(),
  HEAPF32: new Float32Array(10000),
  HEAP32: new Int32Array(10000)
};

// Mock rnnoise-loader
vi.mock('../../utils/rnnoise-loader', () => ({
  loadRNNoiseModule: vi.fn().mockResolvedValue(mockWasmModule)
}));

// Test environment setup
let testEnv: ReturnType<typeof createFullTestEnvironment>;
let mockStream: MediaStream;

beforeEach(async () => {
  // Setup comprehensive test environment
  testEnv = createFullTestEnvironment();
  
  // Reset the loader mock to its default behavior
  const { loadRNNoiseModule } = await import('../../utils/rnnoise-loader');
  (loadRNNoiseModule as any).mockResolvedValue(mockWasmModule);
  
  // Create test stream using MockFactories
  const { MockFactories } = await import('../shared/test-utils');
  mockStream = MockFactories.createMediaStreamMock([
    { kind: 'audio', stop: vi.fn(), addEventListener: vi.fn() } as any
  ]);
  
  // Setup browser environment mocks
  global.window = Object.assign(global.window || {}, {
    AudioContext: global.AudioContext,
    webkitAudioContext: global.AudioContext,
    WebAssembly: {},
    AudioWorkletNode: vi.fn(),
    MediaStream: vi.fn(),
    MediaRecorder: vi.fn(),
    React: { version: '18.2.0' }
  });
  
  global.navigator = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    mediaDevices: { getUserMedia: vi.fn() }
  } as any;
  
  global.performance = {
    ...global.performance,
    memory: {
      usedJSHeapSize: 1000000,
      jsHeapSizeLimit: 2000000,
      totalJSHeapSize: 1500000
    },
    now: vi.fn().mockReturnValue(0)
  } as any;
  
  global.document = {
    createElement: vi.fn().mockReturnValue({
      onload: null,
      onerror: null,
      src: ''
    }),
    head: {
      appendChild: vi.fn().mockImplementation((script) => {
        setTimeout(() => script.onload?.(), 0);
      })
    }
  } as any;
});

afterEach(() => {
  testEnv.cleanup();
});

describe('MurmubaraEngine - The Final Boss', () => {
  let engine: MurmubaraEngine;
  let mockStateManager: vi.Mocked<StateManager>;
  let mockLogger: vi.Mocked<Logger>;
  let mockWorkerManager: vi.Mocked<WorkerManager>;
  let mockMetricsManager: vi.Mocked<MetricsManager>;
  
  beforeEach(() => {
    // Create fresh mocks for each test
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
      getWorkerIds: vi.fn().mockReturnValue([])
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
        droppedFrames: 0
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
    
    // Mock constructors
    (StateManager as vi.MockedClass<typeof StateManager>).mockImplementation(() => mockStateManager);
    (Logger as vi.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);
    (WorkerManager as vi.MockedClass<typeof WorkerManager>).mockImplementation(() => mockWorkerManager);
    (MetricsManager as vi.MockedClass<typeof MetricsManager>).mockImplementation(() => mockMetricsManager);
    
    // Ensure ChunkProcessor is properly mocked if needed
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
  });
  
  describe('Constructor', () => {
    it('should create engine with default config', () => {
      engine = new MurmubaraEngine();
      
      expect(StateManager).toHaveBeenCalled();
      expect(Logger).toHaveBeenCalledWith('[Murmuraba]');
      expect(WorkerManager).toHaveBeenCalledWith(mockLogger);
      expect(MetricsManager).toHaveBeenCalled();
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
  });
  
  describe('Environment support', () => {
    it('should detect missing AudioContext', async () => {
      delete (global.window as any).AudioContext;
      delete (global.window as any).webkitAudioContext;
      
      engine = new MurmubaraEngine();
      
      await expect(engine.initialize()).rejects.toThrow('Environment not supported: Missing required APIs');
    });
    
    it('should detect missing WebAssembly', async () => {
      delete (global.window as any).WebAssembly;
      
      engine = new MurmubaraEngine();
      
      await expect(engine.initialize()).rejects.toThrow('Environment not supported: Missing required APIs');
    });
    
    it('should use webkitAudioContext fallback', async () => {
      delete (global.window as any).AudioContext;
      
      engine = new MurmubaraEngine();
      await engine.initialize();
      
      expect((global.window as any).webkitAudioContext).toHaveBeenCalled();
    });
  });
  
  describe('initialize()', () => {
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
      const { loadRNNoiseModule } = await import('../../utils/rnnoise-loader');
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
      const { loadRNNoiseModule } = await import('../../utils/rnnoise-loader');
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
    
    it('should load WASM module via dynamic import', async () => {
      // Mock the dynamic import
      vi.doMock('../../../utils/rnnoise-loader', () => ({
        loadRNNoiseModule: vi.fn().mockResolvedValue(mockWasmModule)
      }));
      
      await engine.initialize();
      
      expect(mockStateManager.transitionTo).toHaveBeenCalledWith('ready');
    });
    
    it('should handle dynamic import failure', async () => {
      // Mock the loader to fail
      const { loadRNNoiseModule } = await import('../../utils/rnnoise-loader');
      (loadRNNoiseModule as any).mockRejectedValueOnce(new Error('Failed to load RNNoise module'));
      
      await expect(engine.initialize()).rejects.toThrow('Initialization failed');
    });
  });
  
  describe('processStream()', () => {
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
      // The chain goes through analyser when AGC is enabled
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
  
  describe('destroy()', () => {
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
  });
  
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
  });
  
  describe('Error handling', () => {
    beforeEach(() => {
      engine = new MurmubaraEngine();
    });
    
    it('should emit error events', async () => {
      const errorHandler = vi.fn();
      engine.on('error', errorHandler);
      
      // Trigger error
      const { loadRNNoiseModule } = await import('../../utils/rnnoise-loader');
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
      const { loadRNNoiseModule } = await import('../../utils/rnnoise-loader');
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
      // Mock loadRNNoiseModule to always fail
      const { loadRNNoiseModule } = await import('../../utils/rnnoise-loader');
      
      // Create multiple engines to accumulate errors in one engine
      const engines: MurmubaraEngine[] = [];
      
      // Create first engine and trigger 15 errors
      const testEngine = new MurmubaraEngine();
      
      // Force internal error recording by accessing private method
      for (let i = 0; i < 15; i++) {
        (testEngine as any).recordError(new Error(`Error ${i}`));
      }
      
      const diagnostics = testEngine.getDiagnostics();
      expect(diagnostics.errors).toHaveLength(10); // Max 10
      
      // Reset the mock for subsequent tests
      (loadRNNoiseModule as any).mockResolvedValue(mockWasmModule);
    });
  });
  
  describe('Noise reduction levels', () => {
    beforeEach(async () => {
      // Reset the mock to resolve correctly for all tests in this describe block
      const { loadRNNoiseModule } = await import('../../utils/rnnoise-loader');
      (loadRNNoiseModule as any).mockResolvedValue(mockWasmModule);
    });

    it.each(['low', 'medium', 'high', 'auto'] as const)('should handle %s level', async (level) => {
      
      engine = new MurmubaraEngine({ noiseReductionLevel: level });
      await engine.initialize();
      
      // Noise reduction level is stored in config, not diagnostics
      expect(engine['config'].noiseReductionLevel).toBe(level);
    });
  });
  
  describe('Buffer sizes', () => {
    beforeEach(async () => {
      // Reset the mock to resolve correctly for all tests in this describe block
      const { loadRNNoiseModule } = await import('../../utils/rnnoise-loader');
      (loadRNNoiseModule as any).mockResolvedValue(mockWasmModule);
    });

    it.each([256, 512, 1024, 2048, 4096] as const)('should handle buffer size %d', async (bufferSize) => {
      
      engine = new MurmubaraEngine({ bufferSize });
      await engine.initialize();
      await engine.processStream({ id: 'test' } as any);
      
      expect(mockAudioContext.createScriptProcessor).toHaveBeenCalledWith(bufferSize, 1, 1);
    });
  });
});