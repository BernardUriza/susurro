'use client'

import React from 'react'
import { useWhisper } from '../hooks/useWhisper'
import { WhisperConfig } from '../lib/types'

interface WhisperRecorderProps {
  config?: WhisperConfig
  onTranscription?: (text: string) => void
  className?: string
}

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

  const formatProgress = (progress: number) => {
    return `${Math.round(progress)}%`
  }

  return (
    <div className={`whisper-recorder ${className}`}>
      {!modelReady && (
        <div className="whisper-recorder__loading">
          <div className="whisper-recorder__loading-icon">🎙️</div>
          <div className="whisper-recorder__loading-text">
            {loadingProgress === 0 ? 'Verificando caché...' : `Cargando modelo Whisper... ${formatProgress(loadingProgress)}`}
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
                onClick={startRecording}
                disabled={isTranscribing || !modelReady}
                className="whisper-recorder__button whisper-recorder__button--start"
              >
                {isTranscribing ? 'Transcribiendo...' : 'Iniciar Grabación'}
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="whisper-recorder__button whisper-recorder__button--stop"
              >
                Detener Grabación
              </button>
            )}
          </div>

          {error && (
            <div className="whisper-recorder__error">
              Error: {error.message}
            </div>
          )}

          {transcript && (
            <div className="whisper-recorder__result">
              <div className="whisper-recorder__transcript">
                {transcript}
              </div>
              <button
                onClick={clearTranscript}
                className="whisper-recorder__button whisper-recorder__button--clear"
              >
                Limpiar
              </button>
            </div>
          )}

          <div className="whisper-recorder__info">
            <p className="whisper-recorder__info-text">
              🎙️ Transcripción local con Transformers.js - Sin servidor
            </p>
          </div>
        </>
      )}
    </div>
  )
}