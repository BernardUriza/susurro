import React, { useEffect, useState } from 'react'

export const DigitalRainfall: React.FC = () => {
  const [columns, setColumns] = useState<Array<{ left: string; delay: string; duration: string; chars: string }>>([])
  
  useEffect(() => {
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const columnCount = Math.floor(window.innerWidth / 20)
    
    const newColumns = Array.from({ length: columnCount }, (_, i) => ({
      left: `${(i / columnCount) * 100}%`,
      delay: `${Math.random() * 10}s`,
      duration: `${10 + Math.random() * 10}s`,
      chars: Array.from({ length: 50 }, () => chars[Math.floor(Math.random() * chars.length)]).join('\n')
    }))
    
    setColumns(newColumns)
  }, [])
  
  return (
    <div className="matrix-rain">
      {columns.map((col, i) => (
        <div
          key={i}
          className="matrix-rain-column"
          style={{
            left: col.left,
            animationDelay: col.delay,
            animationDuration: col.duration
          }}
        >
          {col.chars}
        </div>
      ))}
    </div>
  )
}