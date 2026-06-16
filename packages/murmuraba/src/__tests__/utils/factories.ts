import { vi } from 'vitest';
import type { ChunkData, ProcessingMetrics } from '../../types';

// Type aliases for backward compatibility
type ProcessedChunk = ChunkData;
type EngineMetrics = ProcessingMetrics;

/**
 * Test data factories for creating consistent test objects
 * Eliminates duplication of test data creation across test files
 */

// VAD Data Factory
export interface VADData {
  time: number;
  vad: number;
}

export class VADDataFactory {
  static create(time: number, vad: number): VADData {
    return { time, vad };
  }

  static createSequence(count: number, baseVad = 0.5): VADData[] {
    return Array.from({ length: count }, (_, i) => ({
      time: i,
      vad: baseVad + (Math.sin(i * 0.5) * 0.3), // Simulate variation
    }));
  }

  static createSpeechPattern(): VADData[] {
    // Simulates typical speech pattern with pauses
    return [
      { time: 0, vad: 0.1 },   // Silence
      { time: 1, vad: 0.7 },   // Speech starts
      { time: 2, vad: 0.9 },   // Peak speech
      { time: 3, vad: 0.8 },   // Continued speech
      { time: 4, vad: 0.3 },   // Trailing off
      { time: 5, vad: 0.1 },   // Pause
      { time: 6, vad: 0.6 },   // Speech resumes
      { time: 7, vad: 0.85 },  // Strong speech
      { time: 8, vad: 0.4 },   // Ending
      { time: 9, vad: 0.05 },  // Silence
    ];
  }
}

// Metrics Factory
export class MetricsFactory {
  static create(overrides: Partial<EngineMetrics> = {}): EngineMetrics {
    return {
      processingLatency: 45.2,
      frameCount: 100,
      inputLevel: 0.8,
      outputLevel: 0.7,
      noiseReductionLevel: 0.755,
      timestamp: Date.now(),
      droppedFrames: 0,
      ...overrides,
    };
  }

  static createHighPerformance(): EngineMetrics {
    return this.create({
      processingLatency: 10.5,
      frameCount: 1000,
      droppedFrames: 0,
      inputLevel: 0.9,
      outputLevel: 0.85,
      noiseReductionLevel: 0.95,
    });
  }

  static createLowPerformance(): EngineMetrics {
    return this.create({
      processingLatency: 150.8,
      frameCount: 50,
      droppedFrames: 25,
      inputLevel: 0.3,
      outputLevel: 0.2,
      noiseReductionLevel: 0.4,
    });
  }
}

// Chunk Factory
export class ChunkFactory {
  private static idCounter = 0;

  static reset() {
    this.idCounter = 0;
  }

  static create(overrides: Partial<ProcessedChunk> = {}): ProcessedChunk {
    const now = Date.now();
    const id = overrides.id || `chunk-${++this.idCounter}`;
    const duration = overrides.duration || 10000;
    
    return {
      id,
      index: 0,
      startTime: now - duration,
      endTime: now,
      duration,
      originalSize: 1024000,
      processedSize: 950000,
      noiseRemoved: 74000,
      averageVad: 0.5,
      vadData: VADDataFactory.createSequence(5),
      metrics: MetricsFactory.create(),
      isPlaying: false,
      isExpanded: false,
      isValid: true,
      ...overrides,
    };
  }

  static createWithVAD(averageVad: number, id?: string): ProcessedChunk {
    return this.create({
      id: id || `chunk-vad-${averageVad}`,
      averageVad,
      vadData: VADDataFactory.createSequence(10, averageVad),
    });
  }

  static createWithSpeech(): ProcessedChunk {
    const vadData = VADDataFactory.createSpeechPattern();
    const averageVad = vadData.reduce((sum, d) => sum + d.vad, 0) / vadData.length;
    
    return this.create({
      id: 'chunk-speech',
      averageVad,
      vadData,
    });
  }

  static createInvalid(): ProcessedChunk {
    return this.create({
      id: 'chunk-invalid',
      isValid: false,
      noiseRemoved: 0,
      averageVad: 0,
      vadData: [],
    });
  }

  static createPlaying(): ProcessedChunk {
    return this.create({
      id: 'chunk-playing',
      isPlaying: true,
    });
  }

  static createExpanded(): ProcessedChunk {
    return this.create({
      id: 'chunk-expanded',
      isExpanded: true,
    });
  }

  static createBatch(count: number): ProcessedChunk[] {
    return Array.from({ length: count }, (_, i) =>
      this.create({ id: `chunk-batch-${i}` })
    );
  }

  static createSequence(options: {
    count: number;
    startTime?: number;
    duration?: number;
  }): ProcessedChunk[] {
    const { count, startTime = Date.now() - 100000, duration = 10000 } = options;
    const chunks: ProcessedChunk[] = [];
    
    for (let i = 0; i < count; i++) {
      const chunkStart = startTime + (i * duration);
      chunks.push(
        this.create({
          id: `chunk-seq-${i}`,
          startTime: chunkStart,
          endTime: chunkStart + duration,
          duration,
        })
      );
    }
    
    return chunks;
  }
}

// MediaStream Factory
export class MediaStreamFactory {
  static create(options: { 
    audio?: boolean; 
    video?: boolean;
    id?: string;
  } = { audio: true }) {
    const tracks: any[] = [];
    
    if (options.audio !== false) {
      tracks.push(this.createAudioTrack());
    }
    
    if (options.video) {
      tracks.push(this.createVideoTrack());
    }

    return {
      id: options.id || `stream-${Math.random().toString(36).substr(2, 9)}`,
      active: true,
      getTracks: vi.fn(() => tracks),
      getAudioTracks: vi.fn(() => tracks.filter(t => t.kind === 'audio')),
      getVideoTracks: vi.fn(() => tracks.filter(t => t.kind === 'video')),
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      clone: vi.fn().mockReturnThis(),
      getTrackById: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onaddtrack: null,
      onremovetrack: null,
    };
  }

