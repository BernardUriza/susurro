/**
 * Tests for murmubaraVAD function
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { murmubaraVAD } from '../murmuraba-vad';
import { VADResult } from '../types';

describe('murmubaraVAD', () => {
  let testBuffer: ArrayBuffer;

  beforeEach(() => {
    // Create test audio buffer (1 second of silence followed by tone)
    const sampleRate = 44100;
    const duration = 2; // 2 seconds
    const samples = sampleRate * duration;
    const buffer = new ArrayBuffer(samples * 2); // 16-bit samples
    const view = new Int16Array(buffer);

    // First second: silence (low energy)
    for (let i = 0; i < sampleRate; i++) {
      view[i] = Math.random() * 100 - 50; // Very low amplitude noise
    }

    // Second second: tone (high energy to simulate speech)
    const frequency = 440; // A4 note
    for (let i = sampleRate; i < samples; i++) {
      const t = (i - sampleRate) / sampleRate;
      view[i] = Math.sin(2 * Math.PI * frequency * t) * 10000;
    }

    testBuffer = buffer;
  });

  it('should return a valid VAD result structure', async () => {
    const result = await murmubaraVAD(testBuffer);

    expect(result).toHaveProperty('average');
    expect(result).toHaveProperty('scores');
    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('voiceSegments');

    expect(typeof result.average).toBe('number');
    expect(result.average).toBeGreaterThanOrEqual(0);
    expect(result.average).toBeLessThanOrEqual(1);

    expect(Array.isArray(result.scores)).toBe(true);
    expect(Array.isArray(result.metrics)).toBe(true);
  });

  it('should detect voice activity correctly', async () => {
    const result = await murmubaraVAD(testBuffer);

    // Should have scores for each frame
    expect(result.scores.length).toBeGreaterThan(0);

    // Average should be around 50% (half silence, half "speech")
    expect(result.average).toBeGreaterThan(0.3);
    expect(result.average).toBeLessThan(0.7);

    // First half scores should be low (silence)
    const firstHalf = result.scores.slice(0, Math.floor(result.scores.length / 2));
    const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    expect(firstHalfAvg).toBeLessThan(0.3);

    // Second half scores should be higher (tone/speech)
    const secondHalf = result.scores.slice(Math.floor(result.scores.length / 2));
    const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    expect(secondHalfAvg).toBeGreaterThan(0.5);
  });

  it('should include detailed metrics for each frame', async () => {
    const result = await murmubaraVAD(testBuffer);

    expect(result.metrics.length).toBeGreaterThan(0);

    const firstMetric = result.metrics[0];
    expect(firstMetric).toHaveProperty('timestamp');
    expect(firstMetric).toHaveProperty('vadScore');
    expect(firstMetric).toHaveProperty('energy');
    expect(firstMetric).toHaveProperty('zeroCrossingRate');

    expect(typeof firstMetric.timestamp).toBe('number');
    expect(typeof firstMetric.vadScore).toBe('number');
    expect(typeof firstMetric.energy).toBe('number');
    expect(typeof firstMetric.zeroCrossingRate).toBe('number');
  });

  it('should detect voice segments', async () => {
    const result = await murmubaraVAD(testBuffer);

    expect(result.voiceSegments).toBeDefined();
    expect(Array.isArray(result.voiceSegments)).toBe(true);

    if (result.voiceSegments!.length > 0) {
      const segment = result.voiceSegments![0];
      expect(segment).toHaveProperty('startTime');
      expect(segment).toHaveProperty('endTime');
      expect(segment).toHaveProperty('confidence');

      expect(segment.endTime).toBeGreaterThan(segment.startTime);
      expect(segment.confidence).toBeGreaterThan(0);
      expect(segment.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('should handle empty buffer', async () => {
    const emptyBuffer = new ArrayBuffer(0);
    const result = await murmubaraVAD(emptyBuffer);

    expect(result.average).toBe(0);
    expect(result.scores).toHaveLength(0);
    expect(result.metrics).toHaveLength(0);
  });

  it('should handle custom configuration', async () => {
    const customConfig = {
      frameSize: 960, // 40ms frames
      minSegmentDuration: 0.2,
      useRNNoise: false
    };

    const result = await murmubaraVAD(testBuffer, customConfig);
    expect(result).toHaveProperty('average');
    expect(result.scores.length).toBeGreaterThan(0);
  });

  it('should apply temporal smoothing', async () => {
    const result = await murmubaraVAD(testBuffer);

    // Check that scores are smoothed (no abrupt changes)
    let abruptChanges = 0;
    for (let i = 1; i < result.scores.length; i++) {
      const diff = Math.abs(result.scores[i] - result.scores[i - 1]);
      if (diff > 0.8) abruptChanges++;
    }

    // Should have minimal abrupt changes due to smoothing
    expect(abruptChanges).toBeLessThan(result.scores.length * 0.1);
  });

  it('should work with different audio formats', async () => {
    // Test with Float32Array directly
    const floatBuffer = new Float32Array(44100); // 1 second
    for (let i = 0; i < floatBuffer.length; i++) {
      floatBuffer[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * 0.5;
    }

    const result = await murmubaraVAD(floatBuffer.buffer);
    expect(result.average).toBeGreaterThan(0.5);
  });
});

describe('VAD Performance', () => {
  it('should process large files efficiently', async () => {
    // Create 5-minute audio buffer
    const sampleRate = 44100;
    const duration = 300; // 5 minutes
    const samples = sampleRate * duration;
    const buffer = new ArrayBuffer(samples * 2);
    const view = new Int16Array(buffer);

    // Fill with test pattern
    for (let i = 0; i < samples; i++) {
      view[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 5000;
    }

    const startTime = performance.now();
    const result = await murmubaraVAD(buffer);
    const endTime = performance.now();

    const processingTime = endTime - startTime;
    expect(processingTime).toBeLessThan(500); // Should process in under 500ms
    expect(result.scores.length).toBeGreaterThan(0);
  });
});