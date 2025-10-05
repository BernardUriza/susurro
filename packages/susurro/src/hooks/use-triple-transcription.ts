/**
 * useTripleTranscription Hook
 *
 * Manages 3 independent transcription streams:
 * - WebSpeech (browser native, instant)
 * - Whisper (local Transformers.js, high accuracy)
 * - Deepgram (backend API, professional grade)
 *
 * All 3 streams send outputs to Claude refiner for final text
 *
 * Architecture:
 * WebSpeech ──┐
 * Whisper   ──┤──→ Claude Refiner ──→ Final Text
 * Deepgram  ──┘
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSpeech } from './use-web-speech';
import { useDualTranscription } from './use-dual-transcription';

export interface TripleTranscriptionOptions {
  language?: string;
  enableWebSpeech?: boolean;
  enableWhisper?: boolean;
  enableDeepgram?: boolean;
  autoRefine?: boolean;
  refineDebounceMs?: number;
  refineFunction?: (inputs: {
    webSpeech: string;
    whisper: string;
    deepgram: string;
  }) => Promise<string>;
  claudeConfig?: {
    enabled: boolean;
    apiUrl: string;
  };
}

export interface UseTripleTranscriptionReturn {
  // Individual stream texts
  webSpeechText: string;
  whisperText: string;
  deepgramText: string;
  refinedText: string;

  // States
  isTranscribing: boolean;
  isRefining: boolean;
  error: string | null;

  // Actions
  startTranscription: () => Promise<void>;
  stopTranscription: () => Promise<void>;
  resetTranscription: () => void;
  refineWithClaude: () => Promise<void>;

  // Individual stream controls (for advanced use)
  addWhisperChunk?: (text: string) => void;
  addDeepgramChunk?: (chunk: any) => void;
}

export function useTripleTranscription(
  options: TripleTranscriptionOptions = {}
): UseTripleTranscriptionReturn {
  const {
    language = 'es-ES',
    enableWebSpeech = true,
    enableWhisper = true,
    enableDeepgram = true,
    autoRefine = true,
    refineDebounceMs = 500,
    refineFunction,
    claudeConfig = { enabled: false, apiUrl: '' },
  } = options;

  // Use existing hooks for WebSpeech and Deepgram
  const webSpeech = useWebSpeech({ language, continuous: true });

  // Use dual transcription for Deepgram (we'll add Whisper separately)
  const dual = useDualTranscription({
    language,
    autoRefine: false, // We handle refinement with 3 inputs
    claudeConfig,
  });

  // Whisper text state (separate from Deepgram)
  const [whisperText, setWhisperText] = useState('');

  // Refined text from all 3 sources
  const [refinedText, setRefinedText] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce timer
  const refineTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get texts from individual streams
  const webSpeechText = webSpeech.transcript;
  const deepgramText = dual.deepgramText || '';

  const isTranscribing = webSpeech.isListening || dual.isTranscribing;

  // Refine with Claude using all 3 inputs
  const refineWithClaude = useCallback(async () => {
    if (!refineFunction && !claudeConfig.enabled) {
      console.warn('[TripleTranscription] No refine function or Claude config provided');
      return;
    }

    setIsRefining(true);
    setError(null);

    try {
      const inputs = {
        webSpeech: webSpeechText,
        whisper: whisperText,
        deepgram: deepgramText,
      };

      console.log('🔄 [TripleTranscription] Refining with 3 inputs:', {
        webSpeech: inputs.webSpeech.substring(0, 50),
        whisper: inputs.whisper.substring(0, 50),
        deepgram: inputs.deepgram.substring(0, 50),
      });

      let refined: string;

      if (refineFunction) {
        refined = await refineFunction(inputs);
      } else if (claudeConfig.enabled) {
        // Call Claude API with 3 inputs
        const response = await fetch(claudeConfig.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inputs),
        });

        if (!response.ok) {
          throw new Error(`Claude API error: ${response.statusText}`);
        }

        const data = await response.json();
        refined = data.refined || data.text || '';
      } else {
        refined = '';
      }

      setRefinedText(refined);
      console.log('✅ [TripleTranscription] Refined text ready:', refined.substring(0, 100));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('[TripleTranscription] Refinement error:', err);
    } finally {
      setIsRefining(false);
    }
  }, [webSpeechText, whisperText, deepgramText, refineFunction, claudeConfig]);

  // Auto-refine when texts change (debounced)
  useEffect(() => {
    if (!autoRefine) return;

    // Clear previous timer
    if (refineTimerRef.current) {
      clearTimeout(refineTimerRef.current);
    }

    // Only refine if we have at least one non-empty text
    const hasText = webSpeechText || whisperText || deepgramText;
    if (!hasText) return;

    // Debounce refinement
    refineTimerRef.current = setTimeout(() => {
      refineWithClaude();
    }, refineDebounceMs);

    return () => {
      if (refineTimerRef.current) {
        clearTimeout(refineTimerRef.current);
      }
    };
  }, [webSpeechText, whisperText, deepgramText, autoRefine, refineDebounceMs, refineWithClaude]);

  // Start all 3 transcription streams
  const startTranscription = useCallback(async () => {
    console.log('🎬 [TripleTranscription] Starting 3 streams...');

    const promises: Promise<void>[] = [];

    if (enableWebSpeech) {
      promises.push(Promise.resolve(webSpeech.startListening()));
    }

    if (enableDeepgram) {
      promises.push(dual.startTranscription());
    }

    // TODO: Add Whisper stream start
    if (enableWhisper) {
      console.log('⚠️ [TripleTranscription] Whisper stream not yet implemented');
    }

    await Promise.all(promises);

    console.log('✅ [TripleTranscription] All streams started');
  }, [enableWebSpeech, enableWhisper, enableDeepgram, webSpeech, dual]);

  // Stop all 3 transcription streams
  const stopTranscription = useCallback(async () => {
    console.log('⏹️ [TripleTranscription] Stopping 3 streams...');

    const promises: Promise<void>[] = [];

    if (enableWebSpeech) {
      webSpeech.stopListening();
    }

    if (enableDeepgram) {
      promises.push(dual.stopTranscription());
    }

    // TODO: Add Whisper stream stop
    if (enableWhisper) {
      console.log('⚠️ [TripleTranscription] Whisper stream not yet implemented');
    }

    await Promise.all(promises);

    console.log('✅ [TripleTranscription] All streams stopped');
  }, [enableWebSpeech, enableWhisper, enableDeepgram, webSpeech, dual]);

  // Reset all texts
  const resetTranscription = useCallback(() => {
    setWhisperText('');
    setRefinedText('');
    setError(null);
    dual.resetTranscription();
    // WebSpeech resets automatically on stop
  }, [dual]);

  // Advanced: Add Whisper chunk manually
  const addWhisperChunk = useCallback((text: string) => {
    setWhisperText((prev) => (prev ? `${prev} ${text}` : text));
  }, []);

  return {
    // Texts from each stream
    webSpeechText,
    whisperText,
    deepgramText,
    refinedText,

    // States
    isTranscribing,
    isRefining,
    error,

    // Actions
    startTranscription,
    stopTranscription,
    resetTranscription,
    refineWithClaude,

    // Advanced
    addWhisperChunk,
    addDeepgramChunk: dual.addDeepgramChunk,
  };
}
