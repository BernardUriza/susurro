export { useSusurro } from './hooks/useSusurro';
// useAudioProcessor is now integrated into useSusurro
export { useTranscription } from './hooks/useTranscription';
// useWhisperDirect is not exported - use whisper through useSusurro
// REMOVED: Singleton pattern eliminated in Murmuraba v3
// export { murmurabaManager } from './lib/murmuraba-singleton';
export * from './lib/types';
export * from './lib/ui-interfaces';
export * from './lib/whisper-types';
export * from './lib/murmuraba-types';

export type { UseSusurroOptions, UseSusurroReturn } from './hooks/useSusurro';