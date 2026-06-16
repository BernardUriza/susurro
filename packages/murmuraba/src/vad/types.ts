/**
 * VAD Types and Interfaces
 */

export interface VADResult {
  average: number;      // Average VAD score (0.0 to 1.0)
  scores: number[];     // Frame-by-frame VAD scores
  metrics: VADMetric[]; // Detailed metrics per frame
  voiceSegments?: VoiceSegment[]; // Optional voice segments
}

export interface VADMetric {
  timestamp: number;    // Time in seconds
  vadScore: number;     // VAD probability (0-1)
  energy: number;       // RMS energy
  zeroCrossingRate: number; // Zero-crossing rate
}

export interface VoiceSegment {
  startTime: number;    // Start time in seconds
  endTime: number;      // End time in seconds
  confidence: number;   // Average confidence (0-1)
}

export interface AudioMetadata {
  duration: number;     // Duration in seconds
  sampleRate: number;   // Sample rate in Hz
  channels: number;     // Number of channels
  bitDepth: number;     // Bits per sample
  format: string;       // Audio format (wav, mp3, webm, etc.)
}

export interface VADConfig {
  frameSize?: number;   // Frame size in samples (default: 480 for 20ms at 24kHz)
  energyThreshold?: number; // Energy threshold for VAD
  zcrThreshold?: number; // Zero-crossing rate threshold
  minSegmentDuration?: number; // Minimum segment duration in seconds
  hangoverTime?: number; // Hangover time in seconds
  useRNNoise?: boolean; // Use RNNoise if available
}

export const DEFAULT_VAD_CONFIG: VADConfig = {
  frameSize: 480,       // 20ms at 24kHz
  energyThreshold: 0.01,
  zcrThreshold: 0.5,
  minSegmentDuration: 0.1, // 100ms
  hangoverTime: 0.3,    // 300ms
  useRNNoise: true
};