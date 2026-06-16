/**
 * Validation utilities for Murmuraba
 */

import { ProcessingMetrics } from '../types';

/**
 * Validate that a ProcessingMetrics object has all required fields with valid values
 */
export function validateProcessingMetrics(metrics: any): metrics is ProcessingMetrics {
  if (!metrics || typeof metrics !== 'object') {
    return false;
  }
  
  // Check required fields
  const requiredFields = [
    'noiseReductionLevel',
    'processingLatency',
    'inputLevel',
    'outputLevel',
    'frameCount',
    'droppedFrames',
    'timestamp'
  ];
  
  for (const field of requiredFields) {
    if (!(field in metrics)) {
      console.error(`Missing required field: ${field}`);
      return false;
    }
    
    // Validate numeric fields
    if (field !== 'timestamp' && (typeof metrics[field] !== 'number' || isNaN(metrics[field]) || !isFinite(metrics[field]))) {
      console.error(`Invalid numeric value for field: ${field}`);
      return false;
    }
  }
  
  // Validate ranges
  if (metrics.inputLevel < 0 || metrics.inputLevel > 1) {
    console.error(`Invalid inputLevel: ${metrics.inputLevel}`);
    return false;
  }
  if (metrics.outputLevel < 0 || metrics.outputLevel > 1) {
    console.error(`Invalid outputLevel: ${metrics.outputLevel}`);
    return false;
  }
  if (metrics.noiseReductionLevel < 0 || metrics.noiseReductionLevel > 100) {
    console.error(`Invalid noiseReductionLevel: ${metrics.noiseReductionLevel}`);
    return false;
  }
  if (metrics.processingLatency < 0) {
    console.error(`Invalid processingLatency: ${metrics.processingLatency}`);
    return false;
  }
  
  return true;
}

/**
 * Validate audio gain value
 */
export function validateGain(gain: number): number {
  if (typeof gain !== 'number' || isNaN(gain) || !isFinite(gain)) {
    throw new TypeError('Input gain must be a number');
  }
  
  // Clamp to safe range
  const safeGain = Math.max(0, Math.min(gain, 10));
  
  if (gain < 0) {
    throw new RangeError('Input gain cannot be negative');
  }
  
  return safeGain;
}

/**
 * Validate chunk configuration
 */
export function validateChunkConfig(config: any): boolean {
  if (!config || typeof config !== 'object') {
    return false;
  }
  
  if (typeof config.chunkDuration !== 'number' || config.chunkDuration <= 0) {
    console.error(`Invalid chunkDuration: ${config.chunkDuration}`);
    return false;
  }
  
  if (config.overlap !== undefined && (typeof config.overlap !== 'number' || config.overlap < 0 || config.overlap >= 1)) {
    console.error(`Invalid overlap: ${config.overlap}`);
    return false;
  }
  
  return true;
}

/**
 * Validate audio sample rate
 */
export function validateSampleRate(sampleRate: number): boolean {
  const validRates = [8000, 16000, 22050, 44100, 48000, 96000, 192000];
  return validRates.includes(sampleRate);
}

/**
 * Validate buffer size
 */
export function validateBufferSize(bufferSize: number): boolean {
  const validSizes = [256, 512, 1024, 2048, 4096, 8192, 16384];
  return validSizes.includes(bufferSize);
}