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
  transcribeAudio: (audioBlob: Blob) => Promise<TranscriptionResult | null>
  clearTranscript: () => void
  modelReady: boolean
  loadingProgress: number
  isLoadingFromCache?: boolean
}