/**
 * Audio Test Helpers
 * REAL audio data generation for REAL testing
 * No more bullshit mocks that don't test anything
 */

export interface NoiseProfile {
  whiteNoise: number;      // 0-1 white noise level
  pinkNoise?: number;      // 0-1 pink noise level  
  brownNoise?: number;     // 0-1 brown noise level
  hum?: { freq: number; level: number }; // 50/60Hz hum
  crackle?: number;        // 0-1 random pops
}

/**
 * Generate a sine wave at specified frequency
 */
export function generateSineWave(
  frequency: number, 
  sampleRate: number, 
  duration: number,
  amplitude = 1.0
): Float32Array {
  const samples = Math.floor(sampleRate * duration);
  const data = new Float32Array(samples);
  
  for (let i = 0; i < samples; i++) {
    data[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate);
  }
  
  return data;
}

/**
 * Generate realistic speech-like signal using formants
 */
export function generateSpeechLikeSignal(
  sampleRate: number,
  duration: number
): Float32Array {
  const samples = Math.floor(sampleRate * duration);
  const data = new Float32Array(samples);
  
  // Typical formant frequencies for vowel 'a'
  const formants = [700, 1220, 2600];
  const bandwidths = [130, 70, 160];
  
  for (let i = 0; i < samples; i++) {
    let sample = 0;
    
    // Add each formant
    formants.forEach((freq, idx) => {
      const envelope = Math.exp(-bandwidths[idx] * i / sampleRate);
      sample += envelope * Math.sin(2 * Math.PI * freq * i / sampleRate) / formants.length;
    });
    
    // Add fundamental frequency (pitch)
    sample += 0.3 * Math.sin(2 * Math.PI * 120 * i / sampleRate);
    
    // Apply envelope for more natural speech
    const globalEnvelope = Math.sin(Math.PI * i / samples);
    data[i] = sample * globalEnvelope * 0.5;
  }
  
  return data;
}

/**
 * Add realistic noise to clean audio
 */
export function addNoise(
  cleanAudio: Float32Array,
  noiseProfile: NoiseProfile
): Float32Array {
  const noisyAudio = new Float32Array(cleanAudio);
  
  // Add white noise
  if (noiseProfile.whiteNoise > 0) {
    for (let i = 0; i < noisyAudio.length; i++) {
      noisyAudio[i] += (Math.random() - 0.5) * 2 * noiseProfile.whiteNoise;
    }
  }
  
  // Add pink noise (1/f noise)
  if (noiseProfile.pinkNoise) {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < noisyAudio.length; i++) {
      const white = Math.random() - 0.5;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      noisyAudio[i] += pink * noiseProfile.pinkNoise * 0.11;
    }
  }
  
  // Add brown noise (1/f² noise)
  if (noiseProfile.brownNoise) {
    let lastOut = 0;
    for (let i = 0; i < noisyAudio.length; i++) {
      const white = Math.random() - 0.5;
      const brown = (lastOut + (0.02 * white)) / 1.02;
      lastOut = brown;
      noisyAudio[i] += brown * noiseProfile.brownNoise * 3.5;
    }
  }
  
  // Add AC hum
  if (noiseProfile.hum) {
    const { freq, level } = noiseProfile.hum;
    for (let i = 0; i < noisyAudio.length; i++) {
      noisyAudio[i] += level * Math.sin(2 * Math.PI * freq * i / 48000);
    }
  }
  
  // Add random crackle/pops
  if (noiseProfile.crackle) {
    for (let i = 0; i < noisyAudio.length; i++) {
      if (Math.random() < noiseProfile.crackle * 0.001) {
        noisyAudio[i] += (Math.random() - 0.5) * 2;
      }
    }
  }
  
  return noisyAudio;
}

/**
 * Generate test audio chunks for RNNoise (480 samples each)
 */
export function generateTestChunks(
  signalType: 'sine' | 'speech' | 'silence',
  noiseProfile: NoiseProfile,
  numChunks: number,
  frequency = 440
): Float32Array[] {
  const chunks: Float32Array[] = [];
  const samplesPerChunk = 480; // RNNoise requirement
  const sampleRate = 48000; // RNNoise requirement
  
  // Generate base signal
  let baseSignal: Float32Array;
  const totalSamples = samplesPerChunk * numChunks;
  const duration = totalSamples / sampleRate;
  
  switch (signalType) {
    case 'sine':
      baseSignal = generateSineWave(frequency, sampleRate, duration);
      break;
    case 'speech':
      baseSignal = generateSpeechLikeSignal(sampleRate, duration);
      break;
    case 'silence':
      baseSignal = new Float32Array(totalSamples);
      break;
  }
  
  // Add noise
  const noisySignal = addNoise(baseSignal, noiseProfile);
  
  // Split into chunks
  for (let i = 0; i < numChunks; i++) {
    const chunk = noisySignal.slice(
      i * samplesPerChunk, 
      (i + 1) * samplesPerChunk
    );
    chunks.push(chunk);
  }
  
  return chunks;
}

/**
 * Calculate Signal-to-Noise Ratio (SNR) in dB
 */
export function calculateSNR(clean: Float32Array, noisy: Float32Array): number {
  if (clean.length !== noisy.length) {
    throw new Error('Arrays must have same length');
  }
  
  let signalPower = 0;
  let noisePower = 0;
  
  for (let i = 0; i < clean.length; i++) {
    signalPower += clean[i] * clean[i];
    const noise = noisy[i] - clean[i];
    noisePower += noise * noise;
  }
  
  signalPower /= clean.length;
  noisePower /= clean.length;
  
  if (noisePower === 0) return Infinity;
  
  return 10 * Math.log10(signalPower / noisePower);
}

/**
 * Measure noise reduction effectiveness
 */
export function measureNoiseReduction(
  original: Float32Array,
  processed: Float32Array,
  expectedReduction = 0.7 // 70% noise reduction expected
): { 
  passed: boolean; 
  reduction: number;
  message: string;
} {
  // Calculate RMS of both signals
  const originalRMS = Math.sqrt(
    original.reduce((sum, val) => sum + val * val, 0) / original.length
  );
  
  const processedRMS = Math.sqrt(
    processed.reduce((sum, val) => sum + val * val, 0) / processed.length
  );
  
  const reduction = 1 - (processedRMS / originalRMS);
  const passed = reduction >= expectedReduction * 0.9; // 90% of expected
  
  return {
    passed,
    reduction,
    message: `Noise reduction: ${(reduction * 100).toFixed(1)}% (expected: ${(expectedReduction * 100).toFixed(1)}%)`
  };
}