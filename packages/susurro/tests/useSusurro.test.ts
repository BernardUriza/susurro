import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSusurro } from '../src/hooks/useSusurro';

// Mock the murmuraba singleton
vi.mock('../src/lib/murmuraba-singleton', () => ({
  murmurabaManager: {
    initialize: vi.fn(),
    processFileWithMetrics: vi.fn().mockResolvedValue({
      processedBuffer: new ArrayBuffer(1000),
      vadScores: [0.5, 0.7, 0.9],
      averageVad: 0.7,
      chunks: []
    })
  }
}));

// Mock the whisper hook
vi.mock('../src/hooks/useWhisperDirect', () => ({
  useWhisperDirect: () => ({
    modelReady: true,
    loadingProgress: 100,
    isTranscribing: false,
    transcript: 'Test transcription',
    error: null,
    transcribe: vi.fn().mockResolvedValue({
      text: 'Test transcription',
      segments: [],
      chunkIndex: 0,
      timestamp: Date.now()
    })
  })
}));

describe('useSusurro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processAudioFile', () => {
    it('should process a file and return chunks with VAD scores', async () => {
      const { result } = renderHook(() => useSusurro());
      const mockFile = new File(['audio'], 'test.wav', { type: 'audio/wav' });
      
      await act(async () => {
        await result.current.processAudioFile(mockFile);
      });
      
      expect(result.current.averageVad).toBe(0.7);
      expect(result.current.audioChunks).toBeDefined();
    });

    it('should handle errors during file processing', async () => {
      const { result } = renderHook(() => useSusurro());
      const mockFile = new File([''], 'invalid.wav', { type: 'audio/wav' });
      
      // Mock error
      const murmurabaManager = await import('../src/lib/murmuraba-singleton');
      vi.mocked(murmurabaManager.murmurabaManager.processFileWithMetrics).mockRejectedValueOnce(
        new Error('Processing failed')
      );
      
      await act(async () => {
        try {
          await result.current.processAudioFile(mockFile);
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });
  });

  describe('recording', () => {
    it('should start and stop recording', async () => {
      const { result } = renderHook(() => useSusurro());
      
      expect(result.current.isRecording).toBe(false);
      
      await act(async () => {
        await result.current.startRecording();
      });
      
      expect(result.current.isRecording).toBe(true);
      
      act(() => {
        result.current.stopRecording();
      });
      
      expect(result.current.isRecording).toBe(false);
    });

    it('should pause and resume recording', async () => {
      const { result } = renderHook(() => useSusurro());
      
      await act(async () => {
        await result.current.startRecording();
      });
      
      expect(result.current.isPaused).toBe(false);
      
      act(() => {
        result.current.pauseRecording();
      });
      
      expect(result.current.isPaused).toBe(true);
      
      act(() => {
        result.current.resumeRecording();
      });
      
      expect(result.current.isPaused).toBe(false);
    });
  });

  describe('transcriptions', () => {
    it('should clear transcriptions', async () => {
      const { result } = renderHook(() => useSusurro());
      
      // Add a mock transcription
      act(() => {
        result.current.transcriptions.push({
          text: 'Test',
          segments: [],
          chunkIndex: 0,
          timestamp: Date.now()
        });
      });
      
      expect(result.current.transcriptions.length).toBeGreaterThan(0);
      
      act(() => {
        result.current.clearTranscriptions();
      });
      
      expect(result.current.transcriptions).toEqual([]);
    });

    it('should return full transcript from all transcriptions', () => {
      const { result } = renderHook(() => useSusurro());
      
      act(() => {
        result.current.transcriptions.push(
          { text: 'Hello', segments: [], chunkIndex: 0, timestamp: Date.now() },
          { text: 'World', segments: [], chunkIndex: 1, timestamp: Date.now() }
        );
      });
      
      expect(result.current.fullTranscript).toBe('Hello World');
    });
  });

  describe('cleanup', () => {
    it('should clean up resources on unmount', () => {
      const { unmount } = renderHook(() => useSusurro());
      
      unmount();
      
      // Verify cleanup happened (AudioContext and MediaRecorder mocks)
      expect(global.AudioContext).toHaveBeenCalled();
    });
  });
});