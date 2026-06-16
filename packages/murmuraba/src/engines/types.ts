export interface AudioEngine {
  name: string;
  description: string;
  initialize: () => Promise<void>;
  process: (inputBuffer: Float32Array) => Float32Array;
  cleanup: () => void;
  isInitialized: boolean;
}

export interface AudioEngineConfig {
  engineType: 'rnnoise' | 'speex' | 'custom';
  options?: Record<string, any>;
}

export interface ProcessingMetrics {
  inputSamples: number;
  outputSamples: number;
  silenceFrames: number;
  activeFrames: number;
  totalInputEnergy: number;
  totalOutputEnergy: number;
  peakInput: number;
  peakOutput: number;
  startTime: number;
  totalFrames: number;
}