/**
 * Centralized Gain Control Utilities
 * Eliminates code duplication and provides consistent gain management
 */

export interface GainConfig {
  min: number;
  max: number;
  default: number;
  step: number;
}

export const DEFAULT_GAIN_CONFIG: GainConfig = {
  min: 0.5,
  max: 3.0,
  default: 1.0,
  step: 0.1
} as const;

export const GAIN_PRESETS = {
  LOW: 0.7,
  NORMAL: 1.0,
  HIGH: 1.5,
  BOOST: 2.0
} as const;

/**
 * Validates and clamps gain value within acceptable range
 */
export function validateGain(gain: number, config: GainConfig = DEFAULT_GAIN_CONFIG): number {
  if (typeof gain !== 'number' || isNaN(gain)) {
    return config.default;
  }
  return Math.max(config.min, Math.min(config.max, gain));
}

/**
 * Converts gain value to decibels for UI display
 */
export function gainToDb(gain: number): number {
  return 20 * Math.log10(Math.max(0.001, gain));
}

/**
 * Converts decibels to gain value
 */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Gets gain preset by name
 */
export function getGainPreset(preset: keyof typeof GAIN_PRESETS): number {
  return GAIN_PRESETS[preset];
}

/**
 * Gets descriptive text for gain level
 */
export function getGainDescription(gain: number): string {
  if (gain < 1.0) return '⬇️ Reduced input level';
  if (gain === 1.0) return '✅ Normal input level';
  if (gain <= 1.5) return '⬆️ Increased input level';
  if (gain <= 2.0) return '📈 High input level';
  return '⚠️ Maximum boost - watch for clipping';
}

/**
 * Advanced Gain Controller Class
 * Encapsulates gain control logic with validation and events
 */
export class GainController {
  private _currentGain: number;
  private readonly config: GainConfig;
  private listeners: Set<(gain: number) => void> = new Set();

  constructor(initialGain: number = DEFAULT_GAIN_CONFIG.default, config: GainConfig = DEFAULT_GAIN_CONFIG) {
    this.config = config;
    this._currentGain = validateGain(initialGain, config);
  }

  get currentGain(): number {
    return this._currentGain;
  }

  setGain(gain: number): boolean {
    const validatedGain = validateGain(gain, this.config);
    if (validatedGain !== this._currentGain) {
      this._currentGain = validatedGain;
      this.notifyListeners();
      return true;
    }
    return false;
  }

  incrementGain(): number {
    const newGain = this._currentGain + this.config.step;
    this.setGain(newGain);
    return this._currentGain;
  }

  decrementGain(): number {
    const newGain = this._currentGain - this.config.step;
    this.setGain(newGain);
    return this._currentGain;
  }

  applyPreset(preset: keyof typeof GAIN_PRESETS): void {
    this.setGain(getGainPreset(preset));
  }

  getDescription(): string {
    return getGainDescription(this._currentGain);
  }

  getDbValue(): number {
    return gainToDb(this._currentGain);
  }

  onGainChange(callback: (gain: number) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this._currentGain));
  }

  destroy(): void {
    this.listeners.clear();
  }
}