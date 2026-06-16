import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRecordingFunctions } from '../../../hooks/murmuraba-engine/recording-functions';
import { ProcessedChunk, RecordingState } from '../../../hooks/murmuraba-engine/types';
import { StreamController } from '../../../types';
import * as api from '../../../api';
import { DEFAULT_CHUNK_DURATION } from '../../../hooks/murmuraba-engine/constants';

// Mock dependencies
vi.mock('../../../api');
vi.mock('../../../hooks/murmuraba-engine/logger');

describe('recordingFunctions', () => {
  // Test fixtures
  let mockMediaStream: MediaStream;
  let mockStreamController: StreamController;
  let mockRecordingState: RecordingState;
  let mockRecordingStateHook: any;
  let mockChunkManager: any;
  let mockRecordingManager: any;
  let mockSetters: any;
  let mockInitialize: vi.Mock;

  beforeEach(() => {
    // Setup MediaStream mock
    const mockTrack = {
      kind: 'audio',
      enabled: true,
      readyState: 'live',
      label: 'test-microphone',
      stop: vi.fn()
    };
    
    mockMediaStream = {
      id: 'test-stream-id',
      getTracks: vi.fn(() => [mockTrack]),
      getAudioTracks: vi.fn(() => [mockTrack])
    } as any;

    // Setup StreamController mock
    mockStreamController = {
      stream: {
        id: 'processed-stream-id',
        getAudioTracks: vi.fn(() => [{ kind: 'audio' }])
      } as any,
      destroy: vi.fn()
    };

    // Setup RecordingState
    mockRecordingState = {
      isRecording: false,
      isPaused: false,
      chunks: [],
      recordingTime: 0
    };

    // Setup recording state hook mock
    mockRecordingStateHook = {
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      pauseRecording: vi.fn(),
      resumeRecording: vi.fn(),
      addChunk: vi.fn(),
      clearRecordings: vi.fn(),
      updateRecordingTime: vi.fn()
    };

    // Setup managers
    mockChunkManager = {
      clearChunks: vi.fn()
    };

    mockRecordingManager = {
      startCycle: vi.fn(),
      stopRecording: vi.fn(),
      pauseRecording: vi.fn(),
      resumeRecording: vi.fn()
    };

    // Setup setters
    mockSetters = {
      setCurrentStream: vi.fn(),
      setOriginalStream: vi.fn(),
      setStreamController: vi.fn(),
      setError: vi.fn()
    };

    // Setup initialize
    mockInitialize = vi.fn().mockResolvedValue(undefined);

    // Mock getUserMedia
    global.navigator = {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockMediaStream)
      }
    } as any;

    // Mock processStream API
    vi.mocked(api.processStream).mockResolvedValue(mockStreamController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createRecordingFunctions', () => {
    it('should create all recording functions', () => {
      const functions = createRecordingFunctions({
        isInitialized: true,
        recordingState: mockRecordingState,
        recordingStateHook: mockRecordingStateHook,
        currentStream: null,
        originalStream: null,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      expect(functions).toHaveProperty('startRecording');
      expect(functions).toHaveProperty('stopRecording');
      expect(functions).toHaveProperty('pauseRecording');
      expect(functions).toHaveProperty('resumeRecording');
      expect(functions).toHaveProperty('clearRecordings');
    });
  });

  describe('startRecording', () => {
    it('should initialize engine if not initialized', async () => {
      const functions = createRecordingFunctions({
        isInitialized: false,
        recordingState: mockRecordingState,
        recordingStateHook: mockRecordingStateHook,
        currentStream: null,
        originalStream: null,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      await functions.startRecording();

      expect(mockInitialize).toHaveBeenCalled();
    });

    it('should throw error if initialization fails', async () => {
      const initError = new Error('Init failed');
      mockInitialize.mockRejectedValue(initError);

      const functions = createRecordingFunctions({
        isInitialized: false,
        recordingState: mockRecordingState,
        recordingStateHook: mockRecordingStateHook,
        currentStream: null,
        originalStream: null,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      await expect(functions.startRecording()).rejects.toThrow('Failed to initialize audio engine: Init failed');
      expect(mockSetters.setError).toHaveBeenCalledWith('Failed to initialize audio engine: Init failed');
    });

    it('should request microphone with correct constraints', async () => {
      const functions = createRecordingFunctions({
        isInitialized: true,
        recordingState: mockRecordingState,
        recordingStateHook: mockRecordingStateHook,
        currentStream: null,
        originalStream: null,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      await functions.startRecording();

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
    });

    it('should process stream and setup controllers', async () => {
      const functions = createRecordingFunctions({
        isInitialized: true,
        recordingState: mockRecordingState,
        recordingStateHook: mockRecordingStateHook,
        currentStream: null,
        originalStream: null,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      await functions.startRecording();

      expect(api.processStream).toHaveBeenCalledWith(mockMediaStream);
      expect(mockSetters.setOriginalStream).toHaveBeenCalledWith(mockMediaStream);
      expect(mockSetters.setStreamController).toHaveBeenCalledWith(mockStreamController);
      expect(mockSetters.setCurrentStream).toHaveBeenCalledWith(mockMediaStream);
    });

    it('should start recording state and cycle', async () => {
      const functions = createRecordingFunctions({
        isInitialized: true,
        recordingState: mockRecordingState,
        recordingStateHook: mockRecordingStateHook,
        currentStream: null,
        originalStream: null,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      const chunkDuration = 8000;
      await functions.startRecording(chunkDuration);

      expect(mockRecordingStateHook.startRecording).toHaveBeenCalled();
      expect(mockRecordingManager.startCycle).toHaveBeenCalledWith(
        mockStreamController.stream,
        mockMediaStream,
        chunkDuration,
        expect.any(Function)
      );
    });

    it('should handle chunk processing callback', async () => {
      const functions = createRecordingFunctions({
        isInitialized: true,
        recordingState: mockRecordingState,
        recordingStateHook: mockRecordingStateHook,
        currentStream: null,
        originalStream: null,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      await functions.startRecording();

      // Get the chunk callback
      const chunkCallback = mockRecordingManager.startCycle.mock.calls[0][3];
      
      const testChunk: ProcessedChunk = {
        id: 'chunk-1',
        processedUrl: 'blob:processed',
        originalUrl: 'blob:original',
        duration: 8.0,
        startTime: 0,
        endTime: 8000,
        vadEvents: [],
        processingTime: 100,
        noiseRemoved: 15
      };

      chunkCallback(testChunk);

      expect(mockRecordingStateHook.addChunk).toHaveBeenCalledWith(testChunk);
    });

    it('should handle getUserMedia errors', async () => {
      const mediaError = new Error('Permission denied');
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(mediaError);

      const functions = createRecordingFunctions({
        isInitialized: true,
        recordingState: mockRecordingState,
        recordingStateHook: mockRecordingStateHook,
        currentStream: null,
        originalStream: null,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      await expect(functions.startRecording()).rejects.toThrow('Permission denied');
      expect(mockSetters.setError).toHaveBeenCalledWith('Permission denied');
    });
  });

  describe('stopRecording', () => {
    it('should stop recording manager', () => {
      const functions = createRecordingFunctions({
        isInitialized: true,
        recordingState: mockRecordingState,
        recordingStateHook: mockRecordingStateHook,
        currentStream: null,
        originalStream: null,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      functions.stopRecording();

      expect(mockRecordingManager.stopRecording).toHaveBeenCalled();
      expect(mockRecordingStateHook.stopRecording).toHaveBeenCalled();
    });

    it('should stop all tracks and cleanup streams', () => {
      const currentTrackStop = vi.fn();
      const originalTrackStop = vi.fn();
      
      const currentStream = {
        id: 'current-stream',
        getTracks: vi.fn(() => [{ stop: currentTrackStop }])
      };
      
      const originalStream = {
        id: 'original-stream',
        getTracks: vi.fn(() => [{ stop: originalTrackStop }])
      };

      const functions = createRecordingFunctions({
        isInitialized: true,
        recordingState: mockRecordingState,
        recordingStateHook: mockRecordingStateHook,
        currentStream,
        originalStream,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      functions.stopRecording();

      // Verify tracks were stopped
      expect(currentTrackStop).toHaveBeenCalled();
      expect(originalTrackStop).toHaveBeenCalled();

      // Verify cleanup
      expect(mockSetters.setCurrentStream).toHaveBeenCalledWith(null);
      expect(mockSetters.setOriginalStream).toHaveBeenCalledWith(null);
      expect(mockSetters.setStreamController).toHaveBeenCalledWith(null);
    });

    it('should handle case when no streams exist', () => {
      const functions = createRecordingFunctions({
        isInitialized: true,
        recordingState: mockRecordingState,
        recordingStateHook: mockRecordingStateHook,
        currentStream: null,
        originalStream: null,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      // Should not throw
      expect(() => functions.stopRecording()).not.toThrow();
      expect(mockRecordingManager.stopRecording).toHaveBeenCalled();
    });
  });

  describe('pauseRecording', () => {
    it('should pause recording through manager and state', () => {
      const functions = createRecordingFunctions({
        isInitialized: true,
        recordingState: mockRecordingState,
        recordingStateHook: mockRecordingStateHook,
        currentStream: null,
        originalStream: null,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      functions.pauseRecording();

      expect(mockRecordingManager.pauseRecording).toHaveBeenCalled();
      expect(mockRecordingStateHook.pauseRecording).toHaveBeenCalled();
    });
  });

  describe('resumeRecording', () => {
    it('should resume recording through manager and state', () => {
      const functions = createRecordingFunctions({
        isInitialized: true,
        recordingState: mockRecordingState,
        recordingStateHook: mockRecordingStateHook,
        currentStream: null,
        originalStream: null,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      functions.resumeRecording();

      expect(mockRecordingManager.resumeRecording).toHaveBeenCalled();
      expect(mockRecordingStateHook.resumeRecording).toHaveBeenCalled();
    });
  });

  describe('clearRecordings', () => {
    it('should stop recording if active', () => {
      const activeRecordingState = { ...mockRecordingState, isRecording: true };
      
      const functions = createRecordingFunctions({
        isInitialized: true,
        recordingState: activeRecordingState,
        recordingStateHook: mockRecordingStateHook,
        currentStream: mockMediaStream,
        originalStream: mockMediaStream,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      functions.clearRecordings();

      expect(mockRecordingManager.stopRecording).toHaveBeenCalled();
      expect(mockRecordingStateHook.stopRecording).toHaveBeenCalled();
    });

    it('should clear chunks and state', () => {
      const testChunks: ProcessedChunk[] = [
        {
          id: 'chunk-1',
          processedUrl: 'blob:1',
          originalUrl: 'blob:2',
          duration: 8,
          startTime: 0,
          endTime: 8000,
          vadEvents: [],
          processingTime: 100,
          noiseRemoved: 10
        }
      ];

      const stateWithChunks = { ...mockRecordingState, chunks: testChunks };

      const functions = createRecordingFunctions({
        isInitialized: true,
        recordingState: stateWithChunks,
        recordingStateHook: mockRecordingStateHook,
        currentStream: null,
        originalStream: null,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      functions.clearRecordings();

      expect(mockChunkManager.clearChunks).toHaveBeenCalledWith(testChunks);
      expect(mockRecordingStateHook.clearRecordings).toHaveBeenCalled();
    });

    it('should not stop recording if not active', () => {
      const functions = createRecordingFunctions({
        isInitialized: true,
        recordingState: mockRecordingState,
        recordingStateHook: mockRecordingStateHook,
        currentStream: null,
        originalStream: null,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      functions.clearRecordings();

      // Should still clear chunks but not stop recording
      expect(mockRecordingManager.stopRecording).not.toHaveBeenCalled();
      expect(mockChunkManager.clearChunks).toHaveBeenCalled();
      expect(mockRecordingStateHook.clearRecordings).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle non-Error exceptions in startRecording', async () => {
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue('String error');

      const functions = createRecordingFunctions({
        isInitialized: true,
        recordingState: mockRecordingState,
        recordingStateHook: mockRecordingStateHook,
        currentStream: null,
        originalStream: null,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      await expect(functions.startRecording()).rejects.toBe('String error');
      expect(mockSetters.setError).toHaveBeenCalledWith('Failed to start recording');
    });

    it('should use default chunk duration if not provided', async () => {
      const functions = createRecordingFunctions({
        isInitialized: true,
        recordingState: mockRecordingState,
        recordingStateHook: mockRecordingStateHook,
        currentStream: null,
        originalStream: null,
        ...mockSetters,
        chunkManager: mockChunkManager,
        recordingManager: mockRecordingManager,
        initialize: mockInitialize
      });

      await functions.startRecording(); // No duration provided

      expect(mockRecordingManager.startCycle).toHaveBeenCalledWith(
        mockStreamController.stream,
        mockMediaStream,
        DEFAULT_CHUNK_DURATION, // 8 seconds
        expect.any(Function)
      );
    });
  });
});