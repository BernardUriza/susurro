'use client'

import React from 'react'
import { MatrixRain } from './MatrixRain'
import { useSusurro } from '../../packages/susurro/src'
import '../styles/matrix-theme.css'

export const TranscriptionAppMatrix: React.FC = () => {
  const { cleanAudio, transcribe, cleaning, transcribing, error } = useSusurro()
  
  const [originalUrl, setOriginalUrl] = React.useState('')
  const [processedUrl, setProcessedUrl] = React.useState('')
  const [vadScore, setVadScore] = React.useState(0)
  const [transcript, setTranscript] = React.useState('')
  const [status, setStatus] = React.useState('')
  
  const handleFileProcess = async (file: File) => {
    try {
      setStatus('Procesando audio...')
      setOriginalUrl(URL.createObjectURL(file))
      
      const { blob, vadScore: vad } = await cleanAudio(file)
      setProcessedUrl(URL.createObjectURL(blob))
      setVadScore(vad)
      setStatus('✅ Audio procesado')
      
      return blob
    } catch (err) {
      setStatus(`Error: ${err.message}`)
      return null
    }
  }
  
  const handleTranscribe = async (blob: Blob) => {
    try {
      setStatus('Transcribiendo...')
      const text = await transcribe(blob)
      setTranscript(text)
      setStatus('✅ Transcripción completada')
    } catch (err) {
      setStatus(`Error: ${err.message}`)
    }
  }
  
  const loadExampleAudio = async () => {
    const res = await fetch('/sample.wav')
    const blob = await res.blob()
    const file = new File([blob], 'sample.wav', { type: 'audio/wav' })
    const processedBlob = await handleFileProcess(file)
    if (processedBlob) {
      await handleTranscribe(processedBlob)
    }
  }

  return (
    <div className="matrix-theme">
      <MatrixRain />
      <div className="matrix-container" style={{ 
        maxWidth: 600, 
        margin: '40px auto', 
        padding: 20
      }}>
        <h1 className="matrix-title">
          [SUSURRO_MATRIX_v1.0]
        </h1>
        <p style={{ marginBottom: 30, opacity: 0.8 }}>
          &gt; INITIALIZING AUDIO NEURAL PROCESSOR...
        </p>
        
        {/* Upload Section */}
        <div style={{ marginBottom: 30 }}>
          <div 
            className="matrix-upload-area"
            style={{ 
              padding: 40, 
              textAlign: 'center',
              borderRadius: 0,
              cursor: 'pointer',
              marginBottom: 20
            }}
            onClick={() => document.getElementById('file')?.click()}
          >
            <p style={{ margin: 0 }}>&gt; DRAG_DROP_AUDIO.WAV</p>
          </div>
          
          <input 
            id="file"
            type="file" 
            accept=".wav"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) {
                const blob = await handleFileProcess(file)
                if (blob) await handleTranscribe(blob)
              }
            }}
          />
          
          <button 
            onClick={loadExampleAudio}
            disabled={cleaning || transcribing}
            className="matrix-button"
            style={{ width: '100%', marginBottom: 20 }}
          >
            {cleaning ? '[CLEANING_AUDIO...]' : transcribing ? '[TRANSCRIBING...]' : '[LOAD_JFK_SAMPLE.WAV]'}
          </button>
        </div>
        
        {/* Status */}
        {(status || error) && (
          <div className={`matrix-status ${(status.includes('Error') || error) ? 'error' : ''}`}>
            &gt; {error ? error.message : status}
          </div>
        )}
        
        {/* Original Audio */}
        {originalUrl && (
          <div className="matrix-audio-section">
            <h3>&gt; ORIGINAL_AUDIO_STREAM</h3>
            <audio src={originalUrl} controls style={{ width: '100%' }} />
          </div>
        )}
        
        {/* Processed Audio */}
        {processedUrl && (
          <>
            <div className="matrix-audio-section">
              <h3>&gt; PROCESSED_AUDIO_STREAM</h3>
              <audio src={processedUrl} controls style={{ width: '100%' }} />
              <p className="matrix-vad-score" style={{ marginTop: 10, marginBottom: 0 }}>
                &gt; VOICE_ACTIVITY_DETECTION: {(vadScore * 100).toFixed(1)}%
              </p>
            </div>
            
            {/* Transcription */}
            <div style={{ marginTop: 30 }}>
              
              {transcript && (
                <div className="matrix-transcript">
                  &gt; TRANSCRIPT_OUTPUT:<br/>
                  <br/>
                  {transcript}
                </div>
              )}
            </div>
          </>
        )}
        
        {/* Code Example */}
        <pre className="matrix-code" style={{ 
          padding: 20, 
          borderRadius: 0,
          overflow: 'auto',
          marginTop: 40
        }}>
{`> SYSTEM.IMPORT('murmuraba')

// Initialize audio processor
const result = await murmuraba.processFileWithMetrics(
  audioFile,
  (metrics) => console.log('[METRICS]', metrics)
)

// Output streams
> result.processedBuffer // cleaned audio stream
> result.averageVad     // voice activity score`}
        </pre>
        
        <p style={{ 
          textAlign: 'center', 
          marginTop: 40, 
          opacity: 0.6,
          fontSize: '0.9em'
        }}>
          [SYSTEM.READY] - MATRIX_AUDIO_PROCESSOR_ONLINE
        </p>
      </div>
    </div>
  )
}