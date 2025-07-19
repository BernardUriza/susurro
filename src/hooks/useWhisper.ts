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
    console.log('[useWhisper] useEffect triggered, workerRef.current:', workerRef.current)
    
    if (!workerRef.current && typeof window !== 'undefined') {
      console.log('[useWhisper] Creating new worker...')
      
      try {
        // Create worker - Next.js will handle this differently
        const workerUrl = '/whisper.worker.js'
        workerRef.current = new Worker(workerUrl, { type: 'module' })
        console.log('[useWhisper] Worker created successfully')

        // Set up message handler
        workerRef.current.onmessage = (event) => {
          const { type, data } = event.data
          console.log('[useWhisper] Message from worker:', type, data)

          switch (type) {
            case 'initiate':
              console.log('[Hook] Loading Whisper model...')
              setLoadingProgress(1) // Set minimum progress to show it's starting
              break
            
            case 'progress':
              const progress = data.progress || 0
              console.log('[Hook] Progress update:', progress, data.status)
              setLoadingProgress(Math.max(1, progress)) // Never show 0% after initiate
              if (data.cachedModel) {
                setIsLoadingFromCache(true)
              }
              break
            
            case 'ready':
              setModelReady(true)
              setLoadingProgress(100)
              console.log('[Hook] Whisper model ready!')
              break
            
            case 'complete':
              setTranscript(data.text)
              setIsTranscribing(false)
              break
            
            case 'error':
              console.error('[Hook] Error from worker:', data)
              setError(new Error(data))
              setIsTranscribing(false)
              setLoadingProgress(0)
              break
          }
        }

        // Add error handler
        workerRef.current.onerror = (error) => {
          console.error('[Hook] Worker error:', error)
          setError(new Error('Worker failed to load'))
          setLoadingProgress(0)
        }

        // Load the model
        console.log('[Hook] Sending load message to worker...')
        workerRef.current.postMessage({ type: 'load' })
        
      } catch (error) {
        console.error('[useWhisper] Failed to create worker:', error)
        setError(new Error('Failed to initialize worker'))
      }
    }
    
    // Cleanup function
    return () => {
      console.log('[useWhisper] Cleanup called')
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, []) // Remove modelReady dependency to prevent infinite loop

  // Convert audio blob to base64 data URL for worker
  const audioToBase64 = async (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        resolve(base64) // Return full data URL
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
      // Convert blob to data URL for worker
      const audioDataUrl = await audioToBase64(audioBlob)
      
      // Send to worker using new pattern
      workerRef.current.postMessage({
        type: 'transcribe',
        data: {
          audio: audioDataUrl,
          options: config
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