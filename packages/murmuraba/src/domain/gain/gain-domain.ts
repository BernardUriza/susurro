/**
 * Domain Layer - Gain Control Business Logic
 * Pure business logic with no dependencies on frameworks or infrastructure
 */

export interface GainPolicy {
  readonly minGain: number;
  readonly maxGain: number;
  readonly defaultGain: number;
  readonly step: number;
}

export const MEDICAL_GAIN_POLICY: GainPolicy = {
  minGain: 0.5,
  maxGain: 3.0,
  defaultGain: 1.0,
  step: 0.1
} as const;

export const BROADCAST_GAIN_POLICY: GainPolicy = {
  minGain: 0.1,
  maxGain: 5.0,
  defaultGain: 1.0,
  step: 0.05
} as const;

export class GainValue {
  private constructor(private readonly value: number) {}

  static create(value: number, policy: GainPolicy = MEDICAL_GAIN_POLICY): GainValue {
    const clampedValue = Math.max(policy.minGain, Math.min(policy.maxGain, value));
    return new GainValue(clampedValue);
  }

  getValue(): number {
    return this.value;
  }

  getDbValue(): number {
    return 20 * Math.log10(Math.max(0.001, this.value));
  }

  increment(policy: GainPolicy): GainValue {
    return GainValue.create(this.value + policy.step, policy);
  }

  decrement(policy: GainPolicy): GainValue {
    return GainValue.create(this.value - policy.step, policy);
  }

  equals(other: GainValue): boolean {
    return Math.abs(this.value - other.value) < 0.001;
  }

  isNormalLevel(): boolean {
    return Math.abs(this.value - 1.0) < 0.001;
  }

  isBoostLevel(): boolean {
    return this.value > 1.5;
  }

  toString(): string {
    return `${this.value.toFixed(1)}x`;
  }
}

export enum GainPreset {
  LOW = 'LOW',
  NORMAL = 'NORMAL', 
  HIGH = 'HIGH',
  BOOST = 'BOOST'
}

export class GainPresetService {
  private static readonly presetValues = new Map<GainPreset, number>([
    [GainPreset.LOW, 0.7],
    [GainPreset.NORMAL, 1.0],
    [GainPreset.HIGH, 1.5],
    [GainPreset.BOOST, 2.0]
  ]);

  static getPresetValue(preset: GainPreset): GainValue {
    const value = this.presetValues.get(preset) ?? 1.0;
    return GainValue.create(value);
  }

  static getAllPresets(): Array<{ preset: GainPreset; value: GainValue; description: string }> {
    return [
      { preset: GainPreset.LOW, value: this.getPresetValue(GainPreset.LOW), description: '🔇 Quiet environments' },
      { preset: GainPreset.NORMAL, value: this.getPresetValue(GainPreset.NORMAL), description: '🔊 Standard level' },
      { preset: GainPreset.HIGH, value: this.getPresetValue(GainPreset.HIGH), description: '📢 Noisy environments' },
      { preset: GainPreset.BOOST, value: this.getPresetValue(GainPreset.BOOST), description: '🚀 Maximum amplification' }
    ];
  }
}

export interface GainRepository {
  getCurrentGain(): Promise<GainValue>;
  setGain(gain: GainValue): Promise<void>;
  savePreset(name: string, gain: GainValue): Promise<void>;
  loadPreset(name: string): Promise<GainValue | null>;
}

export interface GainEventPublisher {
  publishGainChanged(oldGain: GainValue, newGain: GainValue): void;
  publishPresetApplied(preset: GainPreset, gain: GainValue): void;
}

export class GainController {
  constructor(
    private readonly repository: GainRepository,
    private readonly eventPublisher: GainEventPublisher,
    private readonly policy: GainPolicy = MEDICAL_GAIN_POLICY
  ) {}

  async getCurrentGain(): Promise<GainValue> {
    return await this.repository.getCurrentGain();
  }

  async setGain(targetGain: number): Promise<GainValue> {
    const oldGain = await this.repository.getCurrentGain();
    const newGain = GainValue.create(targetGain, this.policy);
    
    if (!oldGain.equals(newGain)) {
      await this.repository.setGain(newGain);
      this.eventPublisher.publishGainChanged(oldGain, newGain);
    }
    
    return newGain;
  }

  async applyPreset(preset: GainPreset): Promise<GainValue> {
    const oldGain = await this.repository.getCurrentGain();
    const newGain = GainPresetService.getPresetValue(preset);
    
    await this.repository.setGain(newGain);
    this.eventPublisher.publishGainChanged(oldGain, newGain);
    this.eventPublisher.publishPresetApplied(preset, newGain);
    
    return newGain;
  }

  async incrementGain(): Promise<GainValue> {
    const currentGain = await this.repository.getCurrentGain();
    const newGain = currentGain.increment(this.policy);
    
    await this.repository.setGain(newGain);
    this.eventPublisher.publishGainChanged(currentGain, newGain);
    
    return newGain;
  }

  async decrementGain(): Promise<GainValue> {
    const currentGain = await this.repository.getCurrentGain();
    const newGain = currentGain.decrement(this.policy);
    
    await this.repository.setGain(newGain);
    this.eventPublisher.publishGainChanged(currentGain, newGain);
    
    return newGain;
  }

  async saveCurrentAsPreset(name: string): Promise<void> {
    const currentGain = await this.repository.getCurrentGain();
    await this.repository.savePreset(name, currentGain);
  }

  async loadNamedPreset(name: string): Promise<GainValue | null> {
    const presetGain = await this.repository.loadPreset(name);
    if (presetGain) {
      const oldGain = await this.repository.getCurrentGain();
      await this.repository.setGain(presetGain);
      this.eventPublisher.publishGainChanged(oldGain, presetGain);
      return presetGain;
    }
    return null;
  }
}