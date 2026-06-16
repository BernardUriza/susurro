// import resample from 'audio-resampler'; // This library doesn't work as expected
import { Logger } from '../core/logger';

export interface ResamplingOptions {
  targetSampleRate: number;
  inputSampleRate: number;
  logger?: Logger;
}

export interface ResamplingResult {
  resampledData: Int16Array;
  outputSampleRate: number;
  wasResampled: boolean;
}

export class AudioResampler {
  private static readonly TARGET_SAMPLE_RATE = 48000;
  
  static resamplePCMIfNeeded(
    pcmData: Int16Array,
    options: ResamplingOptions
  ): ResamplingResult {
    const { targetSampleRate, inputSampleRate, logger } = options;
    
    // Validate input parameters
    if (!pcmData || pcmData.length === 0) {
      throw new Error('PCM data cannot be empty');
    }
    
    if (!Number.isFinite(inputSampleRate) || inputSampleRate <= 0) {
      throw new Error(`Invalid input sample rate: ${inputSampleRate}`);
    }
    
    if (!Number.isFinite(targetSampleRate) || targetSampleRate <= 0) {
      throw new Error(`Invalid target sample rate: ${targetSampleRate}`);
    }
    
    // No resampling needed
    if (inputSampleRate === targetSampleRate) {
      logger?.debug(`No resampling needed: already at ${targetSampleRate}Hz`);
      return {
        resampledData: pcmData,
        outputSampleRate: targetSampleRate,
        wasResampled: false
      };
    }
    
    logger?.info(`Resampling from ${inputSampleRate}Hz to ${targetSampleRate}Hz...`);
    
    try {
      const resampled = this.resamplePCM(pcmData, inputSampleRate, targetSampleRate);
      logger?.debug(`Resampling complete: ${resampled.length} samples at ${targetSampleRate}Hz`);
      
      return {
        resampledData: resampled,
        outputSampleRate: targetSampleRate,
        wasResampled: true
      };
    } catch (error) {
      throw new Error(`Resampling failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  static resampleToRNNoiseRate(pcmData: Int16Array, inputSampleRate: number, logger?: Logger): ResamplingResult {
    return this.resamplePCMIfNeeded(pcmData, {
      targetSampleRate: this.TARGET_SAMPLE_RATE,
      inputSampleRate,
      logger
    });
  }
  
  private static pcm16ToFloat32(pcm: Int16Array): Float32Array {
    const f = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; ++i) {
      f[i] = pcm[i] / 32768.0;
    }
    return f;
  }
  
  private static float32ToPcm16(float32: Float32Array): Int16Array {
    const pcm = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; ++i) {
      pcm[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32768)));
    }
    return pcm;
  }
  
  private static resamplePCM(pcm: Int16Array, fromRate: number, toRate: number): Int16Array {
    const input = this.pcm16ToFloat32(pcm);
    const output = this.linearInterpolationResample(input, fromRate, toRate);
    return this.float32ToPcm16(output);
  }
  
  /**
   * Simple linear interpolation resampler
   * This is a basic implementation that should work for most audio resampling needs
   */
  private static linearInterpolationResample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) {
      return input;
    }
    
    const ratio = fromRate / toRate;
    const outputLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLength);
    
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
      const fraction = srcIndex - srcIndexFloor;
      
      // Linear interpolation between two samples
      output[i] = input[srcIndexFloor] * (1 - fraction) + input[srcIndexCeil] * fraction;
    }
    
    return output;
  }
}