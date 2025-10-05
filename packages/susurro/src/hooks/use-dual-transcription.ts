/**
 * useDualTranscription - Orchestrates parallel transcription with Web Speech + Deepgram
 *
 * Architecture:
 * 1. Web Speech API: Instant, low-latency transcription (appears immediately)
 * 2. Deepgram: High-accuracy transcription (appears after processing)
 * 3. Claude AI: Refines and merges both transcriptions into clean final text
 *
 * This hook manages the dual-stream workflow and Claude refinement.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSpeech } from './use-web-speech';
import type { WebSpeechResult } from './use-web-speech';
import type { StreamingSusurroChunk } from '../lib/types';

export interface DualTranscriptionResult {
  webSpeechText: string;
  deepgramText: string;
  refinedText: string | null;
  confidence: {
    webSpeech: number;
    deepgram: number;
  };
  timestamp: number;
  isRefining: boolean;
}

export interface ClaudeRefinementConfig {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  enabled?: boolean;
}

export interface UseDualTranscriptionOptions {
  language?: string;
  onResult?: (result: DualTranscriptionResult) => void;
  claudeConfig?: ClaudeRefinementConfig;
  autoRefine?: boolean; // Auto-send to Claude when both transcriptions ready
}

export interface UseDualTranscriptionReturn {
  // Control
  startTranscription: () => void;
  stopTranscription: () => Promise<DualTranscriptionResult | null>;
  resetTranscription: () => void;

  // State
  isTranscribing: boolean;
  webSpeechText: string;
  deepgramText: string;
  refinedText: string | null;
  isRefining: boolean;

  // Manual refinement
  refineWithClaude: (webSpeech: string, deepgram: string) => Promise<string>;

  // Results
  currentResult: DualTranscriptionResult | null;
  results: DualTranscriptionResult[];

  // Status
  error: string | null;

  // Deepgram chunk handler
  addDeepgramChunk?: (chunk: StreamingSusurroChunk) => void;
}

export function useDualTranscription(
  options: UseDualTranscriptionOptions = {}
): UseDualTranscriptionReturn {
  const {
    language = 'es-ES',
    onResult,
    claudeConfig = {},
    autoRefine = true,
  } = options;

  // Web Speech hook
  const webSpeech = useWebSpeech({
    language,
    continuous: true,
    interimResults: true,
  });

  // State
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [webSpeechText, setWebSpeechText] = useState('');
  const [deepgramText, setDeepgramText] = useState('');
  const [refinedText, setRefinedText] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [currentResult, setCurrentResult] = useState<DualTranscriptionResult | null>(null);
  const [results, setResults] = useState<DualTranscriptionResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const deepgramChunksRef = useRef<string[]>([]);
  const webSpeechConfidenceRef = useRef(0);
  const deepgramConfidenceRef = useRef(0);

  // Reset all state
  const resetTranscription = useCallback(() => {
    webSpeech.resetTranscript();
    setWebSpeechText('');
    setDeepgramText('');
    setRefinedText(null);
    setIsRefining(false);
    setCurrentResult(null);
    setError(null);
    deepgramChunksRef.current = [];
    webSpeechConfidenceRef.current = 0;
    deepgramConfidenceRef.current = 0;
  }, [webSpeech]);

  // Start transcription
  const startTranscription = useCallback(() => {
    resetTranscription();
    setIsTranscribing(true);
    webSpeech.startListening();
  }, [resetTranscription, webSpeech]);

  // Claude AI refinement
  const refineWithClaude = useCallback(
    async (webSpeechInput: string, deepgramInput: string): Promise<string> => {
      if (!claudeConfig.enabled) {
        // If Claude is disabled, prefer Deepgram (more accurate)
        return deepgramInput || webSpeechInput;
      }

      setIsRefining(true);
      setError(null);

      try {
        const apiUrl = claudeConfig.apiUrl || '/api/claude/refine';

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            web_speech_text: webSpeechInput,
            deepgram_text: deepgramInput,
            language: 'es',
          }),
        });

        if (!response.ok) {
          throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const refined = data.refined_text || deepgramInput || webSpeechInput;

        setRefinedText(refined);
        return refined;
      } catch (err) {
        const errorMsg = `Error refinando con Claude: ${err instanceof Error ? err.message : 'Unknown'}`;
        console.error('[DualTranscription]', errorMsg);
        setError(errorMsg);
        // Fallback to Deepgram on error
        return deepgramInput || webSpeechInput;
      } finally {
        setIsRefining(false);
      }
    },
    [claudeConfig]
  );

  // Stop transcription and optionally refine
  const stopTranscription = useCallback(async (): Promise<DualTranscriptionResult | null> => {
    setIsTranscribing(false);
    webSpeech.stopListening();

    const webText = webSpeechText.trim();
    const deepText = deepgramText.trim();

    if (!webText && !deepText) {
      return null;
    }

    let refined: string | null = null;

    // Auto-refine if enabled and both texts exist
    if (autoRefine && webText && deepText) {
      refined = await refineWithClaude(webText, deepText);
    }

    const result: DualTranscriptionResult = {
      webSpeechText: webText,
      deepgramText: deepText,
      refinedText: refined,
      confidence: {
        webSpeech: webSpeechConfidenceRef.current,
        deepgram: deepgramConfidenceRef.current,
      },
      timestamp: Date.now(),
      isRefining: false,
    };

    setCurrentResult(result);
    setResults((prev) => [...prev, result]);
    onResult?.(result);

    return result;
  }, [
    webSpeech,
    webSpeechText,
    deepgramText,
    autoRefine,
    refineWithClaude,
    onResult,
  ]);

  // Update Web Speech text from hook - USE TRANSCRIPT FOR REAL-TIME (includes interim)
  useEffect(() => {
    if (isTranscribing) {
      // Use 'transcript' instead of 'finalTranscript' for real-time updates
      setWebSpeechText(webSpeech.transcript);

      if (webSpeech.lastResult?.confidence) {
        webSpeechConfidenceRef.current = webSpeech.lastResult.confidence;
      }
    }
  }, [isTranscribing, webSpeech.transcript, webSpeech.lastResult]);

  // Public method to receive Deepgram chunks
  // This should be called from the parent component with chunks from useSusurro
  const addDeepgramChunk = useCallback((chunk: StreamingSusurroChunk) => {
    if (chunk.transcriptionText.trim()) {
      deepgramChunksRef.current.push(chunk.transcriptionText);
      const combined = deepgramChunksRef.current.join(' ').trim();
      setDeepgramText(combined);

      // Estimate confidence from VAD score
      if (chunk.vadScore) {
        deepgramConfidenceRef.current = chunk.vadScore;
      }
    }
  }, []);

  return {
    // Control
    startTranscription,
    stopTranscription,
    resetTranscription,

    // State
    isTranscribing,
    webSpeechText,
    deepgramText,
    refinedText,
    isRefining,

    // Manual refinement
    refineWithClaude,

    // Results
    currentResult,
    results,

    // Status
    error,

    // Deepgram chunk handler
    addDeepgramChunk,
  };
}

// Helper type to expose addDeepgramChunk method
export type DualTranscriptionInstance = UseDualTranscriptionReturn & {
  addDeepgramChunk?: (chunk: StreamingSusurroChunk) => void;
};
