'use client';

import { useEffect, useState } from 'react';
import { murmurabaManager } from '../lib/murmuraba-singleton';

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
        // Initialize murmuraba if needed
        await murmurabaManager.initialize();
        
        // Procesar archivo con métricas directamente
        const result = await murmurabaManager.processFileWithMetrics(audioFile as File, {
          enableVAD: true,
          enableTranscription: false,
          outputFormat: 'blob',
          // Add empty callback to avoid "onFrameProcessed is not a function" error
          onFrameProcessed: () => {}
        });
        
        // Calcular promedio de VAD scores
        const vadScores = result.metrics?.map((m: any) => m.vadScore || 0) || [];
        const score = vadScores.length > 0 
          ? vadScores.reduce((a: number, b: number) => a + b) / vadScores.length 
          : 0;
        
        setVadScore(score);
        if (onVADCalculated) {
          onVADCalculated(score);
        }
      } catch (error: any) {
        console.error(`Error calculating VAD for ${label}:`, error);
        // Si el error es porque murmuraba no soporta processFileWithMetrics, usar processFile
        if (error.message?.includes('processFileWithMetrics')) {
          try {
            await murmurabaManager.processFile(audioFile as File, {
              enableVAD: true,
              enableTranscription: false,
              outputFormat: 'blob',
              onFrameProcessed: () => {}
            });
            setVadScore(0);
          } catch (fallbackError) {
            console.error('Fallback processing also failed:', fallbackError);
            setVadScore(0);
          }
        } else {
          setVadScore(0);
        }
      } finally {
        setIsCalculating(false);
      }
    };

    calculateVAD();
  }, [audioFile, label, onVADCalculated]);

  useEffect(() => {
    return () => {
      murmurabaManager.destroy();
    };
  }, []);

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