/**
 * Tests for useDualTranscription hook
 * Validates dual transcription workflow with Web Speech + Deepgram + Claude
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDualTranscription } from '../src/hooks/use-dual-transcription';

// Mock Web Speech API
const mockWebSpeechAPI = () => {
  global.SpeechRecognition = vi.fn().mockImplementation(() => ({
    continuous: false,
    interimResults: false,
    lang: 'en-US',
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

  // @ts-ignore
  global.webkitSpeechRecognition = global.SpeechRecognition;
};

// Mock fetch for Claude API
const mockClaudeAPI = (refinedText: string) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      refined_text: refinedText,
      confidence: 0.95,
      model: 'claude-3-5-sonnet',
      fallback: false,
    }),
  });
};

describe('useDualTranscription', () => {
  beforeEach(() => {
    mockWebSpeechAPI();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useDualTranscription());

    expect(result.current.isTranscribing).toBe(false);
    expect(result.current.webSpeechText).toBe('');
    expect(result.current.deepgramText).toBe('');
    expect(result.current.refinedText).toBeNull();
    expect(result.current.isRefining).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should start transcription', async () => {
    const { result } = renderHook(() => useDualTranscription());

    act(() => {
      result.current.startTranscription();
    });

    await waitFor(() => {
      expect(result.current.isTranscribing).toBe(true);
    });
  });

  it('should stop transcription', async () => {
    const { result } = renderHook(() => useDualTranscription());

    act(() => {
      result.current.startTranscription();
    });

    await waitFor(() => {
      expect(result.current.isTranscribing).toBe(true);
    });

    await act(async () => {
      await result.current.stopTranscription();
    });

    expect(result.current.isTranscribing).toBe(false);
  });

  it('should reset transcription state', () => {
    const { result } = renderHook(() => useDualTranscription());

    // Simulate some transcription
    act(() => {
      result.current.startTranscription();
    });

    act(() => {
      result.current.resetTranscription();
    });

    expect(result.current.webSpeechText).toBe('');
    expect(result.current.deepgramText).toBe('');
    expect(result.current.refinedText).toBeNull();
    expect(result.current.isTranscribing).toBe(false);
  });

  it('should refine text with Claude when enabled', async () => {
    const refinedText = 'Hola, esto es una prueba refinada.';
    mockClaudeAPI(refinedText);

    const { result } = renderHook(() =>
      useDualTranscription({
        claudeConfig: {
          enabled: true,
          apiUrl: 'http://localhost:8001/refine',
        },
      })
    );

    let refined: string = '';
    await act(async () => {
      refined = await result.current.refineWithClaude(
        'hola esto es una prueba',
        'Hola, esto es una prueba.'
      );
    });

    expect(refined).toBe(refinedText);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8001/refine',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('web_speech_text'),
      })
    );
  });

  it('should fallback to Deepgram when Claude is disabled', async () => {
    const { result } = renderHook(() =>
      useDualTranscription({
        claudeConfig: {
          enabled: false,
        },
      })
    );

    let refined: string = '';
    await act(async () => {
      refined = await result.current.refineWithClaude(
        'web speech text',
        'deepgram text'
      );
    });

    expect(refined).toBe('deepgram text');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should handle Claude API errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() =>
      useDualTranscription({
        claudeConfig: {
          enabled: true,
          apiUrl: 'http://localhost:8001/refine',
        },
      })
    );

    let refined: string = '';
    await act(async () => {
      refined = await result.current.refineWithClaude(
        'web speech',
        'deepgram text'
      );
    });

    // Should fallback to Deepgram on error
    expect(refined).toBe('deepgram text');
    expect(result.current.error).toContain('Error refinando con Claude');
  });

  it('should add Deepgram chunks correctly', () => {
    const { result } = renderHook(() => useDualTranscription());

    act(() => {
      result.current.addDeepgramChunk?.({
        transcriptionText: 'First chunk',
        audioData: new Uint8Array(),
        timestamp: Date.now(),
        duration: 1000,
        isVoiceActive: true,
        vadScore: 0.9,
        confidence: 0.95,
      });
    });

    expect(result.current.deepgramText).toBe('First chunk');

    act(() => {
      result.current.addDeepgramChunk?.({
        transcriptionText: 'Second chunk',
        audioData: new Uint8Array(),
        timestamp: Date.now(),
        duration: 1000,
        isVoiceActive: true,
        vadScore: 0.9,
        confidence: 0.95,
      });
    });

    expect(result.current.deepgramText).toBe('First chunk Second chunk');
  });

  it('should auto-refine when both transcriptions are ready', async () => {
    const refinedText = 'Auto-refined text';
    mockClaudeAPI(refinedText);

    const onResult = vi.fn();
    const { result } = renderHook(() =>
      useDualTranscription({
        autoRefine: true,
        onResult,
        claudeConfig: {
          enabled: true,
          apiUrl: 'http://localhost:8001/refine',
        },
      })
    );

    act(() => {
      result.current.startTranscription();
    });

    // Simulate receiving both transcriptions
    act(() => {
      result.current.addDeepgramChunk?.({
        transcriptionText: 'Deepgram text',
        audioData: new Uint8Array(),
        timestamp: Date.now(),
        duration: 1000,
        isVoiceActive: true,
        vadScore: 0.9,
        confidence: 0.95,
      });
    });

    await act(async () => {
      await result.current.stopTranscription();
    });

    await waitFor(() => {
      expect(result.current.refinedText).toBe(refinedText);
    });
  });
});
