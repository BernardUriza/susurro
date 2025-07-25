'use client'

import React from 'react'
import { AudioUploader } from './AudioUploader'
import { AudioPlayer } from './AudioPlayer'
import { TranscriptionResult } from './TranscriptionResult'
import { StatusMessage } from './StatusMessage'
import { CodeExample } from './CodeExample'
import { useAudioProcessor } from '../hooks/useAudioProcessor'
import { useTranscription } from '../hooks/useTranscription'

export const TranscriptionApp: React.FC = () => {
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

  // Combinar estados para mostrar
  const displayStatus = transcriptionStatus || processingStatus

  return (
    <div style={{ 
      maxWidth: 600, 
      margin: '40px auto', 
      padding: 20, 
      fontFamily: 'system-ui' 
    }}>
      <h1>🎙️ Susurro</h1>
      <p>Demo mínimo con murmuraba</p>
      
      <AudioUploader 
        onFileSelect={processAudio}
        onExampleClick={loadExampleAudio}
      />
      
      <StatusMessage status={displayStatus} />
      
      {originalUrl && (
        <AudioPlayer 
          title="Original" 
          audioUrl={originalUrl} 
        />
      )}
      
      {processedUrl && (
        <>
          <AudioPlayer 
            title="Procesado (sin ruido)" 
            audioUrl={processedUrl}
            vadScore={vadScore}
          />
          
          <TranscriptionResult
            transcript={transcript}
            isTranscribing={isTranscribing}
            onTranscribe={() => handleTranscribe(processedFile)}
          />
        </>
      )}
      
      <CodeExample />
    </div>
  )
}