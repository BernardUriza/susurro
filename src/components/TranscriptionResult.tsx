import React from 'react'

interface TranscriptionResultProps {
  transcript: string
  isTranscribing: boolean
  onTranscribe: () => void
}

export const TranscriptionResult: React.FC<TranscriptionResultProps> = ({ 
  transcript, 
  isTranscribing, 
  onTranscribe 
}) => {
  return (
    <div>
      <button 
        onClick={onTranscribe}
        disabled={isTranscribing}
        style={{ 
          padding: '10px 20px',
          background: isTranscribing ? '#ccc' : '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: isTranscribing ? 'not-allowed' : 'pointer',
          marginBottom: 10
        }}
      >
        {isTranscribing ? '⏳ Transcribiendo...' : '🎯 Transcribir'}
      </button>
      {transcript && (
        <p style={{ 
          fontStyle: 'italic', 
          background: '#f5f5f5', 
          padding: 15, 
          borderRadius: 6 
        }}>
          {`"${transcript}"`}
        </p>
      )}
    </div>
  )
}