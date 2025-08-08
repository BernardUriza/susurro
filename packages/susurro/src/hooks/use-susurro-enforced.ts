/**
 * USE_SUSURRO_ENFORCED - The Enforcer Hook
 * 
 * This hook MUST be used by all components instead of direct useSusurro imports.
 * It ensures single instance management through WhisperContext.
 * 
 * Direct useSusurro imports are FORBIDDEN and will cause engine conflicts.
 * 
 * @author The Tech Lead Inquisitor
 */

// This enforcer will be exported from the main index to replace direct useSusurro access

/**
 * ARCHITECTURAL ENFORCEMENT NOTICE:
 * 
 * Direct imports of useSusurro are now FORBIDDEN.
 * All components MUST use the WhisperProvider context pattern.
 * 
 * This prevents multiple engine instances and eliminates the 
 * "Audio engine is already initialized" errors.
 */

export function createUseSusurroEnforcer() {
  return function useSusurro() {
    throw new Error(
      '🚨 ARCHITECTURAL VIOLATION 🚨\n\n' +
      'Direct useSusurro imports are FORBIDDEN.\n' +
      'You MUST use useWhisper() from WhisperProvider instead.\n\n' +
      'Why? Because you created 9 components with 9 different engine instances.\n' +
      'This caused the "Audio engine is already initialized" nightmare.\n\n' +
      'Fix: Replace useSusurro with useWhisper and wrap your app with <WhisperProvider>.\n' +
      'The Tech Lead Inquisitor has spoken.'
    );
  };
}

// Create the enforcer function
export const useSusurro = createUseSusurroEnforcer();

// Re-export types that components need
export type {
  UseSusurroReturn,
  AudioChunk,
  ProcessingStatus,
  TranscriptionResult,
  SusurroChunk,
  CompleteAudioResult,
  StreamingSusurroChunk,
  RecordingConfig,
  AudioMetadata,
} from '../lib/types';