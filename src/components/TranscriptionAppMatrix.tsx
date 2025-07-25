'use client'

import React from 'react'
import { MatrixRain } from './MatrixRain'
import { useSusurro } from '@susurro/core'
import '../styles/matrix-theme.css'

export const TranscriptionAppMatrix: React.FC = () => {
  const { 
    isProcessing,
    transcriptions,
    audioChunks,
    averageVad,
    processAudioFile,
    clearTranscriptions 
  } = useSusurro({
    chunkDurationMs: 8000,
    enableVAD: true
  })
  
  const [originalUrl, setOriginalUrl] = React.useState('')
  const [chunkUrls, setChunkUrls] = React.useState<string[]>([])
  const [status, setStatus] = React.useState('')
  
  // Create URLs for each audio chunk
  React.useEffect(() => {
    if (audioChunks && audioChunks.length > 0) {
      console.log('[TranscriptionAppMatrix] Creating URLs for', audioChunks.length, 'chunks')
      
      // Create URL for each chunk
      const urls = audioChunks.map(chunk => URL.createObjectURL(chunk.blob))
      setChunkUrls(urls)
      
      return () => {
        // Cleanup old URLs
        urls.forEach(url => URL.revokeObjectURL(url))
      }
    }
  }, [audioChunks])
  
  const handleFileProcess = async (file: File) => {
    try {
      setStatus('[INITIALIZING_NEURAL_PROCESSOR...]')
      setOriginalUrl(URL.createObjectURL(file))
      clearTranscriptions()
      
      // Add timeout to prevent infinite hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Processing timeout')), 30000)
      })
      
      await Promise.race([
        processAudioFile(file),
        timeoutPromise
      ])
      
      setStatus('[PROCESSING_COMPLETE]')
      
      return true
    } catch (err) {
      console.error('File processing error:', err)
      setStatus(`[ERROR] ${err instanceof Error ? err.message : 'Unknown error'}`)
      return false
    }
  }
  
  const loadExampleAudio = async () => {
    try {
      setStatus('[LOADING_SAMPLE_AUDIO...]')
      const res = await fetch('/sample.wav')
      if (!res.ok) {
        throw new Error(`Failed to load sample: ${res.status}`)
      }
      const blob = await res.blob()
      const file = new File([blob], 'sample.wav', { type: 'audio/wav' })
      await handleFileProcess(file)
    } catch (error) {
      console.error('Error loading sample:', error)
      setStatus(`[ERROR] ${error instanceof Error ? error.message : 'Failed to load sample'}`)
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
            onClick={() => {
              if (!isProcessing) {
                document.getElementById('file')?.click()
              }
            }}
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
            onClick={() => {
              if (!isProcessing) {
                loadExampleAudio()
              }
            }}
            disabled={isProcessing}
            className="matrix-button"
            style={{ width: '100%', marginBottom: 20, opacity: isProcessing ? 0.5 : 1 }}
          >
            {isProcessing ? '[MURMURABA_PROCESSING...]' : '[LOAD_JFK_SAMPLE.WAV]'}
          </button>
        </div>
        
        {/* Status */}
        {status && (
          <div className={`matrix-status ${status.includes('ERROR') ? 'error' : ''}`}>
            &gt; {status}
          </div>
        )}
        
        {/* Processing Status */}
        {isProcessing && (
          <div className="matrix-status" style={{ marginTop: 10 }}>
            &gt; [MURMURABA_PROCESSING] CLEANING_AUDIO...
          </div>
        )}
        
        {/* Original Audio */}
        {originalUrl && (
          <div className="matrix-audio-section">
            <h3>&gt; ORIGINAL_AUDIO_STREAM</h3>
            <audio src={originalUrl} controls style={{ width: '100%' }} />
          </div>
        )}
        
        {/* Processed Audio Chunks */}
        {chunkUrls.length > 0 && (
          <>
            <div className="matrix-audio-section" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>&gt; MURMURABA_CLEANED_AUDIO</h3>
                <div style={{ 
                  fontSize: '2.5em', 
                  color: '#00ff41',
                  fontWeight: 'bold',
                  textShadow: '0 0 10px #00ff41',
                  marginRight: 20
                }}>
                  VAD: {(averageVad * 100).toFixed(1)}%
                </div>
              </div>
              
              <p className="matrix-vad-score" style={{ marginTop: 10, marginBottom: 10 }}>
                &gt; AUDIO_ENHANCEMENT: NOISE_REDUCTION | AGC | ECHO_CANCELLATION
              </p>
              
              {/* Individual chunk players */}
              {audioChunks.map((chunk, index) => (
                <div key={chunk.id} style={{ marginBottom: 15 }}>
                  <p style={{ margin: '5px 0', fontSize: '0.9em', opacity: 0.8 }}>
                    &gt; CHUNK_{index + 1} | DURATION: {(chunk.duration / 1000).toFixed(2)}s | VAD: {chunk.vadScore ? (chunk.vadScore * 100).toFixed(1) : 'N/A'}%
                  </p>
                  <audio 
                    src={chunkUrls[index]} 
                    controls 
                    style={{ width: '100%', height: '35px' }} 
                  />
                </div>
              ))}
              
              <p className="matrix-vad-score" style={{ marginTop: 10, marginBottom: 0, opacity: 0.7 }}>
                &gt; TOTAL_CHUNKS: {audioChunks.length} | TOTAL_DURATION: {(audioChunks.reduce((acc, chunk) => acc + chunk.duration, 0) / 1000).toFixed(2)}s
              </p>
            </div>
            
            {/* Transcription */}
            <div style={{ marginTop: 30 }}>
              
              {transcriptions.length > 0 && (
                <div className="matrix-transcript">
                  &gt; MURMURABA_OUTPUT:<br/>
                  <br/>
                  {transcriptions.map((t, i) => (
                    <div key={i}>
                      [{new Date(t.timestamp).toLocaleTimeString()}] {t.text}
                    </div>
                  ))}
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

// Audio cleaning pipeline
const cleaned = await murmuraba.processFile(audioFile, {
  enableAGC: true,
  enableNoiseSuppression: true,
  enableEchoCancellation: true,
  enableVAD: true
})

// Output: Neural-processed audio
> cleaned.processedBuffer // ML-enhanced audio
> [WHISPER_DISABLED] // Transcription temporarily offline`}
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