'use client';

import { useEffect, useState } from 'react';

interface VADDisplayProps {
  audioFile: File | Blob;
  label: string;
  onVADCalculated?: (vad: number) => void;
}

export function VADDisplay({ audioFile, label, onVADCalculated }: VADDisplayProps) {
  const [vadScore, setVadScore] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    const calculateVAD = async () => {
      if (!audioFile) return;
      
      setIsCalculating(true);
      try {
        const murmuraba = await import('murmuraba');
        
        // Asegurar que el motor esté inicializado
        try {
          if (!murmuraba.isInitialized) {
            await murmuraba.initializeAudioEngine({
              enableAGC: true,
              enableNoiseSuppression: true,
              enableEchoCancellation: true
            });
          }
        } catch (err) {
          // Ignorar si ya está inicializado
        }

        // Analizar VAD
        const result = await murmuraba.analyzeVAD(audioFile);
        const score = result?.score || 0;
        
        setVadScore(score);
        if (onVADCalculated) {
          onVADCalculated(score);
        }
      } catch (error) {
        console.error(`Error calculating VAD for ${label}:`, error);
        setVadScore(0);
      } finally {
        setIsCalculating(false);
      }
    };

    calculateVAD();
  }, [audioFile, label, onVADCalculated]);

  if (isCalculating) {
    return (
      <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#00ff00' }}>
        Calculando VAD...
      </div>
    );
  }

  if (vadScore === null) return null;

  return (
    <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#00ff00' }}>
      VAD Score: {(vadScore * 100).toFixed(1)}%
    </div>
  );
}