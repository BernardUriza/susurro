import { useState, useCallback, useRef } from 'react'
import { UseSusurroReturn, UseSusurroConfig, CleanAudioResult } from './types'

// Lazy imports
let murmuraba: any = null
let transformers: any = null

export function useSusurro(config: UseSusurroConfig = {}): UseSusurroReturn {
  const [cleaning, setCleaning] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const whisperPipeline = useRef<any>(null)
  const murmurabaMgr = useRef<any>(null)

  // Initialize lazy dependencies
  const initDeps = async () => {
    if (!murmuraba) {
      murmuraba = (await import('murmuraba')).default
    }
    if (!transformers) {
      transformers = await import('@xenova/transformers')
    }
  }

  const cleanAudio = useCallback(async (file: File): Promise<CleanAudioResult> => {
    setCleaning(true)
    setError(null)
    
    try {
      await initDeps()
      
      // Initialize murmuraba if needed
      if (!murmurabaMgr.current) {
        murmurabaMgr.current = murmuraba
        await murmurabaMgr.current.initialize()
      }
      
      // Process audio
      const result = await murmurabaMgr.current.processFileWithMetrics(file, () => {})
      
      // Create blob from processed buffer
      const blob = new Blob([result.processedBuffer], { type: 'audio/wav' })
      
      return {
        blob,
        vadScore: result.averageVad || 0
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Audio cleaning failed')
      setError(error)
      throw error
    } finally {
      setCleaning(false)
    }
  }, [])

  const transcribe = useCallback(async (audioBlob: Blob): Promise<string> => {
    setTranscribing(true)
    setError(null)
    
    try {
      await initDeps()
      
      // Initialize Whisper pipeline if needed
      if (!whisperPipeline.current) {
        const { pipeline } = transformers
        whisperPipeline.current = await pipeline(
          'automatic-speech-recognition',
          config.whisperModel || 'Xenova/whisper-tiny',
          { quantized: true }
        )
      }
      
      // Convert blob to base64
      const audioUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(audioBlob)
      })
      
      // Transcribe
      const output = await whisperPipeline.current(audioUrl, {
        language: config.language || 'english',
        task: 'transcribe',
        return_timestamps: false
      })
      
      return output.text
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Transcription failed')
      setError(error)
      throw error
    } finally {
      setTranscribing(false)
    }
  }, [config.whisperModel, config.language])

  return {
    cleanAudio,
    transcribe,
    cleaning,
    transcribing,
    error
  }
}