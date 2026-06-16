import { useRef, useState } from 'react';
import { createAudioEngine, AudioEngine, AudioEngineConfig } from '../engines';
import { ProcessingMetrics } from '../engines/types';

export const useAudioEngine = (config: AudioEngineConfig = { engineType: 'rnnoise' }) => {
  console.warn('[Murmuraba] useAudioEngine is deprecated. Please use useMurmubaraEngine instead for better React 19 compatibility.');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const engineDataRef = useRef<any>(null);
  const metricsRef = useRef<ProcessingMetrics>({
    inputSamples: 0,
    outputSamples: 0,
    silenceFrames: 0,
    activeFrames: 0,
    totalInputEnergy: 0,
    totalOutputEnergy: 0,
    peakInput: 0,
    peakOutput: 0,
    startTime: 0,
    totalFrames: 0
  });

  const initializeAudioEngine = async () => {
    if (isInitialized || isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[AudioEngine] Creating audio engine with config:', config);
      
      // Create engine instance
      const engine = createAudioEngine(config);
      await engine.initialize();
      engineRef.current = engine;
      
      // Initialize engine-specific data
      engineDataRef.current = {
        inputBuffer: [],
        outputBuffer: [],
        energyHistory: new Array(20).fill(0),
        energyIndex: 0
      };
      
      console.log('[AudioEngine] Engine ready for processing');
      
      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
      
      // Create processor
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const output = e.outputBuffer.getChannelData(0);
        
        if (!engineRef.current || !engineDataRef.current) {
          output.set(input);
          return;
        }
        
        // Track input metrics
        metricsRef.current.inputSamples += input.length;
        
        // Add to input buffer
        for (let i = 0; i < input.length; i++) {
          engineDataRef.current.inputBuffer.push(input[i]);
          metricsRef.current.peakInput = Math.max(metricsRef.current.peakInput, Math.abs(input[i]));
        }
        
        // Process chunks of 480 samples
        while (engineDataRef.current.inputBuffer.length >= 480) {
          const frame = engineDataRef.current.inputBuffer.splice(0, 480);
          const floatFrame = new Float32Array(frame);
          
          // Process with engine
          const outputData = engineRef.current.process(floatFrame);
          
          // Calculate frame energy for gating
          const frameEnergy = calculateRMS(floatFrame);
          const outputEnergy = calculateRMS(outputData);
          
          // Track frame metrics
          metricsRef.current.totalFrames++;
          metricsRef.current.totalInputEnergy += frameEnergy;
          metricsRef.current.totalOutputEnergy += outputEnergy;
          
          // Update energy history
          engineDataRef.current.energyHistory[engineDataRef.current.energyIndex] = frameEnergy;
          engineDataRef.current.energyIndex = (engineDataRef.current.energyIndex + 1) % 20;
          
          // Calculate average energy
          const avgEnergy = engineDataRef.current.energyHistory.reduce((a: number, b: number) => a + b) / 20;
          
          // Simple energy-based gating
          let processedFrame = outputData;
          const silenceThreshold = 0.001;
          const speechThreshold = 0.005;
          let wasSilenced = false;
          
          if (avgEnergy < silenceThreshold) {
            // Very quiet - attenuate heavily
            processedFrame = processedFrame.map(s => s * 0.1);
            wasSilenced = true;
            metricsRef.current.silenceFrames++;
          } else if (avgEnergy < speechThreshold) {
            // Quiet - moderate attenuation
            const factor = (avgEnergy - silenceThreshold) / (speechThreshold - silenceThreshold);
            const attenuation = 0.1 + 0.9 * factor;
            processedFrame = processedFrame.map(s => s * attenuation);
            metricsRef.current.activeFrames++;
          } else {
            metricsRef.current.activeFrames++;
          }
          
          // Additional noise gate based on RNNoise output vs input ratio
          const reductionRatio = outputEnergy / (frameEnergy + 0.0001);
          if (reductionRatio < 0.3 && avgEnergy < speechThreshold) {
            // RNNoise reduced significantly - likely noise
            processedFrame = processedFrame.map(s => s * reductionRatio);
            if (!wasSilenced) metricsRef.current.silenceFrames++;
          }
          
          // Log occasionally
          if (Math.random() < 0.02) {
            const gateStatus = avgEnergy < silenceThreshold ? 'SILENCE' : 
                             avgEnergy < speechThreshold ? 'TRANSITION' : 'SPEECH';
            console.log('[AudioEngine]',
                       '\n  Status:', gateStatus,
                       '\n  Avg Energy:', avgEnergy.toFixed(6),
                       '\n  Frame Energy:', frameEnergy.toFixed(6),
                       '\n  Engine Reduction:', ((1 - reductionRatio) * 100).toFixed(1) + '%',
                       '\n  Gate Applied:', avgEnergy < speechThreshold ? 'Yes' : 'No');
          }
          
          // Add to output buffer
          for (let i = 0; i < 480; i++) {
            engineDataRef.current.outputBuffer.push(processedFrame[i]);
          }
        }
        
        // Output
        for (let i = 0; i < output.length; i++) {
          if (engineDataRef.current.outputBuffer.length > 0) {
            const sample = engineDataRef.current.outputBuffer.shift();
            output[i] = sample;
            metricsRef.current.outputSamples++;
            metricsRef.current.peakOutput = Math.max(metricsRef.current.peakOutput, Math.abs(sample));
          } else {
            output[i] = 0;
          }
        }
      };
      
      processorRef.current = processor;
      setIsInitialized(true);
      console.log('[AudioEngine] Initialization complete!');
      
    } catch (err) {
      console.error('[AudioEngine] Error:', err);
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const resetMetrics = () => {
    metricsRef.current = {
      inputSamples: 0,
      outputSamples: 0,
      silenceFrames: 0,
      activeFrames: 0,
      totalInputEnergy: 0,
      totalOutputEnergy: 0,
      peakInput: 0,
      peakOutput: 0,
      startTime: Date.now(),
      totalFrames: 0
    };
  };

  const getMetrics = () => {
    const metrics = metricsRef.current;
    const processingTime = Date.now() - metrics.startTime;
    const avgInputEnergy = metrics.totalFrames > 0 ? metrics.totalInputEnergy / metrics.totalFrames : 0;
    const avgOutputEnergy = metrics.totalFrames > 0 ? metrics.totalOutputEnergy / metrics.totalFrames : 0;
    
    // Calculate noise reduction differently - compare silence frames to total frames
    // and consider the energy reduction ratio
    const energyReduction = avgInputEnergy > 0 ? Math.abs(avgInputEnergy - avgOutputEnergy) / avgInputEnergy : 0;
    const silenceRatio = metrics.totalFrames > 0 ? metrics.silenceFrames / metrics.totalFrames : 0;
    
    // Combine both metrics for a more accurate noise reduction estimate
    const noiseReduction = ((energyReduction * 0.5) + (silenceRatio * 0.5)) * 100;
    
    return {
      inputSamples: metrics.inputSamples,
      outputSamples: metrics.outputSamples,
      noiseReductionLevel: Math.max(0, Math.min(100, noiseReduction)),
      silenceFrames: metrics.silenceFrames,
      activeFrames: metrics.activeFrames,
      averageInputEnergy: avgInputEnergy,
      averageOutputEnergy: avgOutputEnergy,
      peakInputLevel: metrics.peakInput,
      peakOutputLevel: metrics.peakOutput,
      processingTimeMs: processingTime,
      chunkOffset: 0,
      totalFramesProcessed: metrics.totalFrames
    };
  };

  const processStream = async (stream: MediaStream): Promise<MediaStream> => {
    if (!isInitialized) {
      await initializeAudioEngine();
    }
    
    if (!audioContextRef.current || !processorRef.current) {
      throw new Error('Not initialized');
    }
    
    // Reset metrics when starting new stream
    resetMetrics();
    
    const source = audioContextRef.current.createMediaStreamSource(stream);
    const destination = audioContextRef.current.createMediaStreamDestination();
    
    source.connect(processorRef.current);
    processorRef.current.connect(destination);
    
    return destination.stream;
  };

  const cleanup = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
    }
    if (engineRef.current) {
      engineRef.current.cleanup();
      engineRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
  };

  return {
    isInitialized,
    isLoading,
    error,
    processStream,
    cleanup,
    initializeAudioEngine,
    getMetrics,
    resetMetrics
  };
};

function calculateRMS(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    sum += frame[i] * frame[i];
  }
  return Math.sqrt(sum / frame.length);
}