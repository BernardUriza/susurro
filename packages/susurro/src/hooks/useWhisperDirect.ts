'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { WhisperConfig, TranscriptionResult, UseWhisperReturn } from '../lib/types'
import type { Pipeline, TransformersModule, TransformersEnvironment, WhisperProgress, WhisperOutput } from '../lib/whisper-types'
import { cacheManager } from '../lib/cache-manager'
import { AlertService, ToastService, defaultAlertService, defaultToastService } from '../lib/ui-interfaces'

// Singleton pattern for Whisper pipeline
class WhisperPipelineSingleton {
  static task = 'automatic-speech-recognition' as const
  static model = 'Xenova/whisper-medium'
  static instance: Pipeline | null = null
  static pipeline: TransformersModule['pipeline'] | null = null
  static env: TransformersEnvironment | null = null
  static isLoading: boolean = false
  static loadingPromise: Promise<Pipeline> | null = null

  static async getInstance(progress_callback: ((progress: WhisperProgress) => void) | null = null): Promise<Pipeline> {
    // If already loaded, return immediately
    if (this.instance) {
      return this.instance
    }

    // If currently loading, wait for the existing loading promise
    if (this.isLoading && this.loadingPromise) {
      return this.loadingPromise
    }

    // Start loading
    this.isLoading = true
    this.loadingPromise = this.loadInstance(progress_callback)
    
    try {
      this.instance = await this.loadingPromise
      return this.instance
    } finally {
      this.isLoading = false
    }
  }

  private static async loadInstance(progress_callback: ((progress: WhisperProgress) => void) | null = null): Promise<Pipeline> {
    if (!this.pipeline) {
      try {
        // Dynamic import with error handling
        const transformers = await import('@xenova/transformers').catch((err: Error) => {
          throw new Error(`Failed to import transformers: ${err.message}`)
        })
        
        this.pipeline = transformers.pipeline
        this.env = transformers.env
        
        // Configure environment with correct WASM paths for Vite
        this.env.allowLocalModels = true
        this.env.useBrowserCache = true
        this.env.useCustomCache = true
        this.env.remoteURL = 'https://huggingface.co/'
        
        // Try multiple WASM path configurations
        const possiblePaths = [
          '/node_modules/@xenova/transformers/dist/',
          '/@fs/node_modules/@xenova/transformers/dist/',
          'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/',
          '/'
        ]
        
        // Use the first path that works or fallback to CDN
        this.env.backends = {
          onnx: {
            wasm: {
              wasmPaths: possiblePaths[2] // Use CDN as most reliable option
            }
          }
        }
        
      } catch (error) {
        throw error
      }
    }

      
      // Check cache first
      const cacheStatus = await cacheManager.getCacheStatus()
      if (cacheStatus.hasCache) {
      } else {
      }
      
      // Request persistent storage for better caching
      await cacheManager.requestPersistentStorage()
      
      // Add timeout for model loading (2 minutes)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Model loading timeout after 2 minutes')), 120000)
      })
      
      const loadPromise = this.pipeline(this.task, this.model, { 
        progress_callback: (progress: WhisperProgress) => {
          if (progress_callback) progress_callback(progress)
        },
        quantized: true 
      })
      
      this.instance = await Promise.race([loadPromise, timeoutPromise])
      
    
    return this.instance
  }
}

export interface UseWhisperDirectConfig extends WhisperConfig {
  alertService?: AlertService;
  toastService?: ToastService;
}

export function useWhisperDirect(config: UseWhisperDirectConfig = {}): UseWhisperReturn {
  const { alertService = defaultAlertService, toastService = defaultToastService, ...whisperConfig } = config;
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [modelReady, setModelReady] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [isLoadingFromCache] = useState(false)
  
  const pipelineRef = useRef<Pipeline | null>(null)
  const progressAlertRef = useRef<any>(null)
  const transcriptionQueueRef = useRef<Promise<any>>(Promise.resolve())

  // Initialize Transformers.js
  useEffect(() => {
    const loadModel = async () => {
      
      // Only show loading alert if not already loaded and not currently loading
      const shouldShowAlert = !WhisperPipelineSingleton.instance && !WhisperPipelineSingleton.isLoading
      
      if (shouldShowAlert) {
        // Show loading alert
        progressAlertRef.current = alertService.show({
          title: '[WHISPER_AI_INITIALIZATION]',
          message: 'Loading Whisper AI model...',
          type: 'loading',
          progress: 0
        })
      }

      try {

        // Get pipeline instance with progress callback
        pipelineRef.current = await WhisperPipelineSingleton.getInstance((progress: WhisperProgress) => {
          const percent = progress.progress || 0
          setLoadingProgress(Math.max(1, percent))
          
          // Update progress alert
          if (progressAlertRef.current) {
            const status = progress.status || 'downloading'
            const file = progress.file || 'model'
            progressAlertRef.current.update({
              message: `${status} ${file}...`,
              progress: percent
            })
          }
        })

        setModelReady(true)
        setLoadingProgress(100)

        // Close loading alert and show success only if we showed it
        if (progressAlertRef.current && shouldShowAlert) {
          progressAlertRef.current.close()
          progressAlertRef.current = null
          
          toastService.success('[AI_MODEL_READY] You can now start recording!')
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load model'
        setError(new Error(errorMessage))
        
        if (progressAlertRef.current) {
          progressAlertRef.current.close()
          progressAlertRef.current = null
        }
        
        alertService.show({
          title: '[MODEL_LOAD_ERROR]',
          message: errorMessage,
          type: 'error',
          onClose: () => {}
        })
      }
    }

    // Check if model is already loaded
    if (WhisperPipelineSingleton.instance) {
      pipelineRef.current = WhisperPipelineSingleton.instance
      setModelReady(true)
      setLoadingProgress(100)
    } else if (!pipelineRef.current && typeof window !== 'undefined') {
      loadModel()
    }

    return () => {
      if (progressAlertRef.current) {
        progressAlertRef.current.close()
        progressAlertRef.current = null
      }
    }
  }, [])

  // Convert audio blob to base64 data URL
  const audioToBase64 = async (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        resolve(base64)
      }
      reader.readAsDataURL(blob)
    })
  }

  const transcribe = useCallback(async (audioBlob: Blob): Promise<TranscriptionResult | null> => {
    // Queue transcriptions to prevent concurrent calls
    const transcriptionPromise = transcriptionQueueRef.current.then(async () => {
      
      if (isTranscribing) {
        return null
      }
      
      if (!pipelineRef.current || !modelReady) {
        setError(new Error('Model not ready'))
        return null
      }

      setIsTranscribing(true)
      setError(null)

      try {
      // Convert blob to data URL
      const audioDataUrl = await audioToBase64(audioBlob)
      
      // Perform transcription
      const startTime = Date.now()
      
      const output: WhisperOutput = await pipelineRef.current(audioDataUrl, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: whisperConfig.language || 'english',
        task: 'transcribe',
        return_timestamps: false,
      })
      
      const endTime = Date.now()

      const result: TranscriptionResult = {
        text: output.text,
        segments: output.chunks,
        chunkIndex: 0,
        timestamp: Date.now()
      }

      setTranscript(result.text)
      setIsTranscribing(false)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Transcription failed')
      setError(error)
      setIsTranscribing(false)
      
      matrixAlert.show({
        title: '[TRANSCRIPTION_ERROR]',
        message: error.message,
        type: 'error'
      })
      
      return null
    }
    })

    // Update queue reference
    transcriptionQueueRef.current = transcriptionPromise.catch(() => {})
    
    return transcriptionPromise
  }, [config, modelReady, isTranscribing])


  const clearTranscript = useCallback(() => {
    setTranscript(null)
    setError(null)
  }, [])

  return {
    isTranscribing,
    transcript,
    error,
    transcribe,
    clearTranscript,
    modelReady,
    loadingProgress,
    isLoadingFromCache
  }
}