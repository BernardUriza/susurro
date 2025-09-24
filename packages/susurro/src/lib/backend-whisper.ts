// Backend Whisper API integration for Susurro
// This replaces browser-based Whisper with server-side processing

export interface BackendWhisperConfig {
  apiUrl: string;
  apiKey?: string;
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  timeout?: number;
}

export class BackendWhisperClient {
  private config: BackendWhisperConfig;

  constructor(config: BackendWhisperConfig) {
    this.config = {
      timeout: 30000,
      model: 'base',
      ...config
    };
  }

  async transcribe(audioBlob: Blob, language: string = 'es'): Promise<{
    text: string;
    segments?: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  }> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.wav');
    formData.append('language', language);
    if (this.config.model) {
      formData.append('model', this.config.model);
    }

    const headers: HeadersInit = {};
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        body: formData,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        text: result.text || result.transcription || '',
        segments: result.segments,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Transcription timeout - audio might be too long');
        }
        throw error;
      }
      throw new Error('Unknown transcription error');
    }
  }

  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.apiUrl}/health`, {
        method: 'GET',
        headers: this.config.apiKey ? {
          'Authorization': `Bearer ${this.config.apiKey}`
        } : {},
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Factory function to create appropriate whisper client
export function createWhisperClient(config?: BackendWhisperConfig) {
  if (config?.apiUrl) {
    console.log('[Whisper] Using backend API at:', config.apiUrl);
    return new BackendWhisperClient(config);
  }

  console.log('[Whisper] No backend configured, will use browser-based Whisper');
  return null;
}