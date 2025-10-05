/**
 * useWebSpeech - Browser native Web Speech API hook for instant transcription
 *
 * This hook provides fast, low-latency transcription using the browser's built-in
 * speech recognition. It's designed to run in parallel with Deepgram for comparison.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface WebSpeechConfig {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export interface WebSpeechResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
}

export interface UseWebSpeechReturn {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  finalTranscript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  lastResult: WebSpeechResult | null;
}

export function useWebSpeech(config: WebSpeechConfig = {}): UseWebSpeechReturn {
  const {
    language = 'es-ES',
    continuous = true,
    interimResults = true,
    maxAlternatives = 1,
  } = config;

  // Check browser support
  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // State
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<WebSpeechResult | null>(null);

  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');

  // Initialize recognition
  useEffect(() => {
    if (!isSupported) {
      setError('Web Speech API no está soportado en este navegador');
      return;
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();

    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;
    recognition.maxAlternatives = maxAlternatives;

    recognition.onstart = () => {
      console.log('🎤 [WebSpeech] STARTED - listening for speech');
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      console.log('⏹️  [WebSpeech] ENDED');
      setIsListening(false);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('❌ [WebSpeech] ERROR:', event.error);
      setError(`Error de reconocimiento: ${event.error}`);
      setIsListening(false);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = '';
      let finalText = finalTranscriptRef.current;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptText = result[0].transcript;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          finalText += transcriptText + ' ';

          // Emit final result
          const webSpeechResult: WebSpeechResult = {
            transcript: transcriptText,
            confidence: confidence || 0,
            isFinal: true,
            timestamp: Date.now(),
          };
          setLastResult(webSpeechResult);

          console.log(
            `✅ [WebSpeech] FINAL: "${transcriptText}" (confidence: ${(confidence * 100).toFixed(0)}%)`
          );
        } else {
          interimText += transcriptText;

          // Emit interim result
          const webSpeechResult: WebSpeechResult = {
            transcript: transcriptText,
            confidence: confidence || 0,
            isFinal: false,
            timestamp: Date.now(),
          };
          setLastResult(webSpeechResult);

          // Only log every 5th interim to reduce noise
          if (i % 5 === 0) {
            console.log(
              `⚡ [WebSpeech] INTERIM: "${transcriptText.substring(0, 50)}${transcriptText.length > 50 ? '...' : ''}"`
            );
          }
        }
      }

      finalTranscriptRef.current = finalText;
      setFinalTranscript(finalText.trim());
      setInterimTranscript(interimText);
      setTranscript((finalText + interimText).trim());
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [isSupported, language, continuous, interimResults, maxAlternatives]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Reconocimiento de voz no inicializado');
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (err) {
      // Already started, ignore
      console.warn('[WebSpeech] Already listening or error starting:', err);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.warn('[WebSpeech] Error stopping:', err);
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setFinalTranscript('');
    setLastResult(null);
    finalTranscriptRef.current = '';
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    finalTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    lastResult,
  };
}
