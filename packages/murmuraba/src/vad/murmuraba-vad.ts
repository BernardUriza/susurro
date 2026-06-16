/**
 * Main VAD Implementation
 * Combines multiple VAD algorithms for robust voice activity detection
 */

import { VADResult, VADConfig, DEFAULT_VAD_CONFIG, VADMetric } from './types';
import { EnergyVAD } from './algorithms/energy-vad';
import { ZCRVAD } from './algorithms/zcr-vad';
import { SegmentDetector } from './algorithms/segment-detector';
import { RNNoiseEngine } from '../engines/rnnoise-engine';

export async function murmubaraVAD(
  buffer: ArrayBuffer, 
  config: Partial<VADConfig> = {}
): Promise<VADResult> {
  const vadConfig = { ...DEFAULT_VAD_CONFIG, ...config };
  
  // Convert buffer to Float32Array
  const audioData = await convertToFloat32(buffer);
  
  // Resample to 24kHz if needed (RNNoise requirement)
  const targetSampleRate = 24000;
  const resampled = await resampleAudio(audioData, targetSampleRate);
  
  // Initialize detectors
  const energyVAD = new EnergyVAD();
  const zcrVAD = new ZCRVAD();
  const segmentDetector = new SegmentDetector(
    vadConfig.minSegmentDuration,
    vadConfig.hangoverTime
  );
  
  // Try to use RNNoise if available
  let rnnoiseEngine: RNNoiseEngine | null = null;
  if (vadConfig.useRNNoise) {
    try {
      rnnoiseEngine = new RNNoiseEngine();
      await rnnoiseEngine.initialize();
    } catch (error) {
      console.warn('RNNoise not available, falling back to energy/ZCR VAD');
      rnnoiseEngine = null;
    }
  }
  
  // Process audio in frames
  const frameSize = vadConfig.frameSize || 480; // 20ms at 24kHz
  const frameTime = frameSize / targetSampleRate;
  const numFrames = Math.floor(resampled.length / frameSize);
  
  const scores: number[] = [];
  const metrics: VADMetric[] = [];
  
  for (let i = 0; i < numFrames; i++) {
    const start = i * frameSize;
    const end = start + frameSize;
    const frame = resampled.slice(start, end);
    
    if (frame.length < frameSize) {
      // Pad last frame if needed
      const paddedFrame = new Float32Array(frameSize);
      paddedFrame.set(frame);
      frame.set(paddedFrame);
    }
    
    // Get VAD scores from different algorithms
    const energyScore = energyVAD.detect(frame);
    const zcrScore = zcrVAD.detect(frame);
    let vadScore: number;
    
    if (rnnoiseEngine && rnnoiseEngine.isInitialized) {
      // Use RNNoise VAD if available
      rnnoiseEngine.process(frame);
      vadScore = (rnnoiseEngine as any).lastVad || 0;
      
      // Combine with energy for robustness
      vadScore = vadScore * 0.7 + energyScore * 0.3;
    } else {
      // Combine energy and ZCR scores
      vadScore = energyScore * 0.7 + zcrScore * 0.3;
    }
    
    scores.push(vadScore);
    
    // Calculate metrics
    const energyMetrics = energyVAD.getMetrics(frame);
    const zcr = zcrVAD.calculateZCR(frame);
    
    metrics.push({
      timestamp: i * frameTime,
      vadScore,
      energy: energyMetrics.energy,
      zeroCrossingRate: zcr
    });
  }
  
  // Smooth scores
  const smoothedScores = segmentDetector.smoothScores(scores, 5);
  
  // Detect voice segments
  const voiceSegments = segmentDetector.detectSegments(
    smoothedScores, 
    frameTime,
    0.5
  );
  
  // Calculate average VAD score
  const average = smoothedScores.reduce((a, b) => a + b, 0) / smoothedScores.length;
  
  // Cleanup
  if (rnnoiseEngine) {
    rnnoiseEngine.cleanup();
  }
  
  return {
    average,
    scores: smoothedScores,
    metrics,
    voiceSegments
  };
}

/**
 * Convert audio buffer to Float32Array
 */
async function convertToFloat32(buffer: ArrayBuffer): Promise<Float32Array> {
  // Check if it's already Float32
  if (buffer.byteLength % 4 === 0) {
    const testView = new DataView(buffer);
    const firstSample = testView.getFloat32(0, true);
    if (Math.abs(firstSample) <= 1.0) {
      return new Float32Array(buffer);
    }
  }
  
  // Fallback to simple conversion
  // AudioConverter is for WebM->WAV conversion, not for getting Float32
  return simpleConvertToFloat32(buffer);
}

/**
 * Simple conversion to Float32 (assumes 16-bit PCM)
 */
function simpleConvertToFloat32(buffer: ArrayBuffer): Float32Array {
  const int16 = new Int16Array(buffer);
  const float32 = new Float32Array(int16.length);
  
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  
  return float32;
}

/**
 * Resample audio to target sample rate
 */
async function resampleAudio(
  audioData: Float32Array, 
  targetSampleRate: number,
  originalSampleRate: number = 44100
): Promise<Float32Array> {
  if (originalSampleRate === targetSampleRate) {
    return audioData;
  }
  
  // Simple linear interpolation resampling
  const ratio = originalSampleRate / targetSampleRate;
  const outputLength = Math.floor(audioData.length / ratio);
  const output = new Float32Array(outputLength);
  
  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i * ratio;
    const sourceIndexInt = Math.floor(sourceIndex);
    const fraction = sourceIndex - sourceIndexInt;
    
    if (sourceIndexInt + 1 < audioData.length) {
      // Linear interpolation
      output[i] = audioData[sourceIndexInt] * (1 - fraction) + 
                  audioData[sourceIndexInt + 1] * fraction;
    } else {
      output[i] = audioData[sourceIndexInt];
    }
  }
  
  return output;
}