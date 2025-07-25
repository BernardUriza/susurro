import React from 'react'

interface AudioPlayerProps {
  title: string
  audioUrl: string
  vadScore?: number
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  title, 
  audioUrl, 
  vadScore 
}) => {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3>{title}</h3>
      <audio src={audioUrl} controls style={{ width: '100%' }} />
      {vadScore !== undefined && (
        <p>VAD Score: {(vadScore * 100).toFixed(1)}%</p>
      )}
    </div>
  )
}