  static createAudioTrack(options: Partial<MediaStreamTrack> = {}) {
    return {
      kind: 'audio' as const,
      id: `track-${Math.random().toString(36).substr(2, 9)}`,
      label: 'Mock Audio Track',
      enabled: true,
      muted: false,
      readyState: 'live' as MediaStreamTrackState,
      stop: vi.fn(),
      clone: vi.fn().mockReturnThis(),
      getCapabilities: vi.fn(() => ({
        channelCount: { min: 1, max: 2 },
        echoCancellation: [true, false],
        noiseSuppression: [true, false],
        sampleRate: { min: 8000, max: 48000 },
        sampleSize: { min: 8, max: 32 },
      })),
      getConstraints: vi.fn(() => ({})),
      getSettings: vi.fn(() => ({
        deviceId: 'default',
        groupId: 'default-group',
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2,
        sampleRate: 48000,
        sampleSize: 16,
      })),
      applyConstraints: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      ...options,
    };
  }

  static createVideoTrack(options: Partial<MediaStreamTrack> = {}) {
    return {
      ...this.createAudioTrack(options),
      kind: 'video' as const,
      label: 'Mock Video Track',
      getCapabilities: vi.fn(() => ({
        width: { min: 320, max: 1920 },
        height: { min: 240, max: 1080 },
        frameRate: { min: 1, max: 60 },
        facingMode: ['user', 'environment'],
      })),
      getSettings: vi.fn(() => ({
        deviceId: 'default-camera',
        groupId: 'default-group',
        width: 1280,
        height: 720,
        frameRate: 30,
        facingMode: 'user',
      })),
    };
  }

  static createInactiveStream() {
    const stream = this.create();
    stream.active = false;
    stream.getTracks().forEach((track: any) => {
      track.readyState = 'ended';
    });
    return stream;
  }
}

// Audio Buffer Factory
export class AudioBufferFactory {
  static create(options: {
    numberOfChannels?: number;
    length?: number;
    sampleRate?: number;
    fillWith?: 'silence' | 'sine' | 'noise' | 'custom';
    customData?: Float32Array;
  } = {}) {
    const {
      numberOfChannels = 2,
      length = 48000,
      sampleRate = 48000,
      fillWith = 'silence',
      customData,
    } = options;

    const channelData = this.generateChannelData(length, fillWith, customData);

    return {
      numberOfChannels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: vi.fn((channel: number) => {
        if (channel >= numberOfChannels) {
          throw new Error(`Channel ${channel} does not exist`);
        }
        return channelData;
      }),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    };
  }

  private static generateChannelData(
    length: number,
    fillWith: string,
    customData?: Float32Array
  ): Float32Array {
    if (customData) {
      return customData;
    }

    const data = new Float32Array(length);

    switch (fillWith) {
      case 'sine':
        for (let i = 0; i < length; i++) {
          data[i] = Math.sin(2 * Math.PI * 440 * i / 48000);
        }
        break;
      case 'noise':
        for (let i = 0; i < length; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        break;
      case 'silence':
      default:
        // Already filled with zeros
        break;
    }

    return data;
  }
}

// WASM Module Factory
export class WASMModuleFactory {
  static create(options: {
    rnnoiseState?: number;
    vadProbability?: number;
    memorySize?: number;
  } = {}) {
    const {
      rnnoiseState = 12345,
      vadProbability = 0.7,
      memorySize = 10000,
    } = options;

    return {
      _rnnoise_create: vi.fn().mockReturnValue(rnnoiseState),
      _rnnoise_destroy: vi.fn(),
      _rnnoise_process_frame: vi.fn().mockReturnValue(vadProbability),
      _malloc: vi.fn((size: number) => size),
      _free: vi.fn(),
      HEAPF32: new Float32Array(memorySize),
      HEAP32: new Int32Array(memorySize),
      HEAPU8: new Uint8Array(memorySize),
      HEAPU32: new Uint32Array(memorySize),
    };
  }

  static createWithError() {
    return {
      _rnnoise_create: vi.fn().mockReturnValue(0), // Return 0 to indicate error
      _rnnoise_destroy: vi.fn(),
      _rnnoise_process_frame: vi.fn().mockImplementation(() => {
        throw new Error('WASM processing error');
      }),
      _malloc: vi.fn().mockReturnValue(0),
      _free: vi.fn(),
      HEAPF32: new Float32Array(0),
      HEAP32: new Int32Array(0),
      HEAPU8: new Uint8Array(0),
      HEAPU32: new Uint32Array(0),
    };
  }
}

// Blob Factory
export class BlobFactory {
  static createAudioBlob(sizeInKB = 10, mimeType = 'audio/webm'): Blob {
    const size = sizeInKB * 1024;
    const data = new Uint8Array(size);
    
    // Fill with some pattern to simulate audio data
    for (let i = 0; i < size; i++) {
      data[i] = Math.floor(Math.sin(i * 0.01) * 127 + 128);
    }
    
    return new Blob([data], { type: mimeType });
  }

  static createVideoBlob(sizeInKB = 100, mimeType = 'video/webm'): Blob {
    const size = sizeInKB * 1024;
    const data = new Uint8Array(size);
    
    // Fill with pattern
    for (let i = 0; i < size; i++) {
      data[i] = i % 256;
    }
    
    return new Blob([data], { type: mimeType });
  }

  static createTextBlob(content: string): Blob {
    return new Blob([content], { type: 'text/plain' });
  }
}