/**
 * Zero-Crossing Rate based Voice Activity Detection
 */

export class ZCRVAD {
  private previousSample: number = 0;

  /**
   * Calculate zero-crossing rate of audio frame
   */
  calculateZCR(frame: Float32Array): number {
    let crossings = 0;
    let prevSign = Math.sign(this.previousSample);

    for (let i = 0; i < frame.length; i++) {
      const currentSign = Math.sign(frame[i]);
      if (currentSign !== prevSign && prevSign !== 0) {
        crossings++;
      }
      prevSign = currentSign;
    }

    // Store last sample for continuity
    this.previousSample = frame[frame.length - 1];

    // Normalize by frame length and convert to rate
    return crossings / frame.length;
  }

  /**
   * Detect voice activity based on ZCR
   * Lower ZCR typically indicates voiced speech
   * Higher ZCR indicates unvoiced speech or noise
   */
  detect(frame: Float32Array): number {
    const zcr = this.calculateZCR(frame);
    
    // Typical ranges:
    // Voiced speech: 0.02 - 0.05
    // Unvoiced speech: 0.1 - 0.2
    // Noise: > 0.2
    
    if (zcr < 0.05) {
      return 0.9; // Likely voiced speech
    } else if (zcr < 0.15) {
      return 0.6; // Possibly unvoiced speech
    } else if (zcr < 0.25) {
      return 0.3; // Uncertain
    } else {
      return 0.1; // Likely noise
    }
  }

  /**
   * Get ZCR classification
   */
  classify(zcr: number): string {
    if (zcr < 0.05) return 'voiced';
    if (zcr < 0.15) return 'unvoiced';
    if (zcr < 0.25) return 'mixed';
    return 'noise';
  }

  /**
   * Reset the detector state
   */
  reset(): void {
    this.previousSample = 0;
  }
}