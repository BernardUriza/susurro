import { useState } from 'react'
import { useWhisper } from './useWhisperDirect'

export const useTranscription = () => {
  const [status, setStatus] = useState('')
  const { transcribeAudio, transcript, isTranscribing } = useWhisper()

  const handleTranscribe = async (processedFile: File | null) => {
    if (!processedFile) {
      setStatus('No hay archivo procesado para transcribir')
      return
    }
    
    try {
      setStatus('Transcribiendo con Whisper...')
      const result = await transcribeAudio(processedFile)
      if (result && result.text) {
        setStatus('✅ Transcripción completada')
      } else {
        setStatus('No se pudo transcribir')
      }
    } catch (error: any) {
      setStatus(`Error: ${error.message}`)
    }
  }

  return {
    transcript,
    isTranscribing,
    transcriptionStatus: status,
    handleTranscribe
  }
}