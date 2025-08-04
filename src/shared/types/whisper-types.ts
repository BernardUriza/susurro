// Whisper-themed branded types for enhanced type safety
export type WhisperID = string & { readonly __brand: 'WhisperID' };
export type AudioTimestamp = number & { readonly __brand: 'AudioTimestamp' };
export type VoiceResonanceScore = number & { readonly __brand: 'VoiceResonanceScore' };
export type SpectralFingerprint = Float32Array & { readonly __brand: 'SpectralFingerprint' };

// Enhanced audio fragment interface with whisper theming
export interface WhisperFragment {
  whisperID: WhisperID;
  audioEssence: Blob;
  temporalSpan: number;
  echoStart: AudioTimestamp;
  echoEnd: AudioTimestamp;
  voiceResonance?: VoiceResonanceScore;
  silenceRatio?: number;
  spectralSignature?: SpectralFingerprint;
  frequencyProfile?: {
    lowFreqEnergy: number;
    midFreqEnergy: number;
    highFreqEnergy: number;
    spectralCentroid: number;
    spectralRolloff: number;
  };
  audioCharacteristics?: {
    isSpeech: boolean;
    isMusic: boolean;
    isNoise: boolean;
    emotionalTone?: 'neutral' | 'positive' | 'negative' | 'excited' | 'calm';
  };
}

// Whisper transcription result with enhanced metadata
export interface WhisperRevelation {
  decodedMessage: string;
  audioFragments?: WhisperSegment[];
  fragmentIndex: number;
  revelationTime: AudioTimestamp;
  confidenceScore?: number;
  languageDetected?: string;
  processingDuration?: number;
  semanticAnalysis?: {
    sentiment: number; // -1 to 1
    keywords: string[];
    topics: string[];
    entityMentions: string[];
  };
  acousticFeatures?: {
    speakerGender?: 'male' | 'female' | 'unknown';
    speakerAge?: 'child' | 'adult' | 'elderly' | 'unknown';
    speechRate: number; // words per minute
    pauseDuration: number;
    voiceClarity: number; // 0 to 1
  };
}

// Whisper segment with enhanced timing and confidence
export interface WhisperSegment {
  segmentID: WhisperID;
  whisperText: string;
  echoStart: AudioTimestamp;
  echoEnd: AudioTimestamp;
  confidenceLevel: number;
  wordAlignment?: WhisperWord[];
  phoneticTranscription?: string;
  emotionalMarkers?: {
    intensity: number;
    valence: number; // positive/negative
    arousal: number; // calm/excited
  };
}

// Individual word with precise timing and confidence
export interface WhisperWord {
  wordID: WhisperID;
  whisperWord: string;
  wordStart: AudioTimestamp;
  wordEnd: AudioTimestamp;
  wordConfidence: number;
  pronunciation?: {
    ipa: string; // International Phonetic Alphabet
    stress: number; // 0-2 (unstressed, primary, secondary)
    syllableCount: number;
  };
}

// Enhanced processing state with whisper theming
export type WhisperProcessingStage =
  | 'silent'
  | 'initializing'
  | 'capturing'
  | 'analyzing'
  | 'decoding'
  | 'enhancing'
  | 'transcribing'
  | 'complete'
  | 'error';

export interface ProcessingState {
  isProcessing: boolean;
  currentFragment: number;
  totalFragments: number;
  stage: WhisperProcessingStage;
  progress?: number; // 0-1
  estimatedTimeRemaining?: number; // milliseconds
  currentOperation?: string;
  performanceMetrics?: {
    processingSpeed: number; // fragments per second
    memoryUsage: number; // MB
    cpuUsage: number; // 0-1
    modelLoadTime: number; // milliseconds
  };
}

// Audio alchemy result (enhanced Murmuraba result)
export interface AudioAlchemyResult {
  processedEssence?: Blob | ArrayBuffer | AudioBuffer;
  whisperFragments?: WhisperFragment[];
  averageResonance?: number;
  processingMetrics?: AlchemyMetrics[];
  qualityAssessment?: {
    signalToNoiseRatio: number;
    dynamicRange: number;
    spectralQuality: number;
    overallScore: number; // 0-1
  };
  enhancementApplied?: {
    noiseReduction: boolean;
    agc: boolean; // Automatic Gain Control
    echoCancellation: boolean;
    spectralEnhancement: boolean;
  };
}

// Enhanced processing metrics
export interface AlchemyMetrics {
  frameIndex: number;
  timestamp: AudioTimestamp;
  voiceResonance: VoiceResonanceScore;
  spectralEnergy: number;
  frequencyDistribution: number[];
  phaseCoherence: number;
  harmonicContent: number;
  noiseFloor: number;
  peakAmplitude: number;
  zeroCrossingRate: number;
  spectralFlux: number;
  spectralRoughness: number;
}

// Whisper model configuration with advanced options
export interface WhisperAlchemyConfig {
  modelVariant?: 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'large-v2' | 'large-v3';
  language?: string;
  temperature?: number; // 0-1, creativity in transcription
  beamSize?: number; // 1-10, decoding beam width
  patience?: number; // 0-2, beam search patience
  lengthPenalty?: number; // penalty for sequence length
  suppressBlank?: boolean;
  suppressTokens?: number[];
  initialPrompt?: string;
  prefixPrompt?: string;
  hotwords?: string[]; // words to boost recognition
  customVocabulary?: string[];
  adaptiveBoost?: boolean; // auto-adjust recognition for speaker
  realTimeMode?: boolean;
  qualityMode?: 'speed' | 'balanced' | 'accuracy';
  postProcessing?: {
    punctuationCorrection: boolean;
    capitalizationFix: boolean;
    profanityFilter: boolean;
    speechDisfluencyRemoval: boolean;
  };
}

// Whisper orchestrator error types
export type WhisperError =
  | 'MODEL_LOAD_FAILED'
  | 'AUDIO_CAPTURE_FAILED'
  | 'PROCESSING_TIMEOUT'
  | 'INSUFFICIENT_MEMORY'
  | 'INVALID_AUDIO_FORMAT'
  | 'NETWORK_ERROR'
  | 'PERMISSION_DENIED'
  | 'UNKNOWN_ERROR';

export interface WhisperErrorDetails {
  errorType: WhisperError;
  message: string;
  timestamp: AudioTimestamp;
  context?: Record<string, unknown>;
  recoveryActions?: string[];
  technicalDetails?: {
    stackTrace?: string;
    browserInfo?: string;
    deviceCapabilities?: Record<string, unknown>;
  };
}

// Advanced whisper analytics
export interface WhisperAnalytics {
  sessionID: WhisperID;
  startTime: AudioTimestamp;
  endTime?: AudioTimestamp;
  totalFragments: number;
  totalProcessingTime: number;
  averageConfidence: number;
  languageDistribution: Record<string, number>;
  qualityMetrics: {
    averageSignalQuality: number;
    processingEfficiency: number;
    transcriptionAccuracy: number;
    userSatisfactionScore?: number;
  };
  performanceInsights: {
    bottlenecks: string[];
    optimizationSuggestions: string[];
    resourceUtilization: Record<string, number>;
  };
}

// Export utility type guards and helpers
export const isWhisperFragment = (obj: unknown): obj is WhisperFragment => {
  return typeof obj === 'object' && obj !== null && 'whisperID' in obj;
};

export const isWhisperRevelation = (obj: unknown): obj is WhisperRevelation => {
  return typeof obj === 'object' && obj !== null && 'decodedMessage' in obj;
};

export const createWhisperID = (): WhisperID => {
  return `whisper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` as WhisperID;
};

export const createAudioTimestamp = (time: number): AudioTimestamp => {
  return time as AudioTimestamp;
};

export const createVoiceResonanceScore = (score: number): VoiceResonanceScore => {
  return Math.max(0, Math.min(1, score)) as VoiceResonanceScore;
};
