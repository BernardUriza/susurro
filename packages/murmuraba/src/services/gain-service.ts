/**
 * Optimized Gain Management Service
 * Reduces re-renders and provides centralized gain control
 */

import { GainController, validateGain } from '../utils/gain-control';

export interface GainServiceOptions {
  initialGain?: number;
  throttleMs?: number;
  enableSmoothing?: boolean;
  smoothingTimeConstant?: number;
}

export class GainService {
  private gainController: GainController;
  private gainNode?: GainNode;
  private audioContext?: AudioContext;
  private throttleTimer?: NodeJS.Timeout;
  private pendingGain?: number;
  private readonly throttleMs: number;
  private readonly enableSmoothing: boolean;
  private readonly smoothingTimeConstant: number;
  private updateListeners: Set<(gain: number) => void> = new Set();

  constructor(options: GainServiceOptions = {}) {
    this.gainController = new GainController(options.initialGain);
    this.throttleMs = options.throttleMs ?? 16; // ~60fps
    this.enableSmoothing = options.enableSmoothing ?? true;
    this.smoothingTimeConstant = options.smoothingTimeConstant ?? 0.01; // 10ms
  }

  /**
   * Initialize the service with an audio context
   */
  initialize(audioContext: AudioContext): void {
    this.audioContext = audioContext;
    this.createGainNode();
  }

  /**
   * Get the gain node for audio graph connection
   */
  getGainNode(): GainNode | undefined {
    return this.gainNode;
  }

  /**
   * Set gain with throttling to prevent excessive updates
   */
  setGain(gain: number): void {
    const validatedGain = validateGain(gain);
    
    // Update controller immediately for sync state
    this.gainController.setGain(validatedGain);
    
    // Throttle actual audio node updates
    this.pendingGain = validatedGain;
    
    if (this.throttleTimer) {
      return; // Update already scheduled
    }
    
    this.throttleTimer = setTimeout(() => {
      this.applyPendingGain();
      this.throttleTimer = undefined;
    }, this.throttleMs);
  }

  /**
   * Get current gain value
   */
  getCurrentGain(): number {
    return this.gainController.currentGain;
  }

  /**
   * Apply gain preset
   */
  applyPreset(preset: 'LOW' | 'NORMAL' | 'HIGH' | 'BOOST'): void {
    this.gainController.applyPreset(preset);
    this.applyPendingGain();
  }

  /**
   * Get gain description for UI
   */
  getDescription(): string {
    return this.gainController.getDescription();
  }

  /**
   * Get gain in decibels for display
   */
  getDbValue(): number {
    return this.gainController.getDbValue();
  }

  /**
   * Subscribe to gain changes
   */
  onGainChange(callback: (gain: number) => void): () => void {
    this.updateListeners.add(callback);
    return () => this.updateListeners.delete(callback);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
    }
    this.gainController.destroy();
    this.updateListeners.clear();
    this.gainNode?.disconnect();
  }

  private createGainNode(): void {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }
    
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.gainController.currentGain;
  }

  private applyPendingGain(): void {
    if (!this.gainNode || this.pendingGain === undefined) {
      return;
    }

    const targetGain = this.pendingGain;
    this.pendingGain = undefined;

    if (this.enableSmoothing && this.audioContext) {
      // Apply smooth transition to prevent audio clicks
      this.gainNode.gain.setTargetAtTime(
        targetGain,
        this.audioContext.currentTime,
        this.smoothingTimeConstant
      );
    } else {
      this.gainNode.gain.value = targetGain;
    }

    // Notify listeners with throttled updates
    this.notifyListeners(targetGain);
  }

  private notifyListeners(gain: number): void {
    this.updateListeners.forEach(callback => {
      try {
        callback(gain);
      } catch (error) {
        console.warn('Gain service listener error:', error);
      }
    });
  }
}

/**
 * Singleton instance for global use
 */
let globalGainService: GainService | null = null;

export function getGainService(options?: GainServiceOptions): GainService {
  if (!globalGainService) {
    globalGainService = new GainService(options);
  }
  return globalGainService;
}

export function destroyGainService(): void {
  if (globalGainService) {
    globalGainService.destroy();
    globalGainService = null;
  }
}