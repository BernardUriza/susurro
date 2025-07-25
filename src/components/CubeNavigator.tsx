'use client'

import React, { useState } from 'react'
import { TranscriptionAppMatrix } from './TranscriptionAppMatrix'
import { ChunkProcessor } from './ChunkProcessor'
import '../styles/cube-flip.css'

type CubeFace = 'front' | 'right' | 'back' | 'left'

export const CubeNavigator: React.FC = () => {
  const [currentFace, setCurrentFace] = useState<CubeFace>('front')
  
  const rotateTo = (face: CubeFace) => {
    setCurrentFace(face)
  }
  
  const getCubeClass = () => {
    switch (currentFace) {
      case 'right':
        return 'cube rotate-to-right'
      case 'back':
        return 'cube rotate-to-back'
      case 'left':
        return 'cube rotate-to-left'
      default:
        return 'cube'
    }
  }
  
  return (
    <div className="cube-container">
      <div className={getCubeClass()}>
        {/* Front face - Main App */}
        <div className="cube-face cube-face-front">
          <TranscriptionAppMatrix />
          
          {/* Navigation button */}
          <button
            style={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              background: 'transparent',
              border: '1px solid #00ff41',
              color: '#00ff41',
              padding: '12px 24px',
              fontFamily: 'Courier New, monospace',
              cursor: 'pointer',
              transition: 'all 0.3s',
              textTransform: 'uppercase',
              zIndex: 1000
            }}
            onClick={() => rotateTo('right')}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#00ff41'
              e.currentTarget.style.color = '#000'
              e.currentTarget.style.boxShadow = '0 0 20px #00ff41'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#00ff41'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            [CHUNK_PROCESSOR →]
          </button>
        </div>
        
        {/* Right face - Chunk Processor */}
        <div className="cube-face cube-face-right">
          <ChunkProcessor onBack={() => rotateTo('front')} />
        </div>
        
        {/* Back face - Empty for now */}
        <div className="cube-face cube-face-back">
          <div style={{ 
            background: '#000', 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#00ff41',
            fontFamily: 'Courier New, monospace'
          }}>
            [RESERVED]
          </div>
        </div>
        
        {/* Left face - Empty for now */}
        <div className="cube-face cube-face-left">
          <div style={{ 
            background: '#000', 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#00ff41',
            fontFamily: 'Courier New, monospace'
          }}>
            [RESERVED]
          </div>
        </div>
      </div>
    </div>
  )
}