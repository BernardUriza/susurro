/**
 * Tests for useTripleTranscription Hook
 *
 * Architecture: 3 streams feeding one refiner
 * ────────────────────────────────────
 * WebSpeech (from useWebSpeech)   ──┐
 * Whisper   (internal state)      ──┤──→ refineFunction ──→ refinedText
 * Deepgram  (from useDualTranscription) ──┘
 *
 * webSpeechText and deepgramText are DERIVED from sub-hooks (read-only here),
 * so these tests mock the sub-hooks and drive text through the real channels:
 * the mock transcript/deepgramText, and addWhisperChunk for whisper.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTripleTranscription } from '../src/hooks/use-triple-transcription';

let mockWebSpeechTranscript = '';
let mockDeepgramText = '';

vi.mock('../src/hooks/use-web-speech', () => ({
  useWebSpeech: () => {
    const [isListening, setIsListening] = React.useState(false);
    return {
      isSupported: true,
      isListening,
      transcript: mockWebSpeechTranscript,
      interimTranscript: '',
      finalTranscript: mockWebSpeechTranscript,
      error: null,
      startListening: () => setIsListening(true),
      stopListening: () => setIsListening(false),
      resetTranscript: () => {
        mockWebSpeechTranscript = '';
      },
      lastResult: null,
    };
  },
}));

vi.mock('../src/hooks/use-dual-transcription', () => ({
  useDualTranscription: () => {
    const [isTranscribing, setIsTranscribing] = React.useState(false);
    return {
      startTranscription: () => setIsTranscribing(true),
      stopTranscription: async () => {
        setIsTranscribing(false);
        return null;
      },
      resetTranscription: () => {
        mockDeepgramText = '';
      },
      isTranscribing,
      webSpeechText: '',
      deepgramText: mockDeepgramText,
      refinedText: null,
      isRefining: false,
      refineWithClaude: async () => '',
      currentResult: null,
      results: [],
      error: null,
      addDeepgramChunk: undefined,
    };
  },
}));

describe('useTripleTranscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWebSpeechTranscript = '';
    mockDeepgramText = '';
  });

  describe('Initialization', () => {
    it('should initialize with 3 empty text states', () => {
      const { result } = renderHook(() => useTripleTranscription());

      expect(result.current.webSpeechText).toBe('');
      expect(result.current.whisperText).toBe('');
      expect(result.current.deepgramText).toBe('');
      expect(result.current.refinedText).toBe('');
    });

    it('should initialize with all streams inactive', () => {
      const { result } = renderHook(() => useTripleTranscription());

      expect(result.current.isTranscribing).toBe(false);
      expect(result.current.isRefining).toBe(false);
    });

    it('should accept configuration for all 3 streams', () => {
      const { result } = renderHook(() =>
        useTripleTranscription({
          language: 'es-ES',
          enableWebSpeech: true,
          enableWhisper: true,
          enableDeepgram: true,
          autoRefine: false,
        })
      );

      expect(result.current).toBeDefined();
    });
  });

  describe('3-Stream Architecture', () => {
    it('should report transcribing once streams start', async () => {
      const { result } = renderHook(() => useTripleTranscription({ autoRefine: false }));

      await act(async () => {
        await result.current.startTranscription();
      });

      expect(result.current.isTranscribing).toBe(true);
    });

    it('should derive WebSpeech text from its stream', () => {
      mockWebSpeechTranscript = 'WebSpeech transcription';
      const { result } = renderHook(() => useTripleTranscription({ autoRefine: false }));

      expect(result.current.webSpeechText).toBe('WebSpeech transcription');
      expect(result.current.whisperText).toBe('');
      expect(result.current.deepgramText).toBe('');
    });

    it('should update Whisper text through addWhisperChunk', () => {
      const { result } = renderHook(() => useTripleTranscription({ autoRefine: false }));

      act(() => {
        result.current.addWhisperChunk?.('Whisper transcription');
      });

      expect(result.current.whisperText).toBe('Whisper transcription');
      expect(result.current.webSpeechText).toBe('');
      expect(result.current.deepgramText).toBe('');
    });

    it('should derive Deepgram text from its stream', () => {
      mockDeepgramText = 'Deepgram transcription';
      const { result } = renderHook(() => useTripleTranscription({ autoRefine: false }));

      expect(result.current.deepgramText).toBe('Deepgram transcription');
      expect(result.current.webSpeechText).toBe('');
      expect(result.current.whisperText).toBe('');
    });

    it('should allow all 3 streams to have text simultaneously', () => {
      mockWebSpeechTranscript = 'Web version';
      mockDeepgramText = 'Deepgram version';
      const { result } = renderHook(() => useTripleTranscription({ autoRefine: false }));

      act(() => {
        result.current.addWhisperChunk?.('Whisper version');
      });

      expect(result.current.webSpeechText).toBe('Web version');
      expect(result.current.whisperText).toBe('Whisper version');
      expect(result.current.deepgramText).toBe('Deepgram version');
    });
  });

  describe('Refiner with 3 Inputs', () => {
    it('should send all 3 texts to refiner', async () => {
      const mockRefine = vi.fn().mockResolvedValue('Refined output');
      mockWebSpeechTranscript = 'Web text';
      mockDeepgramText = 'Deepgram text';

      const { result } = renderHook(() =>
        useTripleTranscription({ autoRefine: false, refineFunction: mockRefine })
      );

      act(() => {
        result.current.addWhisperChunk?.('Whisper text');
      });

      await act(async () => {
        await result.current.refineWithClaude();
      });

      expect(mockRefine).toHaveBeenCalledWith({
        webSpeech: 'Web text',
        whisper: 'Whisper text',
        deepgram: 'Deepgram text',
      });
    });

    it('should update refined text when refiner completes', async () => {
      const mockRefine = vi.fn().mockResolvedValue('Beautiful refined text');
      mockWebSpeechTranscript = 'Web';

      const { result } = renderHook(() =>
        useTripleTranscription({ autoRefine: false, refineFunction: mockRefine })
      );

      await act(async () => {
        await result.current.refineWithClaude();
      });

      expect(result.current.refinedText).toBe('Beautiful refined text');
    });

    it('should set isRefining state during refinement', async () => {
      const mockRefine = vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('Done'), 50)));
      mockWebSpeechTranscript = 'Text';

      const { result } = renderHook(() =>
        useTripleTranscription({ autoRefine: false, refineFunction: mockRefine })
      );

      let refinePromise: Promise<void>;
      act(() => {
        refinePromise = result.current.refineWithClaude();
      });

      expect(result.current.isRefining).toBe(true);

      await act(async () => {
        await refinePromise;
      });

      expect(result.current.isRefining).toBe(false);
    });

    it('should handle partial inputs (some streams empty)', async () => {
      const mockRefine = vi.fn().mockResolvedValue('Partial refined');
      mockWebSpeechTranscript = 'Web text';
      mockDeepgramText = 'Deepgram text';

      const { result } = renderHook(() =>
        useTripleTranscription({ autoRefine: false, refineFunction: mockRefine })
      );

      await act(async () => {
        await result.current.refineWithClaude();
      });

      expect(mockRefine).toHaveBeenCalledWith({
        webSpeech: 'Web text',
        whisper: '',
        deepgram: 'Deepgram text',
      });
    });

    it('should not prioritize any stream over others', async () => {
      const mockRefine = vi.fn().mockImplementation((inputs) => {
        expect(Object.keys(inputs)).toHaveLength(3);
        expect(inputs).toHaveProperty('webSpeech');
        expect(inputs).toHaveProperty('whisper');
        expect(inputs).toHaveProperty('deepgram');
        return Promise.resolve('Equal treatment');
      });
      mockWebSpeechTranscript = 'A';
      mockDeepgramText = 'C';

      const { result } = renderHook(() =>
        useTripleTranscription({ autoRefine: false, refineFunction: mockRefine })
      );

      act(() => {
        result.current.addWhisperChunk?.('B');
      });

      await act(async () => {
        await result.current.refineWithClaude();
      });

      expect(mockRefine).toHaveBeenCalled();
    });
  });

  describe('Auto-Refinement', () => {
    it('should auto-refine when a stream has text', async () => {
      const mockRefine = vi.fn().mockResolvedValue('Auto refined');
      mockWebSpeechTranscript = 'New text';

      renderHook(() =>
        useTripleTranscription({
          autoRefine: true,
          refineDebounceMs: 50,
          refineFunction: mockRefine,
        })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 120));
      });

      expect(mockRefine).toHaveBeenCalled();
    });

    it('should debounce auto-refinement to avoid excessive calls', async () => {
      const mockRefine = vi.fn().mockResolvedValue('Debounced');
      mockWebSpeechTranscript = 'Update 1';

      const { rerender } = renderHook(() =>
        useTripleTranscription({
          autoRefine: true,
          refineDebounceMs: 300,
          refineFunction: mockRefine,
        })
      );

      act(() => {
        mockWebSpeechTranscript = 'Update 2';
        rerender();
        mockWebSpeechTranscript = 'Update 3';
        rerender();
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 350));
      });

      expect(mockRefine).toHaveBeenCalledTimes(1);
    });
  });

  describe('Stop and Cleanup', () => {
    it('should stop all 3 streams when stopTranscription is called', async () => {
      const { result } = renderHook(() => useTripleTranscription({ autoRefine: false }));

      await act(async () => {
        await result.current.startTranscription();
        await result.current.stopTranscription();
      });

      expect(result.current.isTranscribing).toBe(false);
    });

    it('should preserve text after stopping', async () => {
      mockWebSpeechTranscript = 'Preserved text';
      const { result } = renderHook(() => useTripleTranscription({ autoRefine: false }));

      await act(async () => {
        await result.current.startTranscription();
        await result.current.stopTranscription();
      });

      expect(result.current.webSpeechText).toBe('Preserved text');
    });

    it('should reset all texts when resetTranscription is called', async () => {
      mockWebSpeechTranscript = 'Web';
      mockDeepgramText = 'Deepgram';
      const { result } = renderHook(() => useTripleTranscription({ autoRefine: false }));

      act(() => {
        result.current.addWhisperChunk?.('Whisper');
      });

      act(() => {
        result.current.resetTranscription();
      });

      expect(result.current.webSpeechText).toBe('');
      expect(result.current.whisperText).toBe('');
      expect(result.current.deepgramText).toBe('');
      expect(result.current.refinedText).toBe('');
    });
  });

  describe('Error Handling', () => {
    it('should handle refiner errors gracefully', async () => {
      const mockRefine = vi.fn().mockRejectedValue(new Error('Refiner failed'));
      mockWebSpeechTranscript = 'Text';

      const { result } = renderHook(() =>
        useTripleTranscription({ autoRefine: false, refineFunction: mockRefine })
      );

      await act(async () => {
        await result.current.refineWithClaude();
      });

      expect(result.current.isRefining).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    it('should keep all stream texts when one stream is empty', async () => {
      mockWebSpeechTranscript = 'Success';
      mockDeepgramText = 'Success';
      const { result } = renderHook(() => useTripleTranscription({ autoRefine: false }));

      await act(async () => {
        await result.current.startTranscription();
      });

      expect(result.current.webSpeechText).toBe('Success');
      expect(result.current.whisperText).toBe('');
      expect(result.current.deepgramText).toBe('Success');
    });
  });
});
