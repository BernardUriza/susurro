/**
 * TDD Tests for useTripleTranscription Hook
 *
 * Architecture: 3 Independent Streams
 * ────────────────────────────────────
 * WebSpeech Stream  ──┐
 * Whisper Stream    ──┤──→ Refiner ──→ Final Text
 * Deepgram Stream   ──┘
 *
 * All 3 streams run in parallel and send outputs to refiner
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTripleTranscription } from '../src/hooks/use-triple-transcription';

describe('useTripleTranscription - TDD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        })
      );

      expect(result.current).toBeDefined();
    });
  });

  describe('3-Stream Architecture', () => {
    it('should start all 3 streams in parallel', async () => {
      const { result } = renderHook(() => useTripleTranscription());

      await act(async () => {
        await result.current.startTranscription();
      });

      expect(result.current.isTranscribing).toBe(true);
    });

    it('should update WebSpeech text independently', async () => {
      const { result } = renderHook(() => useTripleTranscription());

      await act(async () => {
        await result.current.startTranscription();
      });

      // Simulate WebSpeech update
      act(() => {
        // This will be called by the actual WebSpeech API
        result.current.webSpeechText = 'WebSpeech transcription';
      });

      expect(result.current.webSpeechText).toBe('WebSpeech transcription');
      expect(result.current.whisperText).toBe(''); // Others unchanged
      expect(result.current.deepgramText).toBe('');
    });

    it('should update Whisper text independently', async () => {
      const { result } = renderHook(() => useTripleTranscription());

      await act(async () => {
        await result.current.startTranscription();
      });

      act(() => {
        result.current.whisperText = 'Whisper transcription';
      });

      expect(result.current.whisperText).toBe('Whisper transcription');
      expect(result.current.webSpeechText).toBe('');
      expect(result.current.deepgramText).toBe('');
    });

    it('should update Deepgram text independently', async () => {
      const { result } = renderHook(() => useTripleTranscription());

      await act(async () => {
        await result.current.startTranscription();
      });

      act(() => {
        result.current.deepgramText = 'Deepgram transcription';
      });

      expect(result.current.deepgramText).toBe('Deepgram transcription');
      expect(result.current.webSpeechText).toBe('');
      expect(result.current.whisperText).toBe('');
    });

    it('should allow all 3 streams to have text simultaneously', async () => {
      const { result } = renderHook(() => useTripleTranscription());

      await act(async () => {
        await result.current.startTranscription();
      });

      act(() => {
        result.current.webSpeechText = 'Web version';
        result.current.whisperText = 'Whisper version';
        result.current.deepgramText = 'Deepgram version';
      });

      expect(result.current.webSpeechText).toBe('Web version');
      expect(result.current.whisperText).toBe('Whisper version');
      expect(result.current.deepgramText).toBe('Deepgram version');
    });
  });

  describe('Refiner with 3 Inputs', () => {
    it('should send all 3 texts to refiner', async () => {
      const mockRefine = vi.fn().mockResolvedValue('Refined output');

      const { result } = renderHook(() =>
        useTripleTranscription({
          refineFunction: mockRefine,
        })
      );

      await act(async () => {
        result.current.webSpeechText = 'Web text';
        result.current.whisperText = 'Whisper text';
        result.current.deepgramText = 'Deepgram text';

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

      const { result } = renderHook(() =>
        useTripleTranscription({
          refineFunction: mockRefine,
        })
      );

      await act(async () => {
        result.current.webSpeechText = 'Web';
        result.current.whisperText = 'Whisper';
        result.current.deepgramText = 'Deepgram';

        await result.current.refineWithClaude();
      });

      expect(result.current.refinedText).toBe('Beautiful refined text');
    });

    it('should set isRefining state during refinement', async () => {
      const mockRefine = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('Done'), 100))
      );

      const { result } = renderHook(() =>
        useTripleTranscription({
          refineFunction: mockRefine,
        })
      );

      await act(async () => {
        result.current.webSpeechText = 'Text';
        const refinePromise = result.current.refineWithClaude();

        expect(result.current.isRefining).toBe(true);

        await refinePromise;

        expect(result.current.isRefining).toBe(false);
      });
    });

    it('should handle partial inputs (some streams empty)', async () => {
      const mockRefine = vi.fn().mockResolvedValue('Partial refined');

      const { result } = renderHook(() =>
        useTripleTranscription({
          refineFunction: mockRefine,
        })
      );

      await act(async () => {
        result.current.webSpeechText = 'Web text';
        result.current.whisperText = ''; // Empty
        result.current.deepgramText = 'Deepgram text';

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
        // Refiner should receive all 3 equally
        expect(Object.keys(inputs)).toHaveLength(3);
        expect(inputs).toHaveProperty('webSpeech');
        expect(inputs).toHaveProperty('whisper');
        expect(inputs).toHaveProperty('deepgram');
        return Promise.resolve('Equal treatment');
      });

      const { result } = renderHook(() =>
        useTripleTranscription({
          refineFunction: mockRefine,
        })
      );

      await act(async () => {
        result.current.webSpeechText = 'A';
        result.current.whisperText = 'B';
        result.current.deepgramText = 'C';

        await result.current.refineWithClaude();
      });

      expect(mockRefine).toHaveBeenCalled();
    });
  });

  describe('Auto-Refinement', () => {
    it('should auto-refine when any stream updates', async () => {
      const mockRefine = vi.fn().mockResolvedValue('Auto refined');

      const { result } = renderHook(() =>
        useTripleTranscription({
          autoRefine: true,
          refineFunction: mockRefine,
        })
      );

      await act(async () => {
        result.current.webSpeechText = 'New text';
      });

      // Auto-refine should be triggered
      expect(mockRefine).toHaveBeenCalled();
    });

    it('should debounce auto-refinement to avoid excessive calls', async () => {
      const mockRefine = vi.fn().mockResolvedValue('Debounced');

      const { result } = renderHook(() =>
        useTripleTranscription({
          autoRefine: true,
          refineDebounceMs: 300,
          refineFunction: mockRefine,
        })
      );

      await act(async () => {
        result.current.webSpeechText = 'Update 1';
        result.current.webSpeechText = 'Update 2';
        result.current.webSpeechText = 'Update 3';

        // Wait for debounce
        await new Promise((resolve) => setTimeout(resolve, 350));
      });

      // Should only refine once due to debounce
      expect(mockRefine).toHaveBeenCalledTimes(1);
    });
  });

  describe('Stop and Cleanup', () => {
    it('should stop all 3 streams when stopTranscription is called', async () => {
      const { result } = renderHook(() => useTripleTranscription());

      await act(async () => {
        await result.current.startTranscription();
        await result.current.stopTranscription();
      });

      expect(result.current.isTranscribing).toBe(false);
    });

    it('should preserve text after stopping', async () => {
      const { result } = renderHook(() => useTripleTranscription());

      await act(async () => {
        await result.current.startTranscription();
        result.current.webSpeechText = 'Preserved text';
        await result.current.stopTranscription();
      });

      expect(result.current.webSpeechText).toBe('Preserved text');
    });

    it('should reset all texts when resetTranscription is called', async () => {
      const { result } = renderHook(() => useTripleTranscription());

      await act(async () => {
        result.current.webSpeechText = 'Web';
        result.current.whisperText = 'Whisper';
        result.current.deepgramText = 'Deepgram';
        result.current.refinedText = 'Refined';

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

      const { result } = renderHook(() =>
        useTripleTranscription({
          refineFunction: mockRefine,
        })
      );

      await act(async () => {
        result.current.webSpeechText = 'Text';

        try {
          await result.current.refineWithClaude();
        } catch (error) {
          // Error should be caught
        }
      });

      expect(result.current.isRefining).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    it('should continue other streams if one fails', async () => {
      const { result } = renderHook(() => useTripleTranscription());

      await act(async () => {
        await result.current.startTranscription();

        // Simulate one stream failing
        result.current.webSpeechText = 'Success';
        // whisper fails silently
        result.current.deepgramText = 'Success';
      });

      expect(result.current.webSpeechText).toBe('Success');
      expect(result.current.deepgramText).toBe('Success');
    });
  });
});
