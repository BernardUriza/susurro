'use client'

import { useState, useEffect, useRef } from 'react'
import { useWhisper } from '../hooks/useWhisperDirect'
import Swal from 'sweetalert2'

interface AudioProcessingSectionProps {
  uploadedFile: File | null
  onTranscription: (text: string) => void
}

export function AudioProcessingSection({ uploadedFile, onTranscription }: AudioProcessingSectionProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const { transcribeAudio, isTranscribing, transcript, error, modelReady } = useWhisper()
  const processedFileRef = useRef<string | null>(null)
  const lastTranscriptRef = useRef<string | null>(null)

  useEffect(() => {
    if (transcript && transcript !== lastTranscriptRef.current) {
      lastTranscriptRef.current = transcript
      onTranscription(transcript)
    }
  }, [transcript, onTranscription])

  useEffect(() => {
    if (!uploadedFile || !modelReady || isProcessing) return
    
    const fileId = `${uploadedFile.name}-${uploadedFile.size}-${uploadedFile.lastModified}`
    if (processedFileRef.current === fileId) return
    
    processedFileRef.current = fileId
    processAudioFile(uploadedFile)
  }, [uploadedFile, modelReady, isProcessing])

  const processAudioFile = async (file: File) => {
    setIsProcessing(true)
    
    try {
      // El archivo ya viene procesado por murmuraba desde el AudioProcessor
      // Solo necesitamos pasarlo a Whisper para transcribir
      console.log('[AudioProcessingSection] Transcribiendo archivo procesado:', file.name)
      
      const result = await transcribeAudio(file)
      
      if (result) {
        const Toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 5000,
          timerProgressBar: true,
          background: '#000a00',
          color: '#00ff00',
          iconColor: '#00ff00',
          customClass: {
            popup: 'swal-dark-popup',
            title: 'swal-dark-title',
            timerProgressBar: 'swal-dark-progress'
          },
          didOpen: (toast) => {
            toast.style.border = '2px solid #00ff00'
            toast.style.boxShadow = '0 0 20px #00ff00'
          }
        })
        
        Toast.fire({
          icon: 'success',
          title: '✅ Transcripción completada',
          text: `${result.text.substring(0, 50)}...`
        })
      }
    } catch (err) {
      console.error('[AudioProcessingSection] Error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!modelReady) {
    return (
      <div className="mt-4 text-center">
        <p className="loading-status">🤖 Cargando modelo de IA...</p>
      </div>
    )
  }

  if (isTranscribing || isProcessing) {
    return (
      <div className="mt-4 text-center">
        <div className="processing-indicator">
          <div className="pulse-ring"></div>
          <p className="processing-text">🎯 Transcribiendo audio limpio...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-4 text-center">
        <p className="error-message">❌ Error: {error.message}</p>
      </div>
    )
  }

  return null
}