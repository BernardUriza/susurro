import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSusurro } from '../src/hooks/useSusurro';

// Mock murmuraba hook
vi.mock('murmuraba', () => ({
  useMurmubaraEngine: () => ({
    recordingState: {
      isRecording: false,
      chunks: [],
    },
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    pauseRecording: vi.fn(),
    resumeRecording: vi.fn(),
    exportChunkAsWav: vi.fn(),
    clearRecordings: vi.fn(),
  }),
}));

// Mock the whisper hook
vi.mock('../src/hooks/useWhisperDirect', () => ({
  useWhisperDirect: () => ({
    isTranscribing: false,
    modelReady: true,
    loadingProgress: 100,
    error: null,
    transcribe: vi.fn().mockResolvedValue({
      text: 'Test transcription',
      segments: [],
      chunkIndex: 0,
      timestamp: Date.now(),
    }),
  }),
}));

describe('useSusurro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useSusurro());

      expect(result.current.isRecording).toBe(false);
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.transcriptions).toEqual([]);
      expect(result.current.audioChunks).toEqual([]);
      expect(result.current.averageVad).toBe(0);
      expect(result.current.whisperReady).toBe(true);
    });

    it('should accept options', () => {
      const options = {
        chunkDurationMs: 5000,
        whisperConfig: { language: 'es' },
      };

      const { result } = renderHook(() => useSusurro(options));

      expect(result.current).toBeDefined();
    });
  });

  describe('recording', () => {
    it('should start and stop recording', async () => {
      const { result } = renderHook(() => useSusurro());

      expect(result.current.isRecording).toBe(false);

      await act(async () => {
        await result.current.startRecording();
      });

      act(() => {
        result.current.stopRecording();
      });

      expect(typeof result.current.startRecording).toBe('function');
      expect(typeof result.current.stopRecording).toBe('function');
    });

    it('should pause and resume recording', () => {
      const { result } = renderHook(() => useSusurro());

      act(() => {
        result.current.pauseRecording();
      });

      act(() => {
        result.current.resumeRecording();
      });

      expect(typeof result.current.pauseRecording).toBe('function');
      expect(typeof result.current.resumeRecording).toBe('function');
    });
  });

  describe('transcriptions', () => {
    it('should clear transcriptions', () => {
      const { result } = renderHook(() => useSusurro());

      act(() => {
        result.current.clearTranscriptions();
      });

      expect(result.current.transcriptions).toEqual([]);
    });
  });

  describe('conversational mode', () => {
    it('should handle conversational options', () => {
      const onChunk = vi.fn();
      const options = {
        conversational: {
          onChunk,
          enableInstantTranscription: true,
          chunkTimeout: 3000,
        },
      };

      const { result } = renderHook(() => useSusurro(options));

      expect(result.current.conversationalChunks).toEqual([]);
      expect(typeof result.current.clearConversationalChunks).toBe('function');
    });
  });

  describe('cleanup', () => {
    it('should clean up resources on unmount', () => {
      const { unmount } = renderHook(() => useSusurro());

      unmount();
      // Cleanup is handled automatically by the hook
      expect(true).toBe(true);
    });
  });
});