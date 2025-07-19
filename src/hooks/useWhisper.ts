'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { WhisperConfig, TranscriptionResult, UseWhisperReturn } from '../lib/types'

export function useWhisper(config: WhisperConfig = {}): UseWhisperReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [modelReady, setModelReady] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const workerRef = useRef<Worker | null>(null)

  // Initialize Web Worker
  useEffect(() => {
    if (!workerRef.current && typeof window !== 'undefined') {
      // Create worker - Next.js will handle this differently
      const workerUrl = '/whisper.worker.js'
      workerRef.current = new Worker(workerUrl, { type: 'module' })

      // Set up message handler
      workerRef.current.onmessage = (event) => {
        const { type, data } = event.data

        switch (type) {
          case 'initiate':
            console.log('Loading Whisper model...')
            break
          
          case 'progress':
            setLoadingProgress(data.progress || 0)
            if (data.cachedModel) {
              setIsLoadingFromCache(true)
            }
            break
          
          case 'ready':
            setModelReady(true)
            console.log('Whisper model ready!')
            break
          
          case 'complete':
            setTranscript(data.text)
            setIsTranscribing(false)
            break
          
          case 'error':
            setError(new Error(data))
            setIsTranscribing(false)
            break
        }
      }

      // Load the model
      workerRef.current.postMessage({ type: 'load' })
    }

    // Cleanup
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [])

  // Convert audio blob to base64 for worker
  const audioToBase64 = async (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        resolve(base64.split(',')[1])
      }
      reader.readAsDataURL(blob)
    })
  }

  const transcribeAudio = useCallback(async (audioBlob: Blob): Promise<TranscriptionResult | null> => {
    if (!workerRef.current || !modelReady) {
      setError(new Error('Model not ready'))
      return null
    }

    setIsTranscribing(true)
    setError(null)

    try {
      // Convert blob to base64 for transfer to worker
      const audioBase64 = await audioToBase64(audioBlob)
      
      // Send to worker for transcription
      workerRef.current.postMessage({
        type: 'transcribe',
        data: {
          audio: audioBase64,
          options: {
            language: config.language,
            timestamps: config.responseFormat === 'verbose_json'
          }
        }
      })

      // Return will be handled by the message handler
      return null
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      setIsTranscribing(false)
      return null
    }
  }, [config, modelReady])

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      audioChunksRef.current = []
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          sampleSize: 16,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      })
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await transcribeAudio(audioBlob)
        
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start recording')
      setError(error)
    }
  }, [transcribeAudio])

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  const clearTranscript = useCallback(() => {
    setTranscript(null)
    setError(null)
  }, [])

  return {
    isRecording,
    isTranscribing,
    transcript,
    error,
    startRecording,
    stopRecording,
    transcribeAudio,
    clearTranscript,
    modelReady,
    loadingProgress,
    isLoadingFromCache
  }
}