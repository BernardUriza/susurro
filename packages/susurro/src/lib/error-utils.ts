/**
 * Error Handling Utilities
 * Centralized error handling for audio processing
 */

import { useState, useCallback } from 'react';

export class AudioProcessingError extends Error {
  constructor(
    message: string,
    public readonly context: string,
    public readonly originalError?: unknown,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'AudioProcessingError';
  }
}

export class TranscriptionError extends AudioProcessingError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'transcription', originalError);
    this.name = 'TranscriptionError';
  }
}

export class RecordingError extends AudioProcessingError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'recording', originalError, false);
    this.name = 'RecordingError';
  }
}

export class VADError extends AudioProcessingError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'vad', originalError);
    this.name = 'VADError';
  }
}

/**
 * Unified error handler for audio processing operations
 */
export const handleAudioError = (
  error: unknown,
  context: string,
  fallbackMessage?: string
): never => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const finalMessage = fallbackMessage || errorMessage;

  throw new AudioProcessingError(finalMessage, context, error);
};

/**
 * Safe error handler that logs but doesn't throw
 */
export const logAudioError = (
  error: unknown,
  context: string,
  logger?: (message: string, type: string) => void
): void => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const logMessage = `[${context.toUpperCase()}] Error: ${errorMessage}`;

  if (logger) {
    logger(logMessage, 'error');
  } else {
    console.error(logMessage);
  }
};

/**
 * Extract error message from unknown error type
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error occurred';
};

/**
 * Retry handler for transient failures
 */
export const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  context: string = 'operation'
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new AudioProcessingError(`Failed after ${maxRetries} attempts`, context, lastError, false);
};

/**
 * Error boundary hook for React components
 */
export const useErrorHandler = () => {
  const [error, setError] = useState<AudioProcessingError | null>(null);

  const handleError = useCallback((error: unknown, context: string) => {
    const audioError =
      error instanceof AudioProcessingError
        ? error
        : new AudioProcessingError(getErrorMessage(error), context, error);

    setError(audioError);
  }, []);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  return { error, handleError, resetError };
};
