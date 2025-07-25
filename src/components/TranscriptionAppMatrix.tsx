'use client'

import React from 'react'
import { MatrixRain } from './MatrixRain'
import { useSusurro } from '@susurro/core'
import '../styles/matrix-theme.css'

export const TranscriptionAppMatrix: React.FC = () => {
  const { 
    isProcessing,
    transcriptions,
    processAudioFile,
    clearTranscriptions 
  } = useSusurro({
    chunkDurationMs: 8000,
    enableVAD: true
  })
  
  const [originalUrl, setOriginalUrl] = React.useState('')
  const [processedUrl, setProcessedUrl] = React.useState('')
  const [vadScore, setVadScore] = React.useState(0)
  const [status, setStatus] = React.useState('')
  
  const handleFileProcess = async (file: File) => {
    try {
      setStatus('Procesando audio...')
      setOriginalUrl(URL.createObjectURL(file))
      clearTranscriptions()
      
      await processAudioFile(file)
      setStatus('✅ Audio procesado y transcrito')
      
      return true
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`)
      return false
    }
  }
  
  const loadExampleAudio = async () => {
    const res = await fetch('/sample.wav')
    const blob = await res.blob()
    const file = new File([blob], 'sample.wav', { type: 'audio/wav' })
    await handleFileProcess(file)
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
                await handleFileProcess(file)
              }
            }}
          />
          
          <button 
            onClick={loadExampleAudio}
            disabled={isProcessing}
            className="matrix-button"
            style={{ width: '100%', marginBottom: 20 }}
          >
            {isProcessing ? '[PROCESSING...]' : '[LOAD_JFK_SAMPLE.WAV]'}
          </button>
        </div>
        
        {/* Status */}
        {status && (
          <div className={`matrix-status ${status.includes('Error') ? 'error' : ''}`}>
            &gt; {status}
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
              
              {transcriptions.length > 0 && (
                <div className="matrix-transcript">
                  &gt; TRANSCRIPT_OUTPUT:<br/>
                  <br/>
                  {transcriptions.map((t) => t.text).join(' ')}
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