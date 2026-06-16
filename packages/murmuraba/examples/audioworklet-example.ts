/**
 * Example: Using AudioWorklet for high-performance audio processing
 */
import { AudioWorkletEngine } from '../src/engines/audio-worklet-engine';

async function runAudioWorkletExample() {
  // Create AudioWorklet engine instance
  const engine = new AudioWorkletEngine({
    enableRNNoise: true,
    // Optional: Custom WASM URL
    // rnnoiseWasmUrl: 'https://your-cdn.com/rnnoise.wasm'
  });
  
  // Check if AudioWorklet is supported
  if (!engine.isAudioWorkletSupported()) {
    console.error('AudioWorklet is not supported in this browser');
    return;
  }
  
  console.log('Initializing AudioWorklet engine...');
  await engine.initialize();
  
  // Set up performance monitoring
  engine.onPerformanceMetrics((metrics) => {
    console.log('Performance metrics:', {
      processingTime: `${metrics.processingTime.toFixed(2)}ms`,
      bufferUnderruns: metrics.bufferUnderruns,
      framesProcessed: metrics.framesProcessed
    });
  });
  
  // Example 1: Process a single audio buffer
  const testBuffer = new Float32Array(480); // RNNoise frame size
  for (let i = 0; i < 480; i++) {
    testBuffer[i] = Math.sin(2 * Math.PI * 440 * i / 48000); // 440Hz sine wave
  }
  
  const processedBuffer = await engine.processWithWorklet(testBuffer);
  console.log('Processed buffer length:', processedBuffer.length);
  
  // Example 2: Real-time microphone processing
  try {
    const pipeline = await engine.createProcessingPipeline({
      echoCancellation: true,
      autoGainControl: true
    });
    
    console.log('Real-time processing pipeline created');
    console.log('Input:', pipeline.input);
    console.log('Output stream:', pipeline.output);
    console.log('Worklet node:', pipeline.workletNode);
    
    // The output stream can be connected to audio elements or WebRTC
    // For example, to play the processed audio:
    // const audio = new Audio();
    // audio.srcObject = pipeline.output;
    // audio.play();
    
    // Send control messages to the worklet
    engine.sendToWorklet({
      type: 'updateSettings',
      data: {
        noiseLevel: 0.8 // Adjust noise suppression level
      }
    });
    
  } catch (error) {
    console.error('Failed to create processing pipeline:', error);
  }
  
  // Check supported features
  const features = engine.getSupportedFeatures();
  console.log('Supported features:', features);
  
  // Clean up when done
  // engine.cleanup();
}

// Performance comparison example
async function comparePerformance() {
  const engine = new AudioWorkletEngine();
  await engine.initialize();
  
  const numFrames = 1000;
  const frameSize = 480;
  const testData = new Float32Array(frameSize);
  
  // Fill with noise
  for (let i = 0; i < frameSize; i++) {
    testData[i] = (Math.random() - 0.5) * 0.1;
  }
  
  console.log(`Processing ${numFrames} frames...`);
  
  const startTime = performance.now();
  
  for (let i = 0; i < numFrames; i++) {
    await engine.processWithWorklet(testData);
  }
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const avgTimePerFrame = totalTime / numFrames;
  
  console.log(`Total processing time: ${totalTime.toFixed(2)}ms`);
  console.log(`Average time per frame: ${avgTimePerFrame.toFixed(3)}ms`);
  console.log(`Theoretical FPS: ${(1000 / avgTimePerFrame).toFixed(0)}`);
  
  engine.cleanup();
}

// Run the examples
if (typeof window !== 'undefined') {
  // Browser environment
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.createElement('button');
    button.textContent = 'Run AudioWorklet Example';
    button.onclick = runAudioWorkletExample;
    document.body.appendChild(button);
    
    const perfButton = document.createElement('button');
    perfButton.textContent = 'Run Performance Test';
    perfButton.onclick = comparePerformance;
    document.body.appendChild(perfButton);
  });
} else {
  // Node.js environment (for testing)
  console.log('AudioWorklet requires a browser environment');
}

export { runAudioWorkletExample, comparePerformance };