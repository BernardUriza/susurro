'use client'

import React from 'react'
import { AudioUploader } from './AudioUploader'
import { AudioPlayer } from './AudioPlayer'
import { TranscriptionResult } from './TranscriptionResult'
import { StatusMessage } from './StatusMessage'
import { CodeExample } from './CodeExample'
import { MatrixRain } from './MatrixRain'
import { useAudioProcessor } from '../hooks/useAudioProcessor'
import { useTranscription } from '../hooks/useTranscription'
import '../styles/matrix-theme.css'

export const TranscriptionAppMatrix: React.FC = () => {
  const {
    originalUrl,
    processedUrl,
    processedFile,
    vadScore,
    status: processingStatus,
    processAudio,
    loadExampleAudio
  } = useAudioProcessor()

  const {
    transcript,
    isTranscribing,
    transcriptionStatus,
    handleTranscribe
  } = useTranscription()

  const displayStatus = transcriptionStatus || processingStatus

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
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) processAudio(file)
            }}
          />
          
          <button 
            onClick={loadExampleAudio}
            className="matrix-button"
            style={{ width: '100%', marginBottom: 20 }}
          >
            [LOAD_JFK_SAMPLE.WAV]
          </button>
        </div>
        
        {/* Status */}
        {displayStatus && (
          <div className={`matrix-status ${displayStatus.includes('Error') ? 'error' : ''}`}>
            &gt; {displayStatus}
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
              <button 
                onClick={() => handleTranscribe(processedFile)}
                disabled={isTranscribing}
                className="matrix-button"
                style={{ width: '100%', marginBottom: 15 }}
              >
                {isTranscribing ? '[PROCESSING_NEURAL_NETWORK...]' : '[EXECUTE_WHISPER_AI]'}
              </button>
              
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