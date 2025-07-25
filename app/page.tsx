'use client'

import { useState } from 'react'
import { murmurabaManager } from '../src/lib/murmuraba-singleton'

export default function Home() {
  const [status, setStatus] = useState('')
  const [originalUrl, setOriginalUrl] = useState('')
  const [processedUrl, setProcessedUrl] = useState('')
  const [vadScore, setVadScore] = useState(0)
  const [transcription, setTranscription] = useState('')

  async function processAudio(file: File) {
    try {
      setStatus('Procesando...')
      
      // Mostrar original
      setOriginalUrl(URL.createObjectURL(file))
      
      // Procesar con murmuraba
      await murmurabaManager.initialize()
      const result = await murmurabaManager.processFileWithMetrics(file, (metrics) => {
        console.log('Frame:', metrics)
      })
      
      // Mostrar procesado
      const processedBlob = new Blob([result.processedBuffer], { type: 'audio/wav' })
      setProcessedUrl(URL.createObjectURL(processedBlob))
      setVadScore(result.averageVad || 0)
      
      setStatus('✅ Procesado')
    } catch (error: any) {
      setStatus(`Error: ${error.message}`)
    }
  }

  async function transcribe() {
    setStatus('Transcribiendo...')
    // Mock transcription
    setTimeout(() => {
      setTranscription('Esta es una demostración del procesamiento de audio...')
      setStatus('✅ Transcripción completada')
    }, 2000)
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 20, fontFamily: 'system-ui' }}>
      <h1>🎙️ Susurro</h1>
      <p>Demo mínimo con murmuraba</p>
      
      <div style={{ 
        border: '2px dashed #ccc', 
        padding: 40, 
        textAlign: 'center',
        borderRadius: 8,
        cursor: 'pointer',
        marginBottom: 20
      }}
      onClick={() => document.getElementById('file')?.click()}>
        <p>📁 Clic para seleccionar WAV</p>
      </div>
      
      <input 
        id="file"
        type="file" 
        accept=".wav"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) processAudio(file)
        }}
      />
      
      <button 
        onClick={async () => {
          const res = await fetch('/sample.wav')
          const blob = await res.blob()
          const file = new File([blob], 'sample.wav', { type: 'audio/wav' })
          processAudio(file)
        }}
        style={{ 
          padding: '10px 20px',
          background: '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          marginBottom: 20
        }}
      >
        📁 Usar ejemplo
      </button>
      
      {status && <p style={{ 
        padding: 10, 
        background: status.includes('Error') ? '#ffebee' : '#e8f5e9',
        borderRadius: 6,
        marginBottom: 20
      }}>{status}</p>}
      
      {originalUrl && (
        <div style={{ marginBottom: 20 }}>
          <h3>Original</h3>
          <audio src={originalUrl} controls style={{ width: '100%' }} />
        </div>
      )}
      
      {processedUrl && (
        <div style={{ marginBottom: 20 }}>
          <h3>Procesado (sin ruido)</h3>
          <audio src={processedUrl} controls style={{ width: '100%' }} />
          <p>VAD Score: {(vadScore * 100).toFixed(1)}%</p>
        </div>
      )}
      
      {processedUrl && (
        <div>
          <button 
            onClick={transcribe}
            style={{ 
              padding: '10px 20px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              marginBottom: 10
            }}
          >
            🎯 Transcribir
          </button>
          {transcription && (
            <p style={{ fontStyle: 'italic', background: '#f5f5f5', padding: 15, borderRadius: 6 }}>
              {`"${transcription}"`}
            </p>
          )}
        </div>
      )}
      
      <pre style={{ 
        background: '#263238', 
        color: '#aed581', 
        padding: 20, 
        borderRadius: 8,
        overflow: 'auto',
        marginTop: 40
      }}>
{`import murmuraba from 'murmuraba'

// Procesar audio
const result = await murmuraba.processFileWithMetrics(
  audioFile,
  (metrics) => console.log(metrics)
)

// result.processedBuffer - audio limpio
// result.averageVad - score de voz`}
      </pre>
    </div>
  )
}