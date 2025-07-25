import React from 'react'

interface AudioUploaderProps {
  onFileSelect: (file: File) => void
  onExampleClick: () => void
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({ 
  onFileSelect, 
  onExampleClick 
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  return (
    <>
      <div 
        style={{ 
          border: '2px dashed #ccc', 
          padding: 40, 
          textAlign: 'center',
          borderRadius: 8,
          cursor: 'pointer',
          marginBottom: 20
        }}
        onClick={() => document.getElementById('file')?.click()}
      >
        <p>📁 Clic para seleccionar WAV</p>
      </div>
      
      <input 
        id="file"
        type="file" 
        accept=".wav"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      
      <button 
        onClick={onExampleClick}
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
    </>
  )
}