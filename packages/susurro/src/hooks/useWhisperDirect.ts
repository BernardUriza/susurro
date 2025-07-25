'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { WhisperConfig, TranscriptionResult, UseWhisperReturn } from '../lib/types'
import { cacheManager } from '../lib/cache-manager'
import { matrixAlert } from '../../../../src/components/MatrixAlert'
import { matrixToast } from '../../../../src/components/MatrixToast'

// Singleton pattern for Whisper pipeline
class WhisperPipelineSingleton {
  static task = 'automatic-speech-recognition'
  static model = 'Xenova/whisper-medium'
  static instance: any = null
  static pipeline: any = null
  static env: any = null
  static isLoading: boolean = false
  static loadingPromise: Promise<any> | null = null

  static async getInstance(progress_callback: any = null) {
    // If already loaded, return immediately
    if (this.instance) {
      console.log('♻️ [WhisperSingleton] Returning existing instance')
      return this.instance
    }

    // If currently loading, wait for the existing loading promise
    if (this.isLoading && this.loadingPromise) {
      console.log('⏳ [WhisperSingleton] Already loading, waiting for completion...')
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

  private static async loadInstance(progress_callback: any = null) {
    if (!this.pipeline) {
      // Dynamic import on first use
      const transformers = await import('@xenova/transformers')
      this.pipeline = transformers.pipeline
      this.env = transformers.env
      
      // Configure environment
      this.env.allowLocalModels = true
      this.env.useBrowserCache = true
      this.env.useCustomCache = true
      this.env.remoteURL = 'https://huggingface.co/'
      this.env.backends = {
        onnx: {
          wasm: {
            wasmPaths: '/'
          }
        }
      }
    }

    console.log('🚀 [WhisperSingleton] Creando nueva instancia del pipeline...')
      
      // Check cache first
      const cacheStatus = await cacheManager.getCacheStatus()
      if (cacheStatus.hasCache) {
        console.log('💾 [WhisperSingleton] Modelo encontrado en cache!')
      } else {
        console.log('⬇️ [WhisperSingleton] Modelo NO está en cache, se descargará...')
      }
      
      // Request persistent storage for better caching
      await cacheManager.requestPersistentStorage()
      
      this.instance = await this.pipeline(this.task, this.model, { 
        progress_callback,
        quantized: true 
      })
      
      console.log('✅ [WhisperSingleton] Pipeline creado exitosamente')
    
    return this.instance
  }
}

export function useWhisperDirect(config: WhisperConfig = {}): UseWhisperReturn {
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [modelReady, setModelReady] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [isLoadingFromCache] = useState(false)
  
  const pipelineRef = useRef<any>(null)
  const progressAlertRef = useRef<any>(null)
  const transcriptionQueueRef = useRef<Promise<any>>(Promise.resolve())

  // Initialize Transformers.js
  useEffect(() => {
    const loadModel = async () => {
      console.log('[useWhisper] Starting model load...')
      
      // Only show loading alert if not already loaded and not currently loading
      const shouldShowAlert = !WhisperPipelineSingleton.instance && !WhisperPipelineSingleton.isLoading
      
      if (shouldShowAlert) {
        // Show loading alert
        progressAlertRef.current = matrixAlert.show({
          title: '[WHISPER_AI_INITIALIZATION]',
          message: 'Loading Whisper AI model...',
          type: 'loading',
          progress: 0
        })
      }

      try {
        console.log('[useWhisper] Loading model using Singleton pattern...')

        // Get pipeline instance with progress callback
        pipelineRef.current = await WhisperPipelineSingleton.getInstance((progress: any) => {
          const percent = progress.progress || 0
          console.log(`[useWhisper] ${progress.status === 'download' ? '⬇️' : progress.status === 'progress' ? '⏳' : progress.status === 'done' ? '✅' : '🔄'} Progress: ${percent.toFixed(1)}% - ${progress.status}`)
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

        console.log('[useWhisper] Pipeline created successfully')
        setModelReady(true)
        setLoadingProgress(100)

        // Close loading alert and show success only if we showed it
        if (progressAlertRef.current && shouldShowAlert) {
          progressAlertRef.current.close()
          progressAlertRef.current = null
          
          matrixToast.success('[AI_MODEL_READY] You can now start recording!')
        }
      } catch (err) {
        console.error('[useWhisper] Error loading model:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to load model'
        setError(new Error(errorMessage))
        
        if (progressAlertRef.current) {
          progressAlertRef.current.close()
          progressAlertRef.current = null
        }
        
        matrixAlert.show({
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
      console.log('[useWhisper] Model already loaded, using existing instance')
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
      console.log('🎤 [transcribeAudio] Iniciando transcripción...')
      console.log(`📁 [transcribeAudio] Blob size: ${(audioBlob.size / 1024).toFixed(2)}KB, type: ${audioBlob.type}`)
      
      if (isTranscribing) {
        console.warn('⚠️ [transcribeAudio] Ya hay una transcripción en proceso, esperando...')
        return null
      }
      
      if (!pipelineRef.current || !modelReady) {
        console.error('❌ [transcribeAudio] Modelo no está listo!')
        console.log(`   - pipelineRef.current: ${!!pipelineRef.current}`)
        console.log(`   - modelReady: ${modelReady}`)
        setError(new Error('Model not ready'))
        return null
      }

      console.log('✅ [transcribeAudio] Modelo listo, procesando audio...')
      setIsTranscribing(true)
      setError(null)

      try {
      // Convert blob to data URL
      console.log('🔄 [transcribeAudio] Convirtiendo audio a base64...')
      const audioDataUrl = await audioToBase64(audioBlob)
      console.log(`✅ [transcribeAudio] Audio convertido, longitud: ${audioDataUrl.length} caracteres`)
      
      // Perform transcription
      console.log('🧠 [transcribeAudio] Ejecutando modelo Whisper...')
      const startTime = Date.now()
      
      const output = await pipelineRef.current(audioDataUrl, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: config.language || 'english',
        task: 'transcribe',
        return_timestamps: false,
      })
      
      const endTime = Date.now()
      console.log(`⏱️ [transcribeAudio] Transcripción completada en ${(endTime - startTime) / 1000}s`)

      const result: TranscriptionResult = {
        text: output.text,
        segments: output.chunks,
        chunkIndex: 0,
        timestamp: Date.now()
      }

      console.log(`📝 [transcribeAudio] Resultado: "${result.text.substring(0, 50)}..."`)
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