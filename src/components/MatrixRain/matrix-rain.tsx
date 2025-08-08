import React, { useEffect, useRef, useState } from 'react';
import styles from './matrix-rain.module.css';

interface MatrixRainProps {
  density?: number;
  speed?: number;
  opacity?: number;
  fontSize?: number;
  color?: string;
}

export const MatrixRain: React.FC<MatrixRainProps> = ({
  opacity = 0.08,
  fontSize = 16,
  color = '#00ff41',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const dropsRef = useRef<{ pos: number; speed: number; brightness: number; trail: string[] }[]>(
    []
  );
  const animationRef = useRef<number>(0);

  const matrixChars =
    'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
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
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const columnWidth = fontSize;
    const columns = Math.floor(dimensions.width / columnWidth);

    // Initialize drops with enhanced properties
    if (dropsRef.current.length !== columns) {
      dropsRef.current = Array.from({ length: columns }, () => ({
        pos: Math.floor((Math.random() * -dimensions.height) / fontSize),
        speed: 0.5 + Math.random() * 1.5, // Variable speed between 0.5 and 2
        brightness: Math.random(),
        trail: Array(5).fill(''), // Store last 5 characters for trail effect
      }));
    }

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : { r: 0, g: 255, b: 65 };
    };

    const rgb = hexToRgb(color);

    const draw = () => {
      // Enhanced fade effect with slight blue tint
      ctx.fillStyle = 'rgba(0, 0, 2, 0.05)';
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      for (let i = 0; i < dropsRef.current.length; i++) {
        const drop = dropsRef.current[i];
        const x = i * columnWidth;
        const y = drop.pos * fontSize;

        // Generate new character
        const text = chars[Math.floor(Math.random() * chars.length)];

        // Update trail
        drop.trail.shift();
        drop.trail.push(text);

        // Draw trail with fading effect
        drop.trail.forEach((char, index) => {
          if (char) {
            const trailY = y - (drop.trail.length - index) * fontSize;
            if (trailY >= 0) {
              const trailOpacity = (index / drop.trail.length) * opacity * 0.6;
              ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${trailOpacity})`;
              ctx.fillText(char, x, trailY);
            }
          }
        });

        // Draw main character with glow effect for bright ones
        if (Math.random() > 0.98) {
          // Occasional bright flash
          drop.brightness = 1;
          ctx.shadowBlur = 20;
          ctx.shadowColor = color;
          ctx.fillStyle = '#ffffff';
        } else {
          drop.brightness *= 0.98; // Gradual fade
          const brightness = 0.3 + drop.brightness * 0.7;
          ctx.shadowBlur = drop.brightness > 0.5 ? 10 : 0;
          ctx.shadowColor = color;
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * brightness})`;
        }

        // Apply fade based on position
        const fadePoint = dimensions.height * 0.7;
        if (y > fadePoint) {
          const fadeFactor = 1 - (y - fadePoint) / (dimensions.height - fadePoint);
          ctx.globalAlpha = fadeFactor;
        } else {
          ctx.globalAlpha = 1;
        }

        ctx.fillText(text, x, y);
        ctx.shadowBlur = 0; // Reset shadow

        // Reset drop when it goes off screen
        if (drop.pos * fontSize > dimensions.height + fontSize * 10) {
          drop.pos = -Math.floor(Math.random() * 30);
          drop.speed = 0.5 + Math.random() * 1.5;
          drop.brightness = Math.random() * 0.5;
          drop.trail = Array(5).fill('');
        }

        // Move drop down at variable speed
        drop.pos += drop.speed;
      }
    };

    const animate = () => {
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions, fontSize, color, opacity, chars]);

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
