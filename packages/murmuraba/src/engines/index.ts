import { AudioEngine, AudioEngineConfig } from './types';
import { RNNoiseEngine, RNNoiseConfig } from './rnnoise-engine';

export function createAudioEngine(config: AudioEngineConfig & { rnnoiseConfig?: RNNoiseConfig }): AudioEngine {
  switch (config.engineType) {
    case 'rnnoise':
      return new RNNoiseEngine(config.rnnoiseConfig);
    case 'speex':
      throw new Error('Speex engine not implemented yet');
    case 'custom':
      throw new Error('Custom engine not implemented yet');
    default:
      throw new Error(`Unknown engine type: ${config.engineType}`);
  }
}

export type { AudioEngine, AudioEngineConfig } from './types';