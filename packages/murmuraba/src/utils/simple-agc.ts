/**
 * Simple Automatic Gain Control - REFACTORED
 * Based on WebSearch results for Web Audio API AGC
 * 
 * Key findings from WebSearch:
 * - Use DynamicsCompressorNode for reducing dynamics range
 * - Use AnalyserNode + GainNode for manual AGC
 * - Always use setTargetAtTime to prevent clicks
 * - RMS calculation for accurate level detection
 */
export class SimpleAGC {
  private readonly analyser: AnalyserNode;
  private readonly gainNode: GainNode;
  private readonly bufferLength: number;
  private readonly dataArray: Uint8Array<ArrayBuffer>;
  private readonly targetLevel: number;
  private readonly attackTime: number;
  private readonly releaseTime: number;
  private readonly maxGain: number;
  private readonly audioContext: AudioContext;
  
  constructor(audioContext: AudioContext, targetLevel = 0.5) {
    this.audioContext = audioContext;
    this.targetLevel = targetLevel;
    this.attackTime = 0.08;  // 80ms attack - balanced response for voice
    this.releaseTime = 0.4; // 400ms release - smooth adaptation
    this.maxGain = 3.5;     // 3.5x maximum gain for safe louder output
    
    // Create nodes as per WebSearch recommendation
    this.analyser = audioContext.createAnalyser();
    this.gainNode = audioContext.createGain();
    
    // Configure analyser for time-domain analysis
    this.analyser.fftSize = 256;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    
    // Connect nodes
    this.analyser.connect(this.gainNode);
  }
  
  /**
   * Update gain based on current audio level
   * Implements attack/release timing as recommended by WebSearch
   */
  updateGain(): void {
    const currentRMS = this.calculateRMS();
    
    // Only adjust if we have signal (avoid divide by zero)
    if (currentRMS > 0) {
      const targetGain = this.calculateTargetGain(currentRMS);
      this.applyGainSmoothing(targetGain);
    }
  }
  
  /**
   * Calculate RMS (Root Mean Square) level
   * Formula from WebSearch MDN examples
   */
  private calculateRMS(): number {
    this.analyser.getByteTimeDomainData(this.dataArray);
    
    let sum = 0;
    for (let i = 0; i < this.bufferLength; i++) {
      // Convert from 0-255 to -1 to 1
      const normalized = (this.dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    
    return Math.sqrt(sum / this.bufferLength);
  }
  
  /**
   * Calculate target gain with safety limits
   */
  private calculateTargetGain(currentRMS: number): number {
    const rawGain = this.targetLevel / currentRMS;
    return Math.min(rawGain, this.maxGain);
  }
  
  /**
   * Apply gain with proper timing to prevent clicks
   * Uses exponential ramp as per WebSearch recommendation
   */
  private applyGainSmoothing(targetGain: number): void {
    const currentGain = this.gainNode.gain.value;
    const isIncreasing = targetGain > currentGain;
    
    // Use attack time when increasing, release time when decreasing
    const timeConstant = isIncreasing ? this.attackTime : this.releaseTime;
    
    this.gainNode.gain.setTargetAtTime(
      targetGain,
      this.audioContext.currentTime,
      timeConstant
    );
  }
  
  /**
   * Get current gain value for monitoring
   */
  getCurrentGain(): number {
    return this.gainNode.gain.value;
  }
  
  /**
   * Connect source -> analyser -> gain -> destination
   */
  connect(source: AudioNode, destination: AudioNode): void {
    source.connect(this.analyser);
    this.gainNode.connect(destination);
  }
}