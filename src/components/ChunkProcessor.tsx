'use client'

import React from 'react'

interface ChunkProcessorProps {
  onBack: () => void
}

export const ChunkProcessor: React.FC<ChunkProcessorProps> = ({ onBack }) => {
  return (
    <div className="construction-page">
      <button 
        className="matrix-back-button"
        onClick={onBack}
      >
        [&lt; BACK]
      </button>
      
      <div className="matrix-grid" />
      <div className="scan-line" />
      
      <div className="construction-text">
        &gt; GRANDES COSAS VIENEN, ESPÉRALAS &lt;
      </div>
      
      <div style={{ 
        marginTop: 40, 
        fontSize: '1rem', 
        opacity: 0.6,
        textAlign: 'center'
      }}>
        <p>[CHUNK_PROCESSOR_MODULE]</p>
        <p>STATUS: UNDER_CONSTRUCTION</p>
        <p>ETA: SOON™</p>
      </div>
      
      {/* Matrix rain effect for construction page */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '0.8rem',
        opacity: 0.5
      }}>
        <span style={{ animation: 'blink 1s infinite' }}>_</span>
      </div>
      
      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}