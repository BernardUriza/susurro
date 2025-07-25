'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { WhisperConfig, TranscriptionResult, UseWhisperReturn } from '../lib/types'
import Swal from 'sweetalert2'

// Singleton pattern for Whisper pipeline
class WhisperPipelineSingleton {
  static task = 'automatic-speech-recognition'
  static model = 'Xenova/whisper-tiny'
  static instance: any = null
  static pipeline: any = null
  static env: any = null

  static async getInstance(progress_callback: any = null) {
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

    // Create pipeline instance if not exists
    if (!this.instance) {
      this.instance = await this.pipeline(this.task, this.model, { 
        progress_callback,
        quantized: true 
      })
    }
    
    return this.instance
  }
}

export function useWhisper(config: WhisperConfig = {}): UseWhisperReturn {
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [modelReady, setModelReady] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [isLoadingFromCache] = useState(false)
  
  const pipelineRef = useRef<any>(null)
  const progressAlertRef = useRef<any>(null)

  // Initialize Transformers.js
  useEffect(() => {
    const loadModel = async () => {
      console.log('[useWhisper] Starting model load...')
      
      // Show loading alert
      progressAlertRef.current = Swal.fire({
        title: '🤖 Initializing AI Model',
        html: `
          <div style="margin: 20px 0;">
            <div class="swal-loading-spinner" style="font-size: 3rem; margin-bottom: 20px;">🎙️</div>
            <p style="font-size: 1.1rem; margin-bottom: 20px;">Loading Whisper AI model...</p>
            <div style="background: #1a1a1a; border-radius: 10px; overflow: hidden; height: 10px; margin: 20px 0;">
              <div id="swal-progress-bar" style="background: linear-gradient(90deg, #3b82f6, #8b5cf6); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
            </div>
            <p id="swal-progress-text" style="font-size: 0.9rem; color: #888;">Initializing...</p>
          </div>
        `,
        allowOutsideClick: false,
        showConfirmButton: false,
        background: '#111',
        color: '#fff',
        customClass: {
          popup: 'swal-dark-popup',
          title: 'swal-dark-title'
        },
        didOpen: () => {
          Swal.showLoading()
        }
      })

      try {
        console.log('[useWhisper] Loading model using Singleton pattern...')

        // Get pipeline instance with progress callback
        pipelineRef.current = await WhisperPipelineSingleton.getInstance((progress: any) => {
          const percent = progress.progress || 0
          console.log('[useWhisper] Progress:', percent, progress.status)
          setLoadingProgress(Math.max(1, percent))
          
          // Update progress alert
          if (progressAlertRef.current && Swal.isVisible()) {
            const progressBar = document.getElementById('swal-progress-bar')
            const progressText = document.getElementById('swal-progress-text')
            if (progressBar) progressBar.style.width = `${percent}%`
            if (progressText) {
              const status = progress.status || 'downloading'
              const file = progress.file || 'model'
              progressText.textContent = `${status} ${file}... ${Math.round(percent)}%`
            }
          }
        })

        console.log('[useWhisper] Pipeline created successfully')
        setModelReady(true)
        setLoadingProgress(100)

        // Close loading alert and show success
        if (progressAlertRef.current) {
          Swal.close()
          progressAlertRef.current = null
          
          const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: '#111',
            color: '#fff',
            iconColor: '#3b82f6'
          })
          
          Toast.fire({
            icon: 'success',
            title: '🎉 AI Model Ready',
            text: 'You can now start recording!'
          })
        }
      } catch (err) {
        console.error('[useWhisper] Error loading model:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to load model'
        setError(new Error(errorMessage))
        
        if (progressAlertRef.current) {
          Swal.close()
          progressAlertRef.current = null
        }
        
        Swal.fire({
          icon: 'error',
          title: 'Failed to Load Model',
          text: errorMessage,
          background: '#111',
          color: '#fff',
          confirmButtonColor: '#3b82f6'
        })
      }
    }

    if (!pipelineRef.current && typeof window !== 'undefined') {
      loadModel()
    }

    return () => {
      if (progressAlertRef.current) {
        Swal.close()
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

  const transcribeAudio = useCallback(async (audioBlob: Blob): Promise<TranscriptionResult | null> => {
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
      const output = await pipelineRef.current(audioDataUrl, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: config.language || 'spanish',
        task: 'transcribe',
        return_timestamps: false,
      })

      const result: TranscriptionResult = {
        text: output.text,
        segments: output.chunks
      }

      setTranscript(result.text)
      setIsTranscribing(false)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Transcription failed')
      setError(error)
      setIsTranscribing(false)
      
      Swal.fire({
        icon: 'error',
        title: 'Transcription Error',
        text: error.message,
        background: '#111',
        color: '#fff',
        confirmButtonColor: '#3b82f6'
      })
      
      return null
    }
  }, [config, modelReady])


  const clearTranscript = useCallback(() => {
    setTranscript(null)
    setError(null)
  }, [])

  return {
    isTranscribing,
    transcript,
    error,
    transcribeAudio,
    clearTranscript,
    modelReady,
    loadingProgress,
    isLoadingFromCache
  }
}