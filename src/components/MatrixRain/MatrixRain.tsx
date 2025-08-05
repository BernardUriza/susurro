import React, { useEffect, useRef, useState } from 'react';
import styles from './MatrixRain.module.css';

interface MatrixRainProps {
  density?: number; // Number of columns (default: 100)
  speed?: number; // Fall speed (default: 30)
  opacity?: number; // Opacity of the rain (default: 0.15)
  fontSize?: number; // Font size of characters (default: 16)
  color?: string; // Color of characters (default: '#00ff41')
  glowIntensity?: number; // Glow intensity (default: 1)
  waveEffect?: boolean; // Enable wave effect (default: true)
  colorMode?: 'mono' | 'gradient' | 'rainbow'; // Color mode (default: 'gradient')
}

export const MatrixRain: React.FC<MatrixRainProps> = ({
  density = 100,
  speed = 30,
  opacity = 0.15,
  fontSize = 16,
  color = '#00ff41',
  glowIntensity = 1,
  waveEffect = true,
  colorMode = 'gradient',
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
    const columnBrightness: number[] = new Array(density).fill(0).map(() => Math.random());
    const columnPhases: number[] = new Array(density).fill(0).map((_, i) => (i / density) * Math.PI * 2);
    
    let waveOffset = 0;
    const waveFrequency = 0.05;
    const waveAmplitude = 20;

    const draw = () => {
      // Semi-transparent black background for trail effect with slight blue tint
      ctx.fillStyle = `rgba(0, 0, 1, 0.04)`;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
      
      // Update wave offset for animation
      if (waveEffect) {
        waveOffset += 0.02;
      }

      // Set text properties
      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Draw characters
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = i * columnWidth + columnWidth / 2;
        
        // Apply wave effect to y position
        const waveY = waveEffect 
          ? Math.sin(columnPhases[i] + waveOffset) * waveAmplitude 
          : 0;
        const y = drops[i] * fontSize + waveY;

        // Fade effect based on position
        const fadeStart = dimensions.height * 0.7;
        const fadeOpacity = y > fadeStart 
          ? Math.max(0, 1 - (y - fadeStart) / (dimensions.height - fadeStart))
          : 1;

        // Apply column-specific opacity with fade effect and brightness pulse
        const brightnessPulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.001 + columnPhases[i]);
        ctx.globalAlpha = opacity * columnOpacities[i] * fadeOpacity * (0.7 + 0.3 * brightnessPulse);
        
        // Color based on mode
        if (colorMode === 'rainbow') {
          const hue = (Date.now() * 0.05 + i * 10) % 360;
          ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        } else if (colorMode === 'gradient') {
          // Enhanced gradient with multiple color stops
          const gradient = ctx.createLinearGradient(0, y - fontSize * 2, 0, y + fontSize);
          gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
          gradient.addColorStop(0.3, 'rgba(0, 255, 100, 0.8)');
          gradient.addColorStop(0.5, color);
          gradient.addColorStop(0.7, 'rgba(0, 200, 65, 0.8)');
          gradient.addColorStop(1, 'rgba(0, 100, 30, 0)');
          ctx.fillStyle = gradient;
        } else {
          ctx.fillStyle = color;
        }

        // Add multi-layer glow effect
        if (columnBrightness[i] > 0.7 || Math.random() > 0.95) {
          // Outer glow
          ctx.shadowBlur = 30 * glowIntensity;
          ctx.shadowColor = colorMode === 'rainbow' 
            ? `hsl(${(Date.now() * 0.05 + i * 10) % 360}, 100%, 50%)`
            : color;
          ctx.fillText(text, x, y);
          
          // Inner glow
          ctx.shadowBlur = 15 * glowIntensity;
          ctx.shadowColor = '#ffffff';
          ctx.fillText(text, x, y);
          
          // Core text
          ctx.shadowBlur = 5 * glowIntensity;
          ctx.shadowColor = color;
          ctx.fillText(text, x, y);
          ctx.shadowBlur = 0;
        } else {
          ctx.fillText(text, x, y);
        }
        
        // Trailing characters with decreasing opacity
        for (let j = 1; j <= 3; j++) {
          const trailY = y - (j * fontSize);
          if (trailY > 0) {
            ctx.globalAlpha = (opacity * columnOpacities[i] * fadeOpacity) / (j * 2);
            const trailText = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(trailText, x, trailY);
          }
        }

        // Reset drop to top when it reaches bottom
        if (y > dimensions.height && Math.random() > 0.975) {
          drops[i] = 0;
          // Randomize properties on reset
          columnSpeeds[i] = 0.5 + Math.random() * 1.5;
          columnBrightness[i] = Math.random();
          columnOpacities[i] = 0.3 + Math.random() * 0.7;
        }

        // Move drop down with variable speed and slight horizontal drift
        drops[i] += columnSpeeds[i];
        
        // Occasionally boost speed for dynamic effect
        if (Math.random() > 0.995) {
          columnSpeeds[i] = Math.min(columnSpeeds[i] * 1.5, 3);
        }
      }
    };

    const interval = setInterval(draw, speed);
    return () => clearInterval(interval);
  }, [dimensions, fontSize, speed, color, opacity, density, glowIntensity, waveEffect, colorMode]);

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