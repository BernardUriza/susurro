/**
 * Deepgram backend handler for processing audio chunks
 * Sends Murmuraba WAV chunks to Deepgram API backend
 */

export interface DeepgramConfig {
  backendUrl?: string;
  model?: string;
  language?: string;
}

export class DeepgramBackend {
  private ws: WebSocket | null = null;
  private backendUrl: string;
  private restUrl: string;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(config: DeepgramConfig = {}) {
    // Detect environment and use appropriate URLs
    let useRender = false;
    try {
      useRender = typeof window !== 'undefined' &&
                  (window as any).VITE_USE_RENDER === 'true';
    } catch (e) {
      useRender = false;
    }

    const baseUrl = config.backendUrl || (useRender
      ? 'https://susurro-deepgram-backend.onrender.com'
      : 'http://localhost:8001'
    );

    this.backendUrl = baseUrl.replace('http', 'ws') + '/ws/transcribe';
    this.restUrl = baseUrl;
  }

  async connect(onTranscription: (result: any) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.backendUrl);

        this.ws.onopen = () => {
          console.log('[DeepgramBackend] Connected to backend');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'transcription') {
              onTranscription({
                transcript: data.transcript,
                confidence: data.confidence,
                is_final: true,
                model: 'deepgram'
              });
            } else if (data.type === 'error') {
              console.error('[DeepgramBackend] Error:', data.message);
            }
          } catch (e) {
            console.error('[DeepgramBackend] Error parsing message:', e);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[DeepgramBackend] WebSocket error:', error);
          this.isConnected = false;
        };

        this.ws.onclose = () => {
          console.log('[DeepgramBackend] Disconnected from backend');
          this.isConnected = false;
          this.attemptReconnect(onTranscription);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(onTranscription: (result: any) => void): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[DeepgramBackend] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
      setTimeout(() => {
        this.connect(onTranscription);
      }, 2000 * this.reconnectAttempts);
    }
  }

  async sendAudioChunk(audioData: ArrayBuffer | Blob): Promise<void> {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[DeepgramBackend] Not connected, skipping chunk');
      return;
    }

    try {
      // Convert to base64 for transmission
      let buffer: ArrayBuffer;
      if (audioData instanceof Blob) {
        buffer = await audioData.arrayBuffer();
      } else {
        buffer = audioData;
      }

      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

      this.ws.send(JSON.stringify({
        type: 'audio_chunk',
        audio: base64
      }));
    } catch (error) {
      console.error('[DeepgramBackend] Error sending audio chunk:', error);
    }
  }

  async transcribeChunk(audioData: ArrayBuffer | Blob): Promise<any> {
    // Alternative REST API method for single chunk transcription
    const formData = new FormData();

    if (audioData instanceof ArrayBuffer) {
      formData.append('file', new Blob([audioData], { type: 'audio/wav' }), 'chunk.wav');
    } else {
      formData.append('file', audioData, 'chunk.wav');
    }

    try {
      const response = await fetch(`${this.restUrl}/transcribe-chunk`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return {
        transcript: result.transcript,
        confidence: result.confidence,
        is_final: true,
        model: 'deepgram'
      };
    } catch (error) {
      console.error('[DeepgramBackend] Error transcribing chunk:', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  isReady(): boolean {
    return this.isConnected;
  }
}