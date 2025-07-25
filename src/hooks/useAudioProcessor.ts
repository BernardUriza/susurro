import { useState } from 'react'
import { murmurabaManager } from '../lib/murmuraba-singleton'

interface AudioProcessorState {
  originalUrl: string
  processedUrl: string
  processedFile: File | null
  vadScore: number
  status: string
}

export const useAudioProcessor = () => {
  const [state, setState] = useState<AudioProcessorState>({
    originalUrl: '',
    processedUrl: '',
    processedFile: null,
    vadScore: 0,
    status: ''
  })

  const processAudio = async (file: File) => {
    try {
      setState(prev => ({ ...prev, status: 'Procesando...' }))
      
      // Mostrar original
      const originalUrl = URL.createObjectURL(file)
      setState(prev => ({ ...prev, originalUrl }))
      
      // Procesar con murmuraba
      await murmurabaManager.initialize()
      const result = await murmurabaManager.processFileWithMetrics(file, (metrics) => {
        console.log('Frame:', metrics)
      })
      
      // Mostrar procesado
      const processedBlob = new Blob([result.processedBuffer], { type: 'audio/wav' })
      const processedFileObj = new File([processedBlob], 'processed.wav', { type: 'audio/wav' })
      const processedUrl = URL.createObjectURL(processedBlob)
      
      setState(prev => ({
        ...prev,
        processedUrl,
        processedFile: processedFileObj,
        vadScore: result.averageVad || 0,
        status: '✅ Procesado'
      }))
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        status: `Error: ${error.message}`
      }))
    }
  }

  const loadExampleAudio = async () => {
    try {
      const res = await fetch('/sample.wav')
      const blob = await res.blob()
      const file = new File([blob], 'sample.wav', { type: 'audio/wav' })
      await processAudio(file)
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        status: `Error al cargar ejemplo: ${error.message}`
      }))
    }
  }

  return {
    ...state,
    processAudio,
    loadExampleAudio
  }
}