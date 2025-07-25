import { useState, useCallback } from 'react'
import { murmurabaManager } from '../lib/murmuraba-singleton'
import Swal from 'sweetalert2'

export interface ProcessedAudioResult {
  original: File
  processed: File
  vadScore: number
  metrics: Array<{
    vad: number
    frame: number
    timestamp: number
    rms: number
  }>
}

export const useAudioProcessing = () => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAudioFile = async (url: string): Promise<File> => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`)
    
    const blob = await response.blob()
    const filename = url.split('/').pop() || 'audio.wav'
    return new File([blob], filename, { type: 'audio/wav' })
  }

  const processAudio = useCallback(async (
    input: File | string,
    options?: {
      showLoading?: boolean
      onProgress?: (metrics: any) => void
    }
  ): Promise<ProcessedAudioResult | null> => {
    setIsProcessing(true)
    setError(null)

    let loadingModal: any = null

    try {
      // Show loading if requested
      if (options?.showLoading) {
        loadingModal = Swal.fire({
          title: '⏳ Procesando audio...',
          html: 'Aplicando procesamiento VAD con Murmuraba...',
          allowOutsideClick: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading()
          }
        })
      }

      // Get file from URL if needed
      const file = typeof input === 'string' ? await fetchAudioFile(input) : input

      // Initialize murmuraba
      await murmurabaManager.initialize()

      // Process once with metrics
      const result = await murmurabaManager.processFileWithMetrics(
        file,
        options?.onProgress || (() => {})
      )

      // Close loading
      if (loadingModal) {
        Swal.close()
      }

      // Create processed file
      const processedFile = new File(
        [result.processedBuffer],
        file.name.replace(/\.wav$/, '_processed.wav'),
        { type: 'audio/wav' }
      )

      return {
        original: file,
        processed: processedFile,
        vadScore: result.averageVad || 0,
        metrics: result.metrics || []
      }

    } catch (err: any) {
      console.error('Audio processing error:', err)
      setError(err.message || 'Error processing audio')
      
      if (loadingModal) {
        Swal.close()
      }

      // Show error
      if (options?.showLoading) {
        Swal.fire({
          icon: 'error',
          title: 'Error al procesar',
          text: err.message || 'No se pudo procesar el audio'
        })
      }

      return null
    } finally {
      setIsProcessing(false)
    }
  }, [])

  return {
    processAudio,
    isProcessing,
    error
  }
}