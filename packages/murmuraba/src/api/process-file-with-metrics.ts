import { getEngine } from '../api';

/**
 * Apply gain to WAV audio buffer
 */
function applyGainToBuffer(arrayBuffer: ArrayBuffer, gain: number): ArrayBuffer {
  const view = new DataView(arrayBuffer);
  const newBuffer = new ArrayBuffer(arrayBuffer.byteLength);
  const newView = new DataView(newBuffer);
  
  // Copy WAV header (first 44 bytes)
  for (let i = 0; i < 44; i++) {
    newView.setUint8(i, view.getUint8(i));
  }
  
  // Apply gain to audio samples (16-bit PCM)
  for (let i = 44; i < arrayBuffer.byteLength - 1; i += 2) {
    const sample = view.getInt16(i, true);
    const amplified = Math.max(-32768, Math.min(32767, sample * gain));
    newView.setInt16(i, amplified, true);
  }
  
  return newBuffer;
}

export interface ProcessingMetrics {
  vad: number;
  frame: number;
  timestamp: number;
  rms: number;
}

export interface ProcessFileWithMetricsResult {
  processedBuffer: ArrayBuffer;
  metrics: ProcessingMetrics[];
  averageVad: number;
}

/**
 * Process audio file and capture VAD metrics frame by frame
 */
export async function processFileWithMetrics(
  arrayBuffer: ArrayBuffer,
  onFrameProcessed?: (metrics: ProcessingMetrics) => void,
  outputGain: number = 2.5  // Apply 2.5x gain to processed audio for balanced louder output
): Promise<ProcessFileWithMetricsResult> {
  const engine = getEngine();
  const metrics: ProcessingMetrics[] = [];
  let frameCount = 0;
  let totalVad = 0;
  
  // Hook into the engine's frame processing
  const originalProcessFrame = engine['processFrame'].bind(engine);
  engine['processFrame'] = function(frame: Float32Array) {
    const result = originalProcessFrame(frame);
    
    // Calculate RMS
    let sum = 0;
    for (let i = 0; i < frame.length; i++) {
      sum += frame[i] * frame[i];
    }
    const rms = Math.sqrt(sum / frame.length);
    
    const metric: ProcessingMetrics = {
      vad: result.vad,
      frame: frameCount++,
      timestamp: Date.now(),
      rms
    };
    
    metrics.push(metric);
    totalVad += result.vad;
    
    if (onFrameProcessed) {
      onFrameProcessed(metric);
    }
    
    return result;
  };
  
  try {
    // Process the file
    let processedBuffer = await engine.processFile(arrayBuffer);
    
    // Apply output gain to make audio louder
    if (outputGain !== 1.0) {
      processedBuffer = applyGainToBuffer(processedBuffer, outputGain);
    }
    
    // Restore original method
    engine['processFrame'] = originalProcessFrame;
    
    const averageVad = metrics.length > 0 ? totalVad / metrics.length : 0;
    
    return {
      processedBuffer,
      metrics,
      averageVad
    };
  } catch (error) {
    // Restore original method on error
    engine['processFrame'] = originalProcessFrame;
    throw error;
  }
}