'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { WhisperConfig, TranscriptionResult, UseWhisperReturn } from '../lib/types'
import Swal from 'sweetalert2'

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
  const progressAlertRef = useRef<any>(null)

  // Initialize Web Worker
  useEffect(() => {
    console.log('[useWhisper] useEffect triggered, workerRef.current:', workerRef.current)
    
    if (!workerRef.current && typeof window !== 'undefined') {
      console.log('[useWhisper] Creating new worker...')
      
      // Show initial loading alert
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
        // Create worker - Next.js will handle this differently
        const workerUrl = '/whisper.worker.js'
        console.log('[useWhisper] Attempting to create worker from:', workerUrl)
        
        // Create worker as classic since we're using importScripts
        workerRef.current = new Worker(workerUrl)
        console.log('[useWhisper] Worker created successfully')

        // Set up message handler
        workerRef.current.onmessage = (event) => {
          const { type, data } = event.data
          console.log('[useWhisper] Message from worker:', type, data)

          switch (type) {
            case 'initiate':
              console.log('[Hook] Loading Whisper model...')
              setLoadingProgress(1) // Set minimum progress to show it's starting
              // Update progress alert
              if (progressAlertRef.current) {
                const progressBar = document.getElementById('swal-progress-bar')
                const progressText = document.getElementById('swal-progress-text')
                if (progressBar) progressBar.style.width = '1%'
                if (progressText) progressText.textContent = 'Starting download...'
              }
              break
            
            case 'progress':
              const progress = data.progress || 0
              console.log('[Hook] Progress update:', progress, data.status)
              setLoadingProgress(Math.max(1, progress)) // Never show 0% after initiate
              
              // Update progress alert
              if (progressAlertRef.current) {
                const progressBar = document.getElementById('swal-progress-bar')
                const progressText = document.getElementById('swal-progress-text')
                if (progressBar) progressBar.style.width = `${progress}%`
                if (progressText) {
                  const status = data.status || 'downloading'
                  const file = data.file || 'model'
                  progressText.textContent = `${status} ${file}... ${Math.round(progress)}%`
                }
              }
              
              if (data.cachedModel) {
                setIsLoadingFromCache(true)
              }
              break
            
            case 'ready':
              setModelReady(true)
              setLoadingProgress(100)
              console.log('[Hook] Whisper model ready!')
              
              // Close progress alert and show success
              if (progressAlertRef.current) {
                Swal.close()
                progressAlertRef.current = null
                
                // Show success toast
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
              
              // Close progress alert and show error
              if (progressAlertRef.current) {
                Swal.close()
                progressAlertRef.current = null
              }
              
              Swal.fire({
                icon: 'error',
                title: 'Failed to Load Model',
                text: data,
                background: '#111',
                color: '#fff',
                confirmButtonColor: '#3b82f6'
              })
              break
          }
        }

        // Add error handler
        workerRef.current.onerror = (error) => {
          console.error('[Hook] Worker error:', error)
          console.error('[Hook] Worker error details:', {
            filename: error.filename || 'unknown',
            lineno: error.lineno || 'unknown',
            message: error.message || 'No message'
          })
          setError(new Error('Worker failed to load'))
          setLoadingProgress(0)
          
          if (progressAlertRef.current) {
            Swal.close()
            progressAlertRef.current = null
          }
          
          Swal.fire({
            icon: 'error',
            title: 'Worker Error',
            html: `
              <p>Failed to initialize AI worker.</p>
              <p style="font-size: 0.9rem; color: #888; margin-top: 10px;">
                This might be due to:<br>
                • Browser compatibility issues<br>
                • Module import errors<br>
                • Missing dependencies
              </p>
              <p style="font-size: 0.85rem; margin-top: 15px;">Please check the console for details.</p>
            `,
            background: '#111',
            color: '#fff',
            confirmButtonColor: '#3b82f6',
            confirmButtonText: 'OK'
          })
        }

        // Load the model
        console.log('[Hook] Sending load message to worker...')
        workerRef.current.postMessage({ type: 'load' })
        
      } catch (error) {
        console.error('[useWhisper] Failed to create worker:', error)
        setError(new Error('Failed to initialize worker'))
        
        if (progressAlertRef.current) {
          Swal.close()
          progressAlertRef.current = null
        }
        
        Swal.fire({
          icon: 'error',
          title: 'Initialization Error',
          text: 'Failed to start AI model. Please check your browser compatibility.',
          background: '#111',
          color: '#fff',
          confirmButtonColor: '#3b82f6'
        })
      }
    }
    
    // Cleanup function
    return () => {
      console.log('[useWhisper] Cleanup called')
      if (progressAlertRef.current) {
        Swal.close()
        progressAlertRef.current = null
      }
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
      
      Swal.fire({
        icon: 'error',
        title: 'Microphone Error',
        text: 'Could not access your microphone. Please check permissions.',
        background: '#111',
        color: '#fff',
        confirmButtonColor: '#3b82f6'
      })
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