'use client'

import React from 'react'
import { useWhisper } from '../hooks/useWhisper'
import { WhisperConfig } from '../lib/types'
import Swal from 'sweetalert2'

interface WhisperRecorderProps {
  config?: WhisperConfig
  onTranscription?: (text: string) => void
  className?: string
}

// Configuración global de SweetAlert2 con tema oscuro
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
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

export const WhisperRecorder: React.FC<WhisperRecorderProps> = ({ 
  config, 
  onTranscription,
  className = ''
}) => {
  const {
    isRecording,
    isTranscribing,
    transcript,
    error,
    startRecording,
    stopRecording,
    clearTranscript,
    modelReady,
    loadingProgress
  } = useWhisper(config)

  React.useEffect(() => {
    if (transcript && onTranscription) {
      onTranscription(transcript)
    }
  }, [transcript, onTranscription])

  React.useEffect(() => {
    if (error) {
      Swal.fire({
        icon: 'error',
        title: '¡Error Diabólico!',
        text: error.message,
        background: '#000a00',
        color: '#ff0000',
        confirmButtonColor: '#00ff00',
        confirmButtonText: 'Entendido',
        customClass: {
          popup: 'swal-dark-popup',
          title: 'swal-error-title'
        },
        didOpen: (popup) => {
          popup.style.border = '2px solid #ff0000'
          popup.style.boxShadow = '0 0 30px #ff0000'
        }
      })
    }
  }, [error])

  const handleStartRecording = async () => {
    await Toast.fire({
      icon: 'success',
      title: '🎙️ Grabación iniciada',
      text: 'Habla claramente...'
    })
    startRecording()
  }

  const handleStopRecording = async () => {
    stopRecording()
    
    // Mostrar alerta de procesamiento
    const processingAlert = Swal.fire({
      title: '⚡ Procesando Audio',
      html: '<div class="swal-loading-spinner">🎵</div><br>Transcribiendo tu voz con IA diabólica...',
      allowOutsideClick: false,
      showConfirmButton: false,
      background: '#000a00',
      color: '#00ff00',
      customClass: {
        popup: 'swal-dark-popup'
      },
      didOpen: (popup) => {
        popup.style.border = '2px solid #00ff00'
        popup.style.boxShadow = '0 0 30px #00ff00'
        Swal.showLoading()
      }
    })
  }

  React.useEffect(() => {
    if (!isTranscribing && transcript) {
      Swal.close()
      Toast.fire({
        icon: 'success',
        title: '✅ Transcripción Completa',
        text: 'Tu voz ha sido capturada'
      })
    }
  }, [isTranscribing, transcript])

  React.useEffect(() => {
    if (modelReady && loadingProgress === 100) {
      Toast.fire({
        icon: 'success',
        title: '🤖 Modelo Cargado',
        text: 'Listo para transcribir'
      })
    }
  }, [modelReady, loadingProgress])

  const formatProgress = (progress: number) => {
    return `${Math.round(progress)}%`
  }

  return (
    <div className={`whisper-recorder ${className}`}>
      {!modelReady && (
        <div className="whisper-recorder__loading">
          <div className="whisper-recorder__loading-icon">🎙️</div>
          <div className="whisper-recorder__loading-text">
            {loadingProgress === 0 ? 'Inicializando...' : 
             loadingProgress < 5 ? 'Cargando librería de IA...' :
             `Cargando modelo Whisper... ${formatProgress(loadingProgress)}`}
          </div>
          <div className="whisper-recorder__progress-bar">
            <div 
              className="whisper-recorder__progress-fill"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <div className="whisper-recorder__loading-hint">
            {loadingProgress === 100 ? 'Inicializando...' : 'Primera vez: ~40MB • Próximas veces: instantáneo'}
          </div>
        </div>
      )}

      {modelReady && (
        <>
          <div className="whisper-recorder__controls">
            {!isRecording ? (
              <button
                onClick={handleStartRecording}
                disabled={isTranscribing || !modelReady}
                className="whisper-recorder__button whisper-recorder__button--start"
              >
                {isTranscribing ? 'Transcribing...' : 'Start Recording'}
              </button>
            ) : (
              <button
                onClick={handleStopRecording}
                className="whisper-recorder__button whisper-recorder__button--stop"
              >
                Stop Recording
              </button>
            )}
          </div>

          {transcript && (
            <div className="whisper-recorder__result">
              <div className="whisper-recorder__transcript">
                {transcript}
              </div>
              <button
                onClick={() => {
                  clearTranscript()
                  Toast.fire({
                    icon: 'info',
                    title: '🧹 Transcripción borrada'
                  })
                }}
                className="whisper-recorder__button whisper-recorder__button--clear"
              >
                Clear
              </button>
            </div>
          )}

          <div className="whisper-recorder__info">
            <p className="whisper-recorder__info-text">
              🎙️ Local transcription with Transformers.js - No server required
            </p>
          </div>
        </>
      )}
    </div>
  )
}