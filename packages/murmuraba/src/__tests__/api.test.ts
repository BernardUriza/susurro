/**
 * Tests for api.ts - The Global Engine Manager
 * 100% COVERAGE OR DEATH
 */

import { vi } from 'vitest';
import {
  initializeAudioEngine,
  getEngine,
  processStream,
  processStreamChunked,
  destroyEngine,
  getEngineStatus,
  getDiagnostics,
  onMetricsUpdate
} from '../api';
import { MurmubaraEngine } from '../core/murmubara-engine';
import { BufferSize } from '../types';

// Mock MurmubaraEngine
vi.mock('../core/murmubara-engine');

describe('API Module', () => {
  let mockEngine: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a mock engine instance
    mockEngine = {
      initialize: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
      processStream: vi.fn().mockResolvedValue({ 
        stop: vi.fn(),
        stream: {} as MediaStream,
        processor: {} as any,
        pause: vi.fn(),
        resume: vi.fn(),
        getState: vi.fn().mockReturnValue('processing')
      }),
      getDiagnostics: vi.fn().mockReturnValue({
        engineState: 'ready',
        wasmLoaded: true,
        audioContextState: 'running',
        processingLatency: 10,
        memoryUsage: 1000000,
        streamCount: 1,
        version: '1.0.0',
        engineVersion: '1.0.0',
        reactVersion: '18.0.0',
        browserInfo: 'Chrome',
        supportedFormats: ['webm'],
        maxChunksInMemory: 100,
        noiseReductionLevel: 'high',
        algorithm: 'rnnoise',
        errors: [],
        warnings: []
      }),
      onMetricsUpdate: vi.fn()
    };
    
    // Mock the constructor
    (MurmubaraEngine as vi.MockedClass<typeof MurmubaraEngine>).mockImplementation(() => mockEngine);
  });
  
  afterEach(async () => {
    // Clean up any global engine
    try {
      await destroyEngine({ force: true });
    } catch (e) {
      // Ignore errors during cleanup
    }
  });
  
  describe('initializeAudioEngine', () => {
    it('should create and initialize a new engine', async () => {
      const config = { bufferSize: 4096 as BufferSize };
      
      await initializeAudioEngine(config);
      
      expect(MurmubaraEngine).toHaveBeenCalledWith(config);
      expect(mockEngine.initialize).toHaveBeenCalled();
    });
    
    it('should initialize without config', async () => {
      await initializeAudioEngine();
      
      expect(MurmubaraEngine).toHaveBeenCalledWith(undefined);
      expect(mockEngine.initialize).toHaveBeenCalled();
    });
    
    it('should throw error if already initialized', async () => {
      await initializeAudioEngine();
      
      await expect(initializeAudioEngine()).rejects.toThrow(
        'Audio engine is already initialized. Call destroyEngine() first.'
      );
    });
    
    it('should propagate initialization errors', async () => {
      mockEngine.initialize!.mockRejectedValueOnce(new Error('Init failed'));
      
      await expect(initializeAudioEngine()).rejects.toThrow('Init failed');
    });
  });
  
  describe('getEngine', () => {
    it('should return the initialized engine', async () => {
      await initializeAudioEngine();
      
      const engine = getEngine();
      
      expect(engine).toBe(mockEngine);
    });
    
    it('should throw error if not initialized', () => {
      expect(() => getEngine()).toThrow(
        'Audio engine not initialized. Call initializeAudioEngine() first.'
      );
    });
  });
  
  describe('processStream', () => {
    it('should process stream through engine', async () => {
      const mockStream = { id: 'test-stream' } as any;
      const mockController = { 
        stop: vi.fn(),
        stream: mockStream,
        processor: {} as any,
        pause: vi.fn(),
        resume: vi.fn(),
        getState: vi.fn().mockReturnValue('processing')
      };
      mockEngine.processStream!.mockResolvedValueOnce(mockController);
      
      await initializeAudioEngine();
      const result = await processStream(mockStream);
      
      expect(mockEngine.processStream).toHaveBeenCalledWith(mockStream);
      expect(result).toBe(mockController);
    });
    
    it('should throw error if engine not initialized', async () => {
      const mockStream = {} as any;
      
      await expect(processStream(mockStream)).rejects.toThrow(
        'Audio engine not initialized'
      );
    });
  });
  
  describe('processStreamChunked', () => {
    it('should process stream with chunking config', async () => {
      const mockStream = { id: 'test-stream' } as any;
      const config = {
        chunkDuration: 5,
        onChunkProcessed: vi.fn()
      };
      const mockController = { 
        stop: vi.fn(),
        stream: mockStream,
        processor: {} as any,
        pause: vi.fn(),
        resume: vi.fn(),
        getState: vi.fn().mockReturnValue('processing')
      };
      mockEngine.processStream!.mockResolvedValueOnce(mockController);
      
      await initializeAudioEngine();
      const result = await processStreamChunked(mockStream, config);
      
      expect(mockEngine.processStream).toHaveBeenCalledWith(mockStream, config);
      expect(result).toBe(mockController);
    });
    
    it('should work without onChunkProcessed callback', async () => {
      const mockStream = { id: 'test-stream' } as any;
      const config = { chunkDuration: 5 };
      
      await initializeAudioEngine();
      await processStreamChunked(mockStream, config);
      
      expect(mockEngine.processStream).toHaveBeenCalledWith(mockStream, config);
    });
    
    it('should throw error if engine not initialized', async () => {
      const mockStream = {} as any;
      const config = { chunkDuration: 5 };
      
      await expect(processStreamChunked(mockStream, config)).rejects.toThrow(
        'Audio engine not initialized'
      );
    });
  });
  
  describe('destroyEngine', () => {
    it('should destroy the engine', async () => {
      await initializeAudioEngine();
      await destroyEngine();
      
      expect(mockEngine.destroy).toHaveBeenCalledWith(false);
      
      // Should throw after destroy
      expect(() => getEngine()).toThrow('Audio engine not initialized');
    });
    
    it('should force destroy when specified', async () => {
      await initializeAudioEngine();
      await destroyEngine({ force: true });
      
      expect(mockEngine.destroy).toHaveBeenCalledWith(true);
    });
    
    it('should do nothing if engine not initialized', async () => {
      await destroyEngine();
      
      expect(mockEngine.destroy).not.toHaveBeenCalled();
    });
    
    it('should handle destroy errors', async () => {
      await initializeAudioEngine();
      mockEngine.destroy!.mockRejectedValueOnce(new Error('Destroy failed'));
      
      await expect(destroyEngine()).rejects.toThrow('Destroy failed');
    });
  });
  
  describe('getEngineStatus', () => {
    it('should return engine state when initialized', async () => {
      await initializeAudioEngine();
      
      const status = getEngineStatus();
      
      expect(status).toBe('ready');
      expect(mockEngine.getDiagnostics).toHaveBeenCalled();
    });
    
    it('should return uninitialized when not initialized', () => {
      const status = getEngineStatus();
      
      expect(status).toBe('uninitialized');
      expect(mockEngine.getDiagnostics).not.toHaveBeenCalled();
    });
  });
  
  describe('getDiagnostics', () => {
    it('should return engine diagnostics', async () => {
      const mockDiagnostics = {
        engineState: 'ready',
        wasmLoaded: true,
        audioContextState: 'running',
        processingLatency: 15,
        memoryUsage: 2000000,
        streamCount: 2,
        version: '1.4.0',
        engineVersion: '1.4.0',
        reactVersion: '18.0.0',
        browserInfo: 'Chrome 120',
        supportedFormats: ['webm', 'wav', 'mp3'],
        maxChunksInMemory: 100,
        noiseReductionLevel: 'high',
        algorithm: 'rnnoise',
        errors: [],
        warnings: []
      };
      mockEngine.getDiagnostics!.mockReturnValueOnce(mockDiagnostics as any);
      
      await initializeAudioEngine();
      const diagnostics = getDiagnostics();
      
      expect(diagnostics).toBe(mockDiagnostics);
      expect(mockEngine.getDiagnostics).toHaveBeenCalled();
    });
    
    it('should throw error if engine not initialized', () => {
      expect(() => getDiagnostics()).toThrow(
        'Audio engine not initialized'
      );
    });
  });
  
  describe('onMetricsUpdate', () => {
    it('should register metrics callback', async () => {
      const callback = vi.fn();
      
      await initializeAudioEngine();
      onMetricsUpdate(callback);
      
      expect(mockEngine.onMetricsUpdate).toHaveBeenCalledWith(callback);
    });
    
    it('should throw error if engine not initialized', () => {
      const callback = vi.fn();
      
      expect(() => onMetricsUpdate(callback)).toThrow(
        'Audio engine not initialized'
      );
    });
  });
  
  describe('Integration Scenarios', () => {
    it('should handle full lifecycle', async () => {
      // Initialize
      await initializeAudioEngine({ bufferSize: 2048 as BufferSize });
      expect(getEngineStatus()).toBe('ready');
      
      // Process stream
      const mockStream = {} as any;
      await processStream(mockStream);
      
      // Get diagnostics
      const diag = getDiagnostics();
      expect(diag.engineState).toBe('ready');
      
      // Register callback
      const callback = vi.fn();
      onMetricsUpdate(callback);
      
      // Destroy
      await destroyEngine();
      expect(getEngineStatus()).toBe('uninitialized');
    });
    
    it('should handle re-initialization after destroy', async () => {
      // First initialization
      await initializeAudioEngine();
      expect(getEngineStatus()).toBe('ready');
      
      // Destroy
      await destroyEngine();
      expect(getEngineStatus()).toBe('uninitialized');
      
      // Re-initialize with different config
      await initializeAudioEngine({ bufferSize: 4096 as BufferSize });
      expect(getEngineStatus()).toBe('ready');
      expect(MurmubaraEngine).toHaveBeenCalledTimes(2);
    });
  });
});