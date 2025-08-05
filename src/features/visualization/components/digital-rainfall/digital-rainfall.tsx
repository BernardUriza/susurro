import React, { useEffect, useState } from 'react';

export const DigitalRainfall: React.FC = () => {
  const [columns, setColumns] = useState<
    Array<{ left: string; delay: string; duration: string; chars: string }>
  >([]);

  useEffect(() => {
    const chars =
      'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const columnCount = Math.floor(window.innerWidth / 15); // More columns for denser effect

    const newColumns = Array.from({ length: columnCount }, (_, i) => ({
      left: `${(i / columnCount) * 100}%`,
      delay: `${Math.random() * 5}s`, // Reduced max delay from 10s to 5s
      duration: `${8 + Math.random() * 8}s`, // Faster animation
      chars: Array.from({ length: 80 }, () => chars[Math.floor(Math.random() * chars.length)]).join(
        '\n'
      ),
    }));

    setColumns(newColumns);
    
    // Handle window resize
    const handleResize = () => {
      const newColumnCount = Math.floor(window.innerWidth / 15);
      const resizedColumns = Array.from({ length: newColumnCount }, (_, i) => ({
        left: `${(i / newColumnCount) * 100}%`,
        delay: `${Math.random() * 5}s`,
        duration: `${8 + Math.random() * 8}s`,
        chars: Array.from({ length: 80 }, () => chars[Math.floor(Math.random() * chars.length)]).join(
          '\n'
        ),
      }));
      setColumns(resizedColumns);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="matrix-rain">
      {columns.map((col, i) => (
        <div
          key={i}
          className="matrix-rain-column"
          style={{
            left: col.left,
            animationDelay: col.delay,
            animationDuration: col.duration,
          }}
        >
          {col.chars}
        </div>
      ))}
    </div>
  );
};
