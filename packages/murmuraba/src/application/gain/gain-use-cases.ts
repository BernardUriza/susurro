/**
 * Application Layer - Gain Control Use Cases
 * Orchestrates domain logic and coordinates with external systems
 */

import { 
  GainController, 
  GainValue, 
  GainPreset, 
  GainRepository, 
  GainEventPublisher,
  GainPolicy,
  MEDICAL_GAIN_POLICY 
} from '../../domain/gain/gain-domain';

export interface GainUseCaseEvents {
  onGainChanged?: (gain: GainValue) => void;
  onPresetApplied?: (preset: GainPreset, gain: GainValue) => void;
  onError?: (error: Error) => void;
}

export class GainUseCases {
  private readonly controller: GainController;

  constructor(
    repository: GainRepository,
    eventPublisher: GainEventPublisher,
    private readonly events: GainUseCaseEvents = {},
    policy: GainPolicy = MEDICAL_GAIN_POLICY
  ) {
    this.controller = new GainController(repository, eventPublisher, policy);
  }

  async setInputGain(gain: number): Promise<GainValue> {
    try {
      const result = await this.controller.setGain(gain);
      this.events.onGainChanged?.(result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to set gain');
      this.events.onError?.(err);
      throw err;
    }
  }

  async getCurrentInputGain(): Promise<GainValue> {
    try {
      return await this.controller.getCurrentGain();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to get current gain'); 
      this.events.onError?.(err);
      throw err;
    }
  }

  async applyGainPreset(preset: GainPreset): Promise<GainValue> {
    try {
      const result = await this.controller.applyPreset(preset);
      this.events.onPresetApplied?.(preset, result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to apply preset');
      this.events.onError?.(err);
      throw err;
    }
  }

  async incrementGain(): Promise<GainValue> {
    try {
      const result = await this.controller.incrementGain();
      this.events.onGainChanged?.(result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to increment gain');
      this.events.onError?.(err);
      throw err;
    }
  }

  async decrementGain(): Promise<GainValue> {
    try {
      const result = await this.controller.decrementGain();
      this.events.onGainChanged?.(result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to decrement gain');
      this.events.onError?.(err);
      throw err;
    }
  }

  async saveCurrentGainAsPreset(name: string): Promise<void> {
    try {
      await this.controller.saveCurrentAsPreset(name);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to save preset');
      this.events.onError?.(err);
      throw err;
    }
  }

  async loadNamedPreset(name: string): Promise<GainValue | null> {
    try {
      const result = await this.controller.loadNamedPreset(name);
      if (result) {
        this.events.onGainChanged?.(result);
      }
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load preset');
      this.events.onError?.(err);
      throw err;
    }
  }

  /**
   * Get gain information for UI display
   */
  async getGainDisplayInfo(): Promise<{
    current: GainValue;
    dbValue: number;
    description: string;
    isNormal: boolean;
    isBoost: boolean;
  }> {
    const current = await this.getCurrentInputGain();
    return {
      current,
      dbValue: current.getDbValue(),
      description: this.getGainDescription(current),
      isNormal: current.isNormalLevel(),
      isBoost: current.isBoostLevel()
    };
  }

  private getGainDescription(gain: GainValue): string {
    const value = gain.getValue();
    if (value < 1.0) return '⬇️ Reduced input level';
    if (value === 1.0) return '✅ Normal input level';
    if (value <= 1.5) return '⬆️ Increased input level';
    if (value <= 2.0) return '📈 High input level';
    return '⚠️ Maximum boost - watch for clipping';
  }
}

/**
 * Factory for creating gain use cases with proper wiring
 */
export class GainUseCaseFactory {
  static create(
    repository: GainRepository,
    events: GainUseCaseEvents = {},
    policy?: GainPolicy
  ): GainUseCases {
    // Create event publisher that forwards to use case events
    const eventPublisher: GainEventPublisher = {
      publishGainChanged: (oldGain, newGain) => {
        events.onGainChanged?.(newGain);
      },
      publishPresetApplied: (preset, gain) => {
        events.onPresetApplied?.(preset, gain);
      }
    };

    return new GainUseCases(repository, eventPublisher, events, policy);
  }
}