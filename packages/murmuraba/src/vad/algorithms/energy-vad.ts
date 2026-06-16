/**
 * Energy-based Voice Activity Detection
 */

export class EnergyVAD {
  private noiseFloor: number = 0;
  private adaptiveThreshold: number = 0.01;
  private smoothingFactor: number = 0.95;

  /**
   * Calculate RMS energy of audio frame
   */
  calculateEnergy(frame: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < frame.length; i++) {
      sum += frame[i] * frame[i];
    }
    return Math.sqrt(sum / frame.length);
  }

  /**
   * Update noise floor estimate
   */
  updateNoiseFloor(energy: number, isSpeech: boolean): void {
    if (!isSpeech) {
      // Update noise floor with exponential averaging
      this.noiseFloor = this.smoothingFactor * this.noiseFloor + 
                        (1 - this.smoothingFactor) * energy;
      
      // Update adaptive threshold
      this.adaptiveThreshold = Math.max(0.01, this.noiseFloor * 3);
    }
  }

  /**
   * Detect voice activity based on energy
   */
  detect(frame: Float32Array): number {
    const energy = this.calculateEnergy(frame);
    
    // Simple thresholding with adaptive component
    const threshold = Math.max(this.adaptiveThreshold, 0.01);
    const vadScore = Math.min(1, energy / threshold);
    
    // Update noise floor if likely non-speech
    if (vadScore < 0.5) {
      this.updateNoiseFloor(energy, false);
    }
    
    return vadScore;
  }

  /**
   * Calculate energy metrics for a frame
   */
  getMetrics(frame: Float32Array): {
    energy: number;
    noiseFloor: number;
    threshold: number;
  } {
    const energy = this.calculateEnergy(frame);
    return {
      energy,
      noiseFloor: this.noiseFloor,
      threshold: this.adaptiveThreshold
    };
  }

  /**
   * Reset the detector state
   */
  reset(): void {
    this.noiseFloor = 0;
    this.adaptiveThreshold = 0.01;
  }
}