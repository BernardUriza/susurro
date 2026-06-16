import { expect } from 'vitest';
import type { ChunkData, ProcessingMetrics } from '../../types';

// Type aliases for backward compatibility
type ProcessedChunk = ChunkData;
type EngineMetrics = ProcessingMetrics;

/**
 * Custom Vitest matchers for better test assertions
 * Provides domain-specific matchers for audio testing
 */

declare module 'vitest' {
  interface Assertion<T = any> {
    toBeValidChunk(): void;
    toBeValidAudioContext(): void;
    toBeValidMediaStream(): void;
    toBeValidAudioBuffer(): void;
    toHaveVADInRange(min: number, max: number): void;
    toBeWithinRange(min: number, max: number): void;
    toHaveAudioTracks(count?: number): void;
    toBePlayingChunk(): void;
    toBeExpandedChunk(): void;
    toHaveNoiseReduction(percentage: number, tolerance?: number): void;
    toHaveMetricsInRange(metric: keyof ProcessingMetrics, min: number, max: number): void;
  }
}

export function setupCustomMatchers() {
  expect.extend({
    /**
     * Check if object is a valid ProcessedChunk
     */
    toBeValidChunk(received: any) {
      const requiredFields = [
        'id', 'startTime', 'endTime', 'duration',
        'originalSize', 'processedSize', 'averageVad', 'isValid'
      ];

      const missingFields = requiredFields.filter(field => 
        !(field in received) || received[field] === undefined
      );

      const isValid = 
        received &&
        typeof received === 'object' &&
        missingFields.length === 0 &&
        typeof received.id === 'string' &&
        typeof received.startTime === 'number' &&
        typeof received.endTime === 'number' &&
        received.endTime > received.startTime &&
        received.duration === received.endTime - received.startTime;

      return {
        pass: isValid,
        message: () => {
          if (isValid) {
            return `expected ${JSON.stringify(received)} not to be a valid chunk`;
          }
          
          if (missingFields.length > 0) {
            return `expected chunk to have required fields. Missing: ${missingFields.join(', ')}`;
          }
          
          if (received?.endTime <= received?.startTime) {
            return `expected chunk endTime (${received.endTime}) to be greater than startTime (${received.startTime})`;
          }
          
          return `expected ${JSON.stringify(received)} to be a valid chunk with all required properties`;
        },
      };
    },

    /**
     * Check if object is a valid AudioContext
     */
    toBeValidAudioContext(received: any) {
      const requiredProps = ['sampleRate', 'currentTime', 'state', 'destination'];
      const requiredMethods = ['createGain', 'createScriptProcessor', 'close'];

      const missingProps = requiredProps.filter(prop => !(prop in received));
      const missingMethods = requiredMethods.filter(method => 
        typeof received?.[method] !== 'function'
      );

      const isValid = 
        received &&
        typeof received === 'object' &&
        missingProps.length === 0 &&
        missingMethods.length === 0 &&
        typeof received.sampleRate === 'number' &&
        typeof received.currentTime === 'number' &&
        ['suspended', 'running', 'closed'].includes(received.state);

      return {
        pass: isValid,
        message: () => {
          if (isValid) {
            return `expected ${received} not to be a valid AudioContext`;
          }
          
          const errors = [];
          if (missingProps.length > 0) {
            errors.push(`Missing properties: ${missingProps.join(', ')}`);
          }
          if (missingMethods.length > 0) {
            errors.push(`Missing methods: ${missingMethods.join(', ')}`);
          }
          if (received?.state && !['suspended', 'running', 'closed'].includes(received.state)) {
            errors.push(`Invalid state: ${received.state}`);
          }
          
          return `expected to be a valid AudioContext. ${errors.join('. ')}`;
        },
      };
    },

    /**
     * Check if object is a valid MediaStream
     */
    toBeValidMediaStream(received: any) {
      const isValid = 
        received &&
        typeof received === 'object' &&
        typeof received.id === 'string' &&
        typeof received.active === 'boolean' &&
        typeof received.getTracks === 'function' &&
        typeof received.getAudioTracks === 'function' &&
        typeof received.getVideoTracks === 'function';

      return {
        pass: isValid,
        message: () => 
          isValid
            ? `expected ${received} not to be a valid MediaStream`
            : `expected ${received} to be a valid MediaStream with id, active state, and track methods`,
      };
    },

    /**
     * Check if object is a valid AudioBuffer
     */
    toBeValidAudioBuffer(received: any) {
      const isValid = 
        received &&
        typeof received === 'object' &&
        typeof received.sampleRate === 'number' &&
        typeof received.length === 'number' &&
        typeof received.duration === 'number' &&
        typeof received.numberOfChannels === 'number' &&
        typeof received.getChannelData === 'function';

      return {
        pass: isValid,
        message: () => 
          isValid
            ? `expected ${received} not to be a valid AudioBuffer`
            : `expected ${received} to be a valid AudioBuffer with required properties`,
      };
    },

    /**
     * Check if chunk has VAD values in range
     */
    toHaveVADInRange(received: ProcessedChunk, min: number, max: number) {
      const vadValues = received?.vadData?.map((d: any) => d.vad) || [];
      const outOfRange = vadValues.filter((v: any) => v < min || v > max);
      const avgVad = received?.averageVad || 0;

      const pass = 
        vadValues.length > 0 &&
        outOfRange.length === 0 &&
        avgVad >= min &&
        avgVad <= max;

      return {
        pass,
        message: () => {
          if (pass) {
            return `expected VAD values not to be in range [${min}, ${max}]`;
          }
          
          if (vadValues.length === 0) {
            return `expected chunk to have VAD data`;
          }
          
          if (outOfRange.length > 0) {
            return `expected all VAD values to be in range [${min}, ${max}], but found ${outOfRange.length} out of range values: ${outOfRange.join(', ')}`;
          }
          
          return `expected average VAD (${avgVad}) to be in range [${min}, ${max}]`;
        },
      };
    },

    /**
     * Check if number is within range
     */
    toBeWithinRange(received: number, min: number, max: number) {
      const pass = received >= min && received <= max;

      return {
        pass,
        message: () => 
          pass
            ? `expected ${received} not to be within range [${min}, ${max}]`
            : `expected ${received} to be within range [${min}, ${max}]`,
      };
    },

    /**
     * Check if MediaStream has audio tracks
     */
    toHaveAudioTracks(received: any, expectedCount?: number) {
      const audioTracks = received?.getAudioTracks?.() || [];
      const actualCount = audioTracks.length;
      
      const pass = expectedCount === undefined 
        ? actualCount > 0 
        : actualCount === expectedCount;

      return {
        pass,
        message: () => {
          if (expectedCount === undefined) {
            return pass
              ? `expected stream not to have audio tracks`
              : `expected stream to have at least one audio track, but found ${actualCount}`;
          }
          
          return pass
            ? `expected stream not to have ${expectedCount} audio tracks`
            : `expected stream to have ${expectedCount} audio tracks, but found ${actualCount}`;
        },
      };
    },

    /**
     * Check if chunk is playing
     */
    toBePlayingChunk(received: ProcessedChunk) {
      const pass = received?.isPlaying === true;

      return {
        pass,
        message: () => 
          pass
            ? `expected chunk not to be playing`
            : `expected chunk to be playing (isPlaying: ${received?.isPlaying})`,
      };
    },

    /**
     * Check if chunk is expanded
     */
    toBeExpandedChunk(received: ProcessedChunk) {
      const pass = received?.isExpanded === true;

      return {
        pass,
        message: () => 
          pass
            ? `expected chunk not to be expanded`
            : `expected chunk to be expanded (isExpanded: ${received?.isExpanded})`,
      };
    },

    /**
     * Check noise reduction percentage
     */
    toHaveNoiseReduction(received: ProcessedChunk, percentage: number, tolerance = 5) {
      const reduction = received?.originalSize && received?.processedSize
        ? ((received.originalSize - received.processedSize) / received.originalSize) * 100
        : 0;

      const pass = Math.abs(reduction - percentage) <= tolerance;

      return {
        pass,
        message: () => 
          pass
            ? `expected not to have ${percentage}% noise reduction`
            : `expected ${percentage}% (±${tolerance}%) noise reduction, but got ${reduction.toFixed(1)}%`,
      };
    },

    /**
     * Check if metrics are within expected range
     */
    toHaveMetricsInRange(
      received: ProcessedChunk,
      metric: keyof ProcessingMetrics,
      min: number,
      max: number
    ) {
      const value = received?.metrics?.[metric];
      
      if (value === undefined) {
        return {
          pass: false,
          message: () => `expected chunk to have metric "${String(metric)}" but it was undefined`,
        };
      }

      const pass = typeof value === 'number' && value >= min && value <= max;

      return {
        pass,
        message: () => 
          pass
            ? `expected metric "${String(metric)}" (${value}) not to be in range [${min}, ${max}]`
            : `expected metric "${String(metric)}" (${value}) to be in range [${min}, ${max}]`,
      };
    },
  });
}

// Auto-setup when imported
setupCustomMatchers();