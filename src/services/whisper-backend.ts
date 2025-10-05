/**
 * Whisper Backend Service
 *
 * This service provides integration with the remote Whisper backend
 * as an alternative to the client-side Whisper processing.
 *
 * Can be used as a fallback or primary transcription method.
 */

export interface BackendTranscriptionResult {
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  language?: string;
  language_probability?: number;
  duration?: number;
  model?: string;
}

export interface BackendModelInfo {
  current_model: string;
  available_models: string[];
  model_info: Record<
    string,
    {
      size: string;
      parameters: string;
      relative_speed: string;
      english_only: boolean;
      multilingual: boolean;
    }
  >;
}

export interface BackendHealthStatus {
  status: 'healthy' | 'unhealthy';
  model_status: 'loaded' | 'not_loaded';
  implementation: string;
  model_size: string;
  memory_optimized: boolean;
  timestamp: string;
}

export class WhisperBackendError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'WhisperBackendError';
  }
}

export class WhisperBackendService {
  private baseUrl: string;
  private timeout: number;

  constructor(
    baseUrl?: string,
    timeout = 60000 // 60 seconds for transcription
  ) {
    // Get backend URL based on environment
    const useRender = import.meta.env.VITE_USE_RENDER === 'true';
    this.baseUrl = (
      baseUrl ||
      (useRender ? 'https://susurro-whisper-backend.onrender.com' : 'http://localhost:8000')
    ).replace(/\/$/, ''); // Remove trailing slash
    this.timeout = timeout;
  }

  /**
   * Check if the backend service is available and healthy
   */
  async healthCheck(): Promise<BackendHealthStatus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for health check

      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new WhisperBackendError(
          `Health check failed: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof WhisperBackendError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new WhisperBackendError('Backend health check timed out', 408);
      }

      throw new WhisperBackendError(
        `Failed to connect to backend: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0
      );
    }
  }

  /**
   * Get available models information
   */
  async getModels(): Promise<BackendModelInfo> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new WhisperBackendError(
          `Failed to get models: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof WhisperBackendError) throw error;
      throw new WhisperBackendError(
        `Failed to fetch models: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Transcribe audio using the backend service
   */
  async transcribe(
    audioBlob: Blob,
    options: {
      language?: string;
      responseFormat?: 'text' | 'detailed';
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<BackendTranscriptionResult> {
    const { language, responseFormat = 'detailed', onProgress } = options;

    // Validate file size (25MB limit)
    const maxSize = 25 * 1024 * 1024;
    if (audioBlob.size > maxSize) {
      throw new WhisperBackendError(
        `File too large: ${(audioBlob.size / 1024 / 1024).toFixed(1)}MB. Maximum size is 25MB.`,
        413
      );
    }

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.wav');
      if (language) {
        formData.append('language', language);
      }
      formData.append('response_format', responseFormat);

      // Set up request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      onProgress?.(10); // Starting upload

      const response = await fetch(`${this.baseUrl}/transcribe`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      onProgress?.(90); // Upload complete, processing

      if (!response.ok) {
        let errorMessage = `Transcription failed: ${response.status} ${response.statusText}`;

        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch {
          // If response is not JSON, use the status text
        }

        throw new WhisperBackendError(errorMessage, response.status);
      }

      const result = await response.json();
      onProgress?.(100); // Complete

      // Ensure consistent response format
      if (responseFormat === 'text') {
        return {
          text: result.text || '',
          segments: [],
        };
      }

      return {
        text: result.text || '',
        segments: result.segments || [],
        language: result.language,
        language_probability: result.language_probability,
        duration: result.duration,
        model: result.model,
      };
    } catch (error) {
      if (error instanceof WhisperBackendError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new WhisperBackendError('Transcription timed out', 408);
      }

      throw new WhisperBackendError(
        `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if the backend is available (quick test)
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get backend service information
   */
  async getInfo(): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(`${this.baseUrl}/`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new WhisperBackendError(
          `Failed to get info: ${response.statusText}`,
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof WhisperBackendError) throw error;
      throw new WhisperBackendError(
        `Failed to get backend info: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Singleton instance
export const whisperBackend = new WhisperBackendService();

// Utility function to detect if we should use backend or client-side
export async function shouldUseBackend(): Promise<boolean> {
  // When using Render, always prefer backend
  const useRender = import.meta.env.VITE_USE_RENDER === 'true';
  if (useRender) return true;

  // Auto-detect based on backend availability
  try {
    return await whisperBackend.isAvailable();
  } catch {
    return false;
  }
}

// Helper function for easy transcription with fallback logic
export async function transcribeAudio(
  audioBlob: Blob,
  options: {
    language?: string;
    responseFormat?: 'text' | 'detailed';
    onProgress?: (progress: number) => void;
    useBackend?: boolean;
    clientTranscriber?: (blob: Blob) => Promise<BackendTranscriptionResult>;
  } = {}
): Promise<BackendTranscriptionResult> {
  const { useBackend, clientTranscriber, ...transcribeOptions } = options;

  // Determine transcription method
  const shouldUseBackendService = useBackend ?? (await shouldUseBackend());

  if (shouldUseBackendService) {
    try {
      console.log('[transcribeAudio] Using backend service');
      return await whisperBackend.transcribe(audioBlob, transcribeOptions);
    } catch (error) {
      console.warn('[transcribeAudio] Backend failed, falling back to client-side:', error);

      // Fall back to client-side if backend fails and client transcriber is available
      if (clientTranscriber) {
        const result = await clientTranscriber(audioBlob);
        return {
          text: result.text || '',
          segments: result.segments || [],
        };
      }

      throw error;
    }
  } else {
    // Use client-side transcription
    if (!clientTranscriber) {
      throw new Error('No client-side transcriber available and backend is not accessible');
    }

    console.log('[transcribeAudio] Using client-side transcription');
    const result = await clientTranscriber(audioBlob);
    return {
      text: result.text || '',
      segments: result.segments || [],
    };
  }
}
