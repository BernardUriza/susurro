import React from 'react'

export const CodeExample: React.FC = () => {
  return (
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
  )
}