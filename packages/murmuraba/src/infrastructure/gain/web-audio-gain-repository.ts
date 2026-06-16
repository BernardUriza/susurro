/**
 * Infrastructure Layer - Web Audio API Implementation
 * Handles the technical details of applying gain to audio nodes
 */

import { GainValue, GainRepository, GainPolicy, MEDICAL_GAIN_POLICY } from '../../domain/gain/gain-domain';

export interface WebAudioGainOptions {
  smoothingTimeConstant?: number;
  enableSmoothing?: boolean;
  policy?: GainPolicy;
}

export class WebAudioGainRepository implements GainRepository {
  private gainNode?: GainNode;
  private currentGain: GainValue;
  private readonly options: Required<WebAudioGainOptions>;
  private presets: Map<string, GainValue> = new Map();

  constructor(
    private readonly audioContext: AudioContext,
    options: WebAudioGainOptions = {}
  ) {
    this.options = {
      smoothingTimeConstant: options.smoothingTimeConstant ?? 0.01,
      enableSmoothing: options.enableSmoothing ?? true,
      policy: options.policy ?? MEDICAL_GAIN_POLICY
    };
    
    this.currentGain = GainValue.create(this.options.policy.defaultGain, this.options.policy);
    this.createGainNode();
  }

  async getCurrentGain(): Promise<GainValue> {
    return this.currentGain;
  }

  async setGain(gain: GainValue): Promise<void> {
    this.currentGain = gain;
    
    if (!this.gainNode) {
      this.createGainNode();
    }

    if (this.options.enableSmoothing) {
      this.gainNode!.gain.setTargetAtTime(
        gain.getValue(),
        this.audioContext.currentTime,
        this.options.smoothingTimeConstant
      );
    } else {
      this.gainNode!.gain.value = gain.getValue();
    }
  }

  async savePreset(name: string, gain: GainValue): Promise<void> {
    this.presets.set(name, gain);
    
    // Persist to localStorage for persistence across sessions
    try {
      const serializedPresets = JSON.stringify(
        Array.from(this.presets.entries()).map(([key, value]) => [key, value.getValue()])
      );
      localStorage.setItem('murmuraba-gain-presets', serializedPresets);
    } catch (error) {
      console.warn('Failed to persist gain preset to localStorage:', error);
    }
  }

  async loadPreset(name: string): Promise<GainValue | null> {
    // Try memory cache first
    const cachedPreset = this.presets.get(name);
    if (cachedPreset) {
      return cachedPreset;
    }

    // Try localStorage
    try {
      const serializedPresets = localStorage.getItem('murmuraba-gain-presets');
      if (serializedPresets) {
        const presetEntries: [string, number][] = JSON.parse(serializedPresets);
        const presetValue = presetEntries.find(([key]) => key === name)?.[1];
        if (presetValue !== undefined) {
          const gainValue = GainValue.create(presetValue, this.options.policy);
          this.presets.set(name, gainValue);
          return gainValue;
        }
      }
    } catch (error) {
      console.warn('Failed to load gain preset from localStorage:', error);
    }

    return null;
  }

  /**
   * Get the actual Web Audio API gain node for connection to audio graph
   */
  getGainNode(): GainNode {
    if (!this.gainNode) {
      this.createGainNode();
    }
    return this.gainNode!;
  }

  /**
   * Connect this gain repository to an audio processing chain
   */
  connectTo(sourceNode: AudioNode, destinationNode: AudioNode): void {
    const gainNode = this.getGainNode();
    sourceNode.connect(gainNode);
    gainNode.connect(destinationNode);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = undefined;
    }
    this.presets.clear();
  }

  private createGainNode(): void {
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.currentGain.getValue();
  }
}