import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecordingManager } from '../../../hooks/murmuraba-engine/recording-manager';
import { URLManager } from '../../../hooks/murmuraba-engine/url-manager';
import { ProcessedChunk } from '../../../hooks/murmuraba-engine/types';
import { MIN_VALID_BLOB_SIZE } from '../../../hooks/murmuraba-engine/constants';
import * as processFileApi from '../../../api/process-file-with-metrics';

// Mock dependencies
vi.mock('../../../api/process-file-with-metrics');
vi.mock('../../../utils/audio-converter', () => ({
  AudioConverter: {
    concatenateBlobs: vi.fn((blobs) => Promise.resolve(new Blob(blobs)))
  }
}));

describe('RecordingManager', () => {
  let recordingManager: RecordingManager;
  let urlManager: URLManager;
  let consoleWarnSpy: vi.SpyInstance;
  let consoleErrorSpy: vi.SpyInstance;
  let consoleLogSpy: vi.SpyInstance;

  beforeEach(() => {
    urlManager = new URLManager();
    recordingManager = new RecordingManager(urlManager);
    
    // Mock console methods
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();
    
    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => `blob:test-${Math.random()}`);
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with URLManager', () => {
      expect(recordingManager).toBeDefined();
      expect(recordingManager).toBeInstanceOf(RecordingManager);
    });

    it('should register with global TDD bridge if available', () => {
      // Setup global bridge
      (global as any).__murmurabaTDDBridge = {};
      
      const manager = new RecordingManager(urlManager);
      
      expect((global as any).__murmurabaTDDBridge.recordingManagers).toBeDefined();
      expect((global as any).__murmurabaTDDBridge.recordingManagers.has(manager)).toBe(true);
      
      // Cleanup
      delete (global as any).__murmurabaTDDBridge;
    });
  });

  describe('setMetricsProvider', () => {
    it('should set metrics provider', () => {
      const provider = {
        getAggregatedMetrics: vi.fn()
      };
      
      recordingManager.setMetricsProvider(provider);
      
      // Test by using getRealMetrics indirectly
      expect(() => recordingManager.receiveMetrics({ averageNoiseReduction: 15 })).not.toThrow();
    });
  });

  describe('receiveMetrics', () => {
    it('should receive and store metrics', () => {
      const metrics = {
        averageNoiseReduction: 15.5,
        totalFrames: 100,
        averageLatency: 5.2
      };
      
      recordingManager.receiveMetrics(metrics);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Received real metrics: 15.5% avg reduction')
      );
    });
  });

  describe('startCycle', () => {
    let mockProcessedStream: MediaStream;
    let mockOriginalStream: MediaStream;
    let onChunkProcessed: vi.Mock;
    let mediaRecorderInstances: any[] = [];

    beforeEach(() => {
      mockProcessedStream = {
        getTracks: vi.fn(() => [])
      } as any;
      
      mockOriginalStream = {
        getTracks: vi.fn(() => [])
      } as any;
      
      onChunkProcessed = vi.fn();
      
      // Enhanced MediaRecorder mock
      mediaRecorderInstances = [];
      (global.MediaRecorder as any) = vi.fn().mockImplementation((stream, options) => {
        const recorder = {
          start: vi.fn(),
          stop: vi.fn(),
          state: 'inactive',
          ondataavailable: null,
          onstop: null,
          onerror: null,
          stream,
          options
        };
        
        recorder.start = vi.fn(() => {
          recorder.state = 'recording';
        });
        
        recorder.stop = vi.fn(() => {
          recorder.state = 'inactive';
          if (recorder.onstop) recorder.onstop();
        });
        
        mediaRecorderInstances.push(recorder);
        return recorder;
      });
      
      // Mock processFileWithMetrics
      vi.mocked(processFileApi.processFileWithMetrics).mockResolvedValue({
        processedBlob: new Blob(['processed'], { type: 'audio/webm' }),
        metrics: {
          durationMs: 8000,
          noiseReduction: 15,
          vadEvents: [],
          processingTime: 100
        }
      });
    });

    it('should start recording cycle with correct parameters', async () => {
      await recordingManager.startCycle(
        mockProcessedStream,
        mockOriginalStream,
        8000,
        onChunkProcessed
      );
      
      expect(mediaRecorderInstances).toHaveLength(2);
      expect(mediaRecorderInstances[0].start).toHaveBeenCalledWith(1000);
      expect(mediaRecorderInstances[1].start).toHaveBeenCalledWith(1000);
    });

    it('should handle data from recorders', async () => {
      await recordingManager.startCycle(
        mockProcessedStream,
        mockOriginalStream,
        8000,
        onChunkProcessed
      );
      
      const processedRecorder = mediaRecorderInstances[0];
      const originalRecorder = mediaRecorderInstances[1];
      
      // Simulate valid data
      if (processedRecorder.ondataavailable) {
        processedRecorder.ondataavailable({
          data: new Blob(['x'.repeat(200)], { type: 'audio/webm' })
        });
      }
      
      if (originalRecorder.ondataavailable) {
        originalRecorder.ondataavailable({
          data: new Blob(['x'.repeat(200)], { type: 'audio/webm' })
        });
      }
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processed data: 200 bytes')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Original data: 200 bytes')
      );
    });

    it('should warn about invalid blob sizes', async () => {
      await recordingManager.startCycle(
        mockProcessedStream,
        mockOriginalStream,
        8000,
        onChunkProcessed
      );
      
      const processedRecorder = mediaRecorderInstances[0];
      
      // Simulate invalid data (too small)
      if (processedRecorder.ondataavailable) {
        processedRecorder.ondataavailable({
          data: new Blob(['x'], { type: 'audio/webm' }) // 1 byte
        });
      }
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid blob size detected'),
        expect.objectContaining({
          blobSize: 1,
          type: 'processed'
        })
      );
    });

    it('should handle recorder errors', async () => {
      await recordingManager.startCycle(
        mockProcessedStream,
        mockOriginalStream,
        8000,
        onChunkProcessed
      );
      
      const processedRecorder = mediaRecorderInstances[0];
      
      if (processedRecorder.onerror) {
        processedRecorder.onerror(new Error('Recorder failed'));
      }
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processed recorder error:'),
        expect.any(Error)
      );
    });

    it('should process chunk when recorder stops', async () => {
      await recordingManager.startCycle(
        mockProcessedStream,
        mockOriginalStream,
        8000,
        onChunkProcessed
      );
      
      const processedRecorder = mediaRecorderInstances[0];
      const originalRecorder = mediaRecorderInstances[1];
      
      // Add valid data
      if (processedRecorder.ondataavailable) {
        processedRecorder.ondataavailable({
          data: new Blob(['x'.repeat(500)], { type: 'audio/webm' })
        });
      }
      
      if (originalRecorder.ondataavailable) {
        originalRecorder.ondataavailable({
          data: new Blob(['x'.repeat(500)], { type: 'audio/webm' })
        });
      }
      
      // Trigger stop
      if (processedRecorder.onstop) {
        processedRecorder.onstop();
      }
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(onChunkProcessed).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^chunk-/),
          duration: 8,
          noiseRemoved: 15
        })
      );
    });

    it('should not process empty chunks', async () => {
      await recordingManager.startCycle(
        mockProcessedStream,
        mockOriginalStream,
        8000,
        onChunkProcessed
      );
      
      const processedRecorder = mediaRecorderInstances[0];
      
      // Don't add any data, just stop
      if (processedRecorder.onstop) {
        processedRecorder.onstop();
      }
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('discarded - no valid blobs collected')
      );
      expect(onChunkProcessed).not.toHaveBeenCalled();
    });
  });

  describe('stopRecording', () => {
    it('should stop all active recorders', async () => {
      const mockStream = { getTracks: vi.fn(() => []) } as any;
      let recorderInstance: any;
      
      (global.MediaRecorder as any) = vi.fn().mockImplementation(() => {
        recorderInstance = {
          start: vi.fn(() => { recorderInstance.state = 'recording'; }),
          stop: vi.fn(() => { recorderInstance.state = 'inactive'; }),
          state: 'inactive'
        };
        return recorderInstance;
      });
      
      await recordingManager.startCycle(mockStream, mockStream, 8000, vi.fn());
      
      recordingManager.stopRecording();
      
      expect(recorderInstance.stop).toHaveBeenCalled();
    });

    it('should set stop flag to prevent new cycles', async () => {
      vi.useFakeTimers();
      
      const mockStream = { getTracks: vi.fn(() => []) } as any;
      const onChunkProcessed = vi.fn();
      
      await recordingManager.startCycle(mockStream, mockStream, 1000, onChunkProcessed);
      
      recordingManager.stopRecording();
      
      // Advance time to see if new cycles start
      vi.advanceTimersByTime(5000);
      
      // Should only have initial recorders, no new ones
      expect(MediaRecorder).toHaveBeenCalledTimes(2); // Only initial pair
      
      vi.useRealTimers();
    });
  });

  describe('pauseRecording', () => {
    it('should pause active recorders', async () => {
      const mockStream = { getTracks: vi.fn(() => []) } as any;
      let recorderInstance: any;
      
      (global.MediaRecorder as any) = vi.fn().mockImplementation(() => {
        recorderInstance = {
          start: vi.fn(() => { recorderInstance.state = 'recording'; }),
          pause: vi.fn(() => { recorderInstance.state = 'paused'; }),
          state: 'inactive'
        };
        return recorderInstance;
      });
      
      await recordingManager.startCycle(mockStream, mockStream, 8000, vi.fn());
      
      recordingManager.pauseRecording();
      
      expect(recorderInstance.pause).toHaveBeenCalled();
    });
  });

  describe('resumeRecording', () => {
    it('should resume paused recorders', async () => {
      const mockStream = { getTracks: vi.fn(() => []) } as any;
      let recorderInstance: any;
      
      (global.MediaRecorder as any) = vi.fn().mockImplementation(() => {
        recorderInstance = {
          start: vi.fn(() => { recorderInstance.state = 'recording'; }),
          pause: vi.fn(() => { recorderInstance.state = 'paused'; }),
          resume: vi.fn(() => { recorderInstance.state = 'recording'; }),
          state: 'inactive'
        };
        return recorderInstance;
      });
      
      await recordingManager.startCycle(mockStream, mockStream, 8000, vi.fn());
      recorderInstance.state = 'paused'; // Simulate paused state
      
      recordingManager.resumeRecording();
      
      expect(recorderInstance.resume).toHaveBeenCalled();
    });
  });

  describe('startConcatenatedStreaming (legacy)', () => {
    it('should redirect to startCycle', async () => {
      const startCycleSpy = vi.spyOn(recordingManager, 'startCycle');
      const mockStream = { getTracks: vi.fn(() => []) } as any;
      const onChunkReady = vi.fn();
      
      await recordingManager.startConcatenatedStreaming(
        mockStream,
        mockStream,
        'audio/webm',
        8,
        onChunkReady
      );
      
      expect(startCycleSpy).toHaveBeenCalledWith(
        mockStream,
        mockStream,
        8000,
        onChunkReady
      );
    });
  });

  describe('Blob Size Validation', () => {
    it('should warn when empty blobs are received', async () => {
      let mediaRecorderInstance: any;
      let originalRecorderInstance: any;
      
      // Mock MediaRecorder
      (global.MediaRecorder as any) = vi.fn().mockImplementation((stream, options) => {
        const recorder = {
          start: vi.fn(),
          stop: vi.fn(),
          state: 'inactive',
          ondataavailable: null,
          onstop: null,
          onerror: null,
        };
        
        if (stream === processedStream) {
          mediaRecorderInstance = recorder;
        } else {
          originalRecorderInstance = recorder;
        }
        
        return recorder;
      });

      const processedStream = { getTracks: () => [] } as any;
      const originalStream = { getTracks: () => [] } as any;
      const onChunkProcessed = vi.fn();

      // Start recording
      await recordingManager.startCycle(
        processedStream,
        originalStream,
        8000,
        onChunkProcessed
      );

      // Simulate empty blob from MediaRecorder
      if (mediaRecorderInstance?.ondataavailable) {
        mediaRecorderInstance.ondataavailable({ 
          data: new Blob([], { type: 'audio/webm' }) 
        });
      }

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid blob size detected'),
        expect.objectContaining({
          blobSize: 0,
          type: 'processed'
        })
      );
    });

    it('should filter out blobs smaller than MIN_VALID_BLOB_SIZE', async () => {
      let mediaRecorderInstance: any;
      let onStopCallback: any;
      const capturedBlobs: Blob[] = [];
      
      (global.MediaRecorder as any) = vi.fn().mockImplementation((stream) => {
        const recorder = {
          start: vi.fn(),
          stop: vi.fn(() => {
            if (onStopCallback) onStopCallback();
          }),
          state: 'recording',
          ondataavailable: null,
          onstop: null,
          onerror: null,
        };
        
        if (stream === processedStream) {
          mediaRecorderInstance = recorder;
          // Capture onstop callback
          Object.defineProperty(recorder, 'onstop', {
            set: (callback) => { onStopCallback = callback; }
          });
        }
        
        return recorder;
      });

      const processedStream = { getTracks: () => [] } as any;
      const originalStream = { getTracks: () => [] } as any;
      const chunks: ProcessedChunk[] = [];
      const onChunkProcessed = (chunk: ProcessedChunk) => chunks.push(chunk);

      await recordingManager.startCycle(
        processedStream,
        originalStream,
        8000,
        onChunkProcessed
      );

      // Send various sized blobs
      if (mediaRecorderInstance?.ondataavailable) {
        // Too small - should be rejected
        mediaRecorderInstance.ondataavailable({ 
          data: new Blob(['x'], { type: 'audio/webm' }) // 1 byte
        });
        
        // Valid size - should be accepted
        mediaRecorderInstance.ondataavailable({ 
          data: new Blob(['x'.repeat(200)], { type: 'audio/webm' }) // 200 bytes
        });
      }

      // Trigger stop to process chunks
      recordingManager.stopRecording();

      // Should have warnings for small blobs
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid blob size detected'),
        expect.objectContaining({
          blobSize: 1
        })
      );
    });

    it('should not create chunks when all blobs are empty', async () => {
      let mediaRecorderInstance: any;
      let originalRecorderInstance: any;
      let onStopCallback: any;
      
      (global.MediaRecorder as any) = vi.fn().mockImplementation((stream) => {
        const recorder = {
          start: vi.fn(),
          stop: vi.fn(() => {
            if (onStopCallback && stream === processedStream) {
              onStopCallback();
            }
          }),
          state: 'recording',
          ondataavailable: null,
          onstop: null,
          onerror: null,
        };
        
        if (stream === processedStream) {
          mediaRecorderInstance = recorder;
          Object.defineProperty(recorder, 'onstop', {
            set: (callback) => { onStopCallback = callback; }
          });
        } else {
          originalRecorderInstance = recorder;
        }
        
        return recorder;
      });

      const processedStream = { getTracks: () => [] } as any;
      const originalStream = { getTracks: () => [] } as any;
      const chunks: ProcessedChunk[] = [];
      const onChunkProcessed = (chunk: ProcessedChunk) => chunks.push(chunk);

      await recordingManager.startCycle(
        processedStream,
        originalStream,
        8000,
        onChunkProcessed
      );

      // Send only empty blobs
      if (mediaRecorderInstance?.ondataavailable) {
        mediaRecorderInstance.ondataavailable({ 
          data: new Blob([], { type: 'audio/webm' }) 
        });
      }
      if (originalRecorderInstance?.ondataavailable) {
        originalRecorderInstance.ondataavailable({ 
          data: new Blob([], { type: 'audio/webm' }) 
        });
      }

      // Stop and check
      recordingManager.stopRecording();

      // No chunks should be created
      expect(chunks).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('discarded - no valid blobs collected')
      );
    });

    it('should handle mixed valid and invalid blob sizes correctly', async () => {
      let mediaRecorderInstance: any;
      let originalRecorderInstance: any;
      let processedOnStop: any;
      let originalOnStop: any;
      
      (global.MediaRecorder as any) = vi.fn().mockImplementation((stream) => {
        const recorder = {
          start: vi.fn(),
          stop: vi.fn(() => {
            if (stream === processedStream && processedOnStop) {
              processedOnStop();
            }
          }),
          state: 'recording',
          ondataavailable: null,
          onstop: null,
          onerror: null,
        };
        
        if (stream === processedStream) {
          mediaRecorderInstance = recorder;
          Object.defineProperty(recorder, 'onstop', {
            get: () => processedOnStop,
            set: (callback) => { processedOnStop = callback; }
          });
        } else {
          originalRecorderInstance = recorder;
          Object.defineProperty(recorder, 'onstop', {
            get: () => originalOnStop,
            set: (callback) => { originalOnStop = callback; }
          });
        }
        
        return recorder;
      });

      const processedStream = { getTracks: () => [] } as any;
      const originalStream = { getTracks: () => [] } as any;
      const chunks: ProcessedChunk[] = [];
      const onChunkProcessed = (chunk: ProcessedChunk) => chunks.push(chunk);

      await recordingManager.startCycle(
        processedStream,
        originalStream,
        8000,
        onChunkProcessed
      );

      // Send mixed blobs to processed recorder
      if (mediaRecorderInstance?.ondataavailable) {
        // Invalid - too small
        mediaRecorderInstance.ondataavailable({ 
          data: new Blob(['x'], { type: 'audio/webm' }) 
        });
        // Valid
        mediaRecorderInstance.ondataavailable({ 
          data: new Blob(['x'.repeat(500)], { type: 'audio/webm' }) 
        });
        // Invalid - empty
        mediaRecorderInstance.ondataavailable({ 
          data: new Blob([], { type: 'audio/webm' }) 
        });
      }

      // Send valid blob to original recorder
      if (originalRecorderInstance?.ondataavailable) {
        originalRecorderInstance.ondataavailable({ 
          data: new Blob(['x'.repeat(500)], { type: 'audio/webm' }) 
        });
      }

      // Trigger processing
      mediaRecorderInstance.state = 'inactive';
      if (processedOnStop) processedOnStop();

      // Should create chunk with only valid blobs
      expect(chunks).toHaveLength(1);
      expect(chunks[0].processedSize).toBe(500);
      expect(chunks[0].originalSize).toBe(500);
      expect(chunks[0].isValid).toBe(true);
    });
  });

  describe('Bug: Stop Recording no detiene la grabación', () => {
    it('debe detener completamente la grabación cuando se llama stopRecording', async () => {
      vi.useFakeTimers();
      
      const processedStream = new MediaStream();
      const originalStream = new MediaStream();
      const onChunkProcessed = vi.fn();
      
      let mediaRecorderInstance: any;
      
      // Mock MediaRecorder más completo
      (global.MediaRecorder as any) = vi.fn().mockImplementation((stream) => {
        const recorder = {
          start: vi.fn(),
          stop: vi.fn(),
          state: 'inactive',
          ondataavailable: null,
          onstop: null,
        };
        
        recorder.start = vi.fn(() => {
          recorder.state = 'recording';
        });
        
        recorder.stop = vi.fn(() => {
          recorder.state = 'inactive';
          if (recorder.onstop) recorder.onstop();
        });
        
        if (stream === processedStream) {
          mediaRecorderInstance = recorder;
        }
        
        return recorder;
      });
      
      // Iniciar grabación
      await recordingManager.startCycle(
        processedStream,
        originalStream,
        5000, // 5 segundos por chunk
        onChunkProcessed
      );
      
      // Verificar que está grabando
      expect(mediaRecorderInstance.state).toBe('recording');
      
      // Stop recording inmediatamente
      recordingManager.stopRecording();
      
      // Avanzar tiempo para verificar que no se inician nuevos ciclos
      vi.advanceTimersByTime(10000); // 10 segundos
      
      // No debería haber llamadas a onChunkProcessed porque se detuvo
      expect(onChunkProcessed).not.toHaveBeenCalled();
      
      vi.useRealTimers();
    });
  });

  describe('Bug: Solo aparece un chunk cuando deberían ser varios', () => {
    it('debe procesar múltiples chunks correctamente', async () => {
      vi.useFakeTimers();
      
      const processedStream = new MediaStream();
      const originalStream = new MediaStream();
      const chunks: ProcessedChunk[] = [];
      const onChunkProcessed = vi.fn((chunk: ProcessedChunk) => {
        chunks.push(chunk);
      });
      
      // Mock MediaRecorder que simula grabación real
      (global.MediaRecorder as any) = vi.fn().mockImplementation((stream) => {
        const recorder = {
          start: vi.fn(),
          stop: vi.fn(),
          state: 'inactive',
          ondataavailable: null,
          onstop: null,
        };
        
        recorder.start = vi.fn(() => {
          recorder.state = 'recording';
        });
        
        recorder.stop = vi.fn(() => {
          recorder.state = 'inactive';
          // Simular data disponible
          if (recorder.ondataavailable) {
            recorder.ondataavailable({ 
              data: new Blob(['test-data'], { type: 'audio/webm' }) 
            });
          }
          if (recorder.onstop) {
            recorder.onstop();
          }
        });
        
        return recorder;
      });
      
      // Iniciar grabación con chunks de 2 segundos
      await recordingManager.startCycle(
        processedStream,
        originalStream,
        2000,
        onChunkProcessed
      );
      
      // Simular 3 ciclos completos
      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(2000); // Duración del chunk
        vi.advanceTimersByTime(500);  // Delay entre ciclos
      }
      
      // Detener grabación
      recordingManager.stopRecording();
      
      // Verificar que se procesaron múltiples chunks
      console.log('Chunks procesados:', chunks.length);
      expect(chunks.length).toBeGreaterThanOrEqual(2); // Al menos 2 chunks
      
      vi.useRealTimers();
    });
  });
});