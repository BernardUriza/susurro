import React, { useEffect, useRef, useState } from 'react';
import styles from './MatrixRain.module.css';

interface MatrixRainProps {
  density?: number; // Number of columns (default: 100)
  speed?: number; // Fall speed (default: 30)
  opacity?: number; // Opacity of the rain (default: 0.15)
  fontSize?: number; // Font size of characters (default: 16)
  color?: string; // Color of characters (default: '#00ff41')
}

export const MatrixRain: React.FC<MatrixRainProps> = ({
  density = 100,
  speed = 30,
  opacity = 0.15,
  fontSize = 16,
  color = '#00ff41',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Japanese characters for Matrix effect
  const matrixChars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const chars = matrixChars.split('');

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Skip if dimensions are not ready
    if (dimensions.width === 0 || dimensions.height === 0) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const columnWidth = dimensions.width / density;
    const drops: number[] = new Array(density).fill(1);
    const columnSpeeds: number[] = new Array(density).fill(0).map(() => 0.5 + Math.random() * 1.5);
    const columnOpacities: number[] = new Array(density).fill(0).map(() => 0.3 + Math.random() * 0.7);

    const draw = () => {
      // Semi-transparent black background for trail effect
      ctx.fillStyle = `rgba(0, 0, 0, 0.05)`;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Set text properties
      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Draw characters
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = i * columnWidth + columnWidth / 2;
        const y = drops[i] * fontSize;

        // Fade effect based on position
        const fadeStart = dimensions.height * 0.7;
        const fadeOpacity = y > fadeStart 
          ? Math.max(0, 1 - (y - fadeStart) / (dimensions.height - fadeStart))
          : 1;

        // Apply column-specific opacity with fade effect
        ctx.globalAlpha = opacity * columnOpacities[i] * fadeOpacity;
        
        // Gradient effect for characters
        const gradient = ctx.createLinearGradient(0, y - fontSize, 0, y + fontSize);
        gradient.addColorStop(0, 'rgba(0, 255, 65, 0)');
        gradient.addColorStop(0.5, color);
        gradient.addColorStop(1, 'rgba(0, 255, 65, 0)');
        ctx.fillStyle = gradient;

        ctx.fillText(text, x, y);

        // Add glow effect for some characters
        if (Math.random() > 0.98) {
          ctx.shadowBlur = 20;
          ctx.shadowColor = color;
          ctx.fillText(text, x, y);
          ctx.shadowBlur = 0;
        }

        // Reset drop to top when it reaches bottom
        if (y > dimensions.height && Math.random() > 0.975) {
          drops[i] = 0;
        }

        // Move drop down with variable speed
        drops[i] += columnSpeeds[i];
      }
    };

    const interval = setInterval(draw, speed);
    return () => clearInterval(interval);
  }, [dimensions, fontSize, speed, color, opacity, density]);

  return (
    <div className={styles.matrixRainContainer}>
      <canvas
        ref={canvasRef}
        className={styles.matrixCanvas}
        width={dimensions.width}
        height={dimensions.height}
      />
    </div>
  );
};