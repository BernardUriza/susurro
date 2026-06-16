import { MurmubaraEngine } from '../../core/murmuraba-engine';
import { AudioWorkletEngine } from '../../engines/audio-worklet-engine';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock AudioWorkletEngine for testing
vi.mock('../../engines/audio-worklet-engine');

describe('AudioWorklet Integration', () => {
  let engine: MurmubaraEngine;
  let mockAudioWorkletEngine: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock AudioWorkletEngine
    mockAudioWorkletEngine = {
      isAudioWorkletSupported: vi.fn().mockReturnValue(true),
      initialize: vi.fn().mockResolvedValue(undefined),
      onPerformanceMetrics: vi.fn(),
      createProcessingPipeline: vi.fn().mockResolvedValue({
        input: {} as any,
        output: new MediaStream(),
        workletNode: {
          disconnect: vi.fn()
        } as any
      }),
      cleanup: vi.fn(),
      isInitialized: true,
      name: 'AudioWorklet',
      description: 'Test AudioWorklet Engine',
      process: vi.fn().mockReturnValue(new Float32Array()),
    } as any;

    (AudioWorkletEngine as any).mockImplementation(() => mockAudioWorkletEngine);
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

  it('should prefer AudioWorklet when enabled and supported', async () => {
    engine = new MurmubaraEngine({
      useAudioWorklet: true,
      logLevel: 'none'
    });

    await engine.initialize();

    expect(engine.isUsingAudioWorklet()).toBe(true);
    expect(mockAudioWorkletEngine.initialize).toHaveBeenCalled();
    expect(mockAudioWorkletEngine.onPerformanceMetrics).toHaveBeenCalled();
  });

  it('should fall back to ScriptProcessor when AudioWorklet is disabled', async () => {
    engine = new MurmubaraEngine({
      useAudioWorklet: false,
      logLevel: 'none'
    });

    await engine.initialize();

    expect(engine.isUsingAudioWorklet()).toBe(false);
    expect(AudioWorkletEngine).not.toHaveBeenCalled();
  });

  it('should fall back to ScriptProcessor when AudioWorklet is not supported', async () => {
    mockAudioWorkletEngine.isAudioWorkletSupported.mockReturnValue(false);

    engine = new MurmubaraEngine({
      useAudioWorklet: true,
      logLevel: 'none'
    });

    await engine.initialize();

    expect(engine.isUsingAudioWorklet()).toBe(false);
    expect(mockAudioWorkletEngine.initialize).not.toHaveBeenCalled();
  });

  it('should fall back to ScriptProcessor when AudioWorklet initialization fails', async () => {
    mockAudioWorkletEngine.initialize.mockRejectedValue(new Error('AudioWorklet init failed'));

    engine = new MurmubaraEngine({
      useAudioWorklet: true,
      logLevel: 'none'
    });

    await engine.initialize();

    expect(engine.isUsingAudioWorklet()).toBe(false);
    expect(mockAudioWorkletEngine.initialize).toHaveBeenCalled();
  });

  it('should emit metrics from AudioWorklet', async () => {
    const metricsCallback = vi.fn();
    
    engine = new MurmubaraEngine({
      useAudioWorklet: true,
      logLevel: 'none'
    });

    engine.on('metrics-update', metricsCallback);
    await engine.initialize();

    // Simulate metrics callback from AudioWorklet
    const performanceCallback = mockAudioWorkletEngine.onPerformanceMetrics.mock.calls[0][0];
    const testMetrics = {
      processingTime: 1.5,
      bufferUnderruns: 0,
      framesProcessed: 100,
      inputLevel: 0.5,
      outputLevel: 0.3,
      noiseReduction: 40,
      vadLevel: 0.7,
      isVoiceActive: true,
      timestamp: Date.now()
    };

    performanceCallback(testMetrics);

    expect(metricsCallback).toHaveBeenCalledWith({
      noiseReductionLevel: 40,
      processingLatency: 1.5,
      inputLevel: 0.5,
      outputLevel: 0.3,
      timestamp: testMetrics.timestamp,
      frameCount: 100,
      droppedFrames: 0,
      vadLevel: 0.7,
      isVoiceActive: true
    });
  });

  it('should handle metrics callback errors gracefully', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    engine = new MurmubaraEngine({
      useAudioWorklet: true,
      logLevel: 'warn'
    });

    // Add a metrics listener that throws an error
    engine.on('metrics-update', () => {
      throw new Error('Metrics processing error');
    });

    await engine.initialize();

    // Simulate metrics callback from AudioWorklet
    const performanceCallback = mockAudioWorkletEngine.onPerformanceMetrics.mock.calls[0][0];
    
    // This should not throw but should log a warning
    expect(() => {
      performanceCallback({
        processingTime: 1.0,
        framesProcessed: 50
      });
    }).not.toThrow();

    consoleWarnSpy.mockRestore();
  });

  it('should clean up AudioWorklet engine on destroy', async () => {
    engine = new MurmubaraEngine({
      useAudioWorklet: true,
      logLevel: 'none'
    });

    await engine.initialize();
    expect(engine.isUsingAudioWorklet()).toBe(true);

    await engine.destroy();

    expect(mockAudioWorkletEngine.cleanup).toHaveBeenCalled();
  });
});