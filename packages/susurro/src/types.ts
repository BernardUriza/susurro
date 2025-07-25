export interface CleanAudioResult {
  blob: Blob
  vadScore: number
}

export interface UseSusurroReturn {
  // Paso 1: Limpiar audio
  cleanAudio: (file: File) => Promise<CleanAudioResult>
  
  // Paso 2: Transcribir
  transcribe: (audioBlob: Blob) => Promise<string>
  
  // Estados
  cleaning: boolean
  transcribing: boolean
  error: Error | null
}

export interface UseSusurroConfig {
  whisperModel?: string
  language?: string
}