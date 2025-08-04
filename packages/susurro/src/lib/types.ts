export interface WhisperConfig {
  apiKey?: string
  model?: 'whisper-1'
  language?: string
  temperature?: number
  prompt?: string
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt'
}

export interface TranscriptionResult {
  text: string
  language?: string
  duration?: number
  segments?: TranscriptionSegment[]
  chunkIndex: number
  timestamp: number
}

export interface AudioChunk {
  id: string
  blob: Blob
  duration: number
  startTime: number
  endTime: number
  vadScore?: number
}

export interface ProcessingStatus {
  isProcessing: boolean
  currentChunk: number
  totalChunks: number
  stage: 'idle' | 'recording' | 'processing' | 'transcribing' | 'complete' | 'error'
}

export interface TranscriptionSegment {
  id: number
  seek: number
  start: number
  end: number
  text: string
  tokens: number[]
  temperature: number
  avg_logprob: number
  compression_ratio: number
  no_speech_prob: number
}

export interface UseWhisperReturn {
  isTranscribing: boolean
  transcript: string | null
  error: Error | null
  transcribe: (audioBlob: Blob) => Promise<TranscriptionResult | null>
  clearTranscript: () => void
  modelReady: boolean
  loadingProgress: number
  isLoadingFromCache?: boolean
}

// 🎯 Next Evolution: Conversational Chunks — El Murmullo del Futuro
export interface SusurroChunk {
  id: string;                // Unique identifier
  audioUrl: string;          // Clean neural-processed audio (Blob URL)
  transcript: string;        // AI-transcribed text 
  startTime: number;         // Start time in ms
  endTime: number;           // End time in ms
  vadScore: number;          // Voice activity confidence (0-1)
  isComplete: boolean;       // Both audio + transcript ready
  processingLatency?: number; // Time to process in ms
  metadata?: Record<string, any>; // Extensible metadata from middleware
}

// Conversational chunk callback type
export type OnChunkCallback = (chunk: SusurroChunk) => void;

// Enhanced options for conversational mode
export interface ConversationalOptions {
  onChunk?: OnChunkCallback;        // Real-time chunk callback
  enableInstantTranscription?: boolean; // Transcribe as soon as chunk is ready
  chunkTimeout?: number;            // Max time to wait for transcript (ms)
  enableChunkEnrichment?: boolean;  // Allow processing hooks before emission
}

// Extended UseSusurroOptions for conversational features
export interface UseSusurroOptions {
  chunkDurationMs?: number;
  enableVAD?: boolean;
  whisperConfig?: WhisperConfig;
  // 🆕 Conversational features
  conversational?: ConversationalOptions;
}