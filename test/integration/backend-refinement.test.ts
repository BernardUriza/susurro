/**
 * Integration Test: Backend Refinement Flow
 * Tests Deepgram transcription + Claude AI refinement
 *
 * These tests validate the complete backend integration:
 * 1. Audio chunk sent to Deepgram
 * 2. Transcription returned
 * 3. Web Speech + Deepgram sent to Claude
 * 4. Refined text returned
 */

import { describe, it, expect, beforeAll } from 'vitest';

const BACKEND_URL = process.env.VITE_DEEPGRAM_BACKEND_URL || 'http://localhost:8001';

// Helper: Create a simple WAV file for testing
function createTestWavFile(): ArrayBuffer {
  // Minimal WAV file (1 second of silence at 16kHz, mono)
  const sampleRate = 16000;
  const duration = 1; // seconds
  const numSamples = sampleRate * duration;

  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // WAV header
  // "RIFF" chunk
  view.setUint32(0, 0x46464952, false); // "RIFF"
  view.setUint32(4, 36 + numSamples * 2, true); // File size - 8
  view.setUint32(8, 0x45564157, false); // "WAVE"

  // "fmt " sub-chunk
  view.setUint32(12, 0x20746d66, false); // "fmt "
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, 1, true); // Channels (1 = mono)
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample

  // "data" sub-chunk
  view.setUint32(36, 0x61746164, false); // "data"
  view.setUint32(40, numSamples * 2, true); // Data size

  // Fill with silence (zeros)
  for (let i = 0; i < numSamples; i++) {
    view.setInt16(44 + i * 2, 0, true);
  }

  return buffer;
}

// Helper: Check if backend is running
async function isBackendAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

describe('Backend Integration Tests', () => {
  let backendAvailable = false;

  beforeAll(async () => {
    backendAvailable = await isBackendAvailable();
    if (!backendAvailable) {
      console.warn(`⚠️  Backend not available at ${BACKEND_URL}`);
      console.warn('   Start backend with: cd backend-deepgram && python server.py');
      console.warn('   These tests will be skipped.');
    }
  });

  describe('Health Check', () => {
    it.skipIf(() => !backendAvailable)('should return healthy status', async () => {
      const response = await fetch(`${BACKEND_URL}/health`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('deepgram-chunk-processor');
    });
  });

  describe('Deepgram Transcription', () => {
    it.skipIf(() => !backendAvailable)('should transcribe WAV audio chunk', async () => {
      const wavData = createTestWavFile();
      const blob = new Blob([wavData], { type: 'audio/wav' });

      const formData = new FormData();
      formData.append('file', blob, 'test.wav');

      const response = await fetch(`${BACKEND_URL}/transcribe-chunk`, {
        method: 'POST',
        body: formData,
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('transcript');
      expect(data).toHaveProperty('confidence');
      expect(data.model).toBe('deepgram-nova-2');
    });

    it.skipIf(() => !backendAvailable)('should handle invalid audio gracefully', async () => {
      const invalidData = new Blob([new Uint8Array([1, 2, 3, 4])], {
        type: 'audio/wav',
      });

      const formData = new FormData();
      formData.append('file', invalidData, 'invalid.wav');

      const response = await fetch(`${BACKEND_URL}/transcribe-chunk`, {
        method: 'POST',
        body: formData,
      });

      // Should handle error (might be 500 or return error in response)
      expect([200, 500].includes(response.status)).toBe(true);
    });
  });

  describe('Claude AI Refinement', () => {
    it.skipIf(() => !backendAvailable)('should refine dual transcriptions', async () => {
      const requestBody = {
        web_speech_text: 'hola esto es una prueba',
        deepgram_text: 'Hola, esto es una prueba.',
        language: 'es',
      };

      const response = await fetch(`${BACKEND_URL}/refine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('refined_text');
      expect(data).toHaveProperty('confidence');
      expect(typeof data.refined_text).toBe('string');
      expect(data.refined_text.length).toBeGreaterThan(0);
    });

    it.skipIf(() => !backendAvailable)('should fallback gracefully when Claude fails', async () => {
      const requestBody = {
        web_speech_text: '',
        deepgram_text: 'Fallback text',
        language: 'es',
      };

      const response = await fetch(`${BACKEND_URL}/refine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      // Should return something even if refinement fails
      expect(data).toHaveProperty('refined_text');

      // If fallback occurred, check fallback flag
      if (data.fallback) {
        expect(data.refined_text).toBe('Fallback text');
      }
    });

    it.skipIf(() => !backendAvailable)('should validate required fields', async () => {
      // Missing required fields
      const response = await fetch(`${BACKEND_URL}/refine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing web_speech_text and deepgram_text
          language: 'es',
        }),
      });

      expect(response.status).toBe(422); // Unprocessable Entity
    });

    it.skipIf(() => !backendAvailable)('should handle different languages', async () => {
      const languages = ['es', 'en', 'fr'];

      for (const lang of languages) {
        const requestBody = {
          web_speech_text: 'test text',
          deepgram_text: 'Test text.',
          language: lang,
        };

        const response = await fetch(`${BACKEND_URL}/refine`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data).toHaveProperty('refined_text');
      }
    });
  });

  describe('Complete Workflow', () => {
    it.skipIf(() => !backendAvailable)(
      'should handle full transcription + refinement flow',
      async () => {
        // Step 1: Transcribe audio with Deepgram
        const wavData = createTestWavFile();
        const blob = new Blob([wavData], { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('file', blob, 'test.wav');

        const transcribeResponse = await fetch(`${BACKEND_URL}/transcribe-chunk`, {
          method: 'POST',
          body: formData,
        });

        expect(transcribeResponse.ok).toBe(true);
        const transcribeData = await transcribeResponse.json();

        // Step 2: Refine with Claude (using mock web speech text)
        const refineRequest = {
          web_speech_text: 'mock web speech text',
          deepgram_text: transcribeData.transcript || '',
          language: 'es',
        };

        const refineResponse = await fetch(`${BACKEND_URL}/refine`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(refineRequest),
        });

        expect(refineResponse.ok).toBe(true);
        const refineData = await refineResponse.json();

        expect(refineData).toHaveProperty('refined_text');
        expect(refineData).toHaveProperty('confidence');
      }
    );
  });

  describe('Performance', () => {
    it.skipIf(() => !backendAvailable)('should transcribe within reasonable time', async () => {
      const wavData = createTestWavFile();
      const blob = new Blob([wavData], { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('file', blob, 'test.wav');

      const startTime = Date.now();

      const response = await fetch(`${BACKEND_URL}/transcribe-chunk`, {
        method: 'POST',
        body: formData,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it.skipIf(() => !backendAvailable)('should refine within reasonable time', async () => {
      const requestBody = {
        web_speech_text: 'test',
        deepgram_text: 'Test.',
        language: 'es',
      };

      const startTime = Date.now();

      const response = await fetch(`${BACKEND_URL}/refine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});
