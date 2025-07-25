import { useState, useCallback, useEffect } from 'react';
import { useMurmubaraEngine as useMurmubaraEngineBase } from 'murmuraba';

export interface VADMetrics {
  originalVAD: number;
  processedVAD: number;
  noiseReduction: number;
}

export function useMurmubaraEngine() {
  const engine = useMurmubaraEngineBase({
    autoInitialize: true,
    defaultChunkDuration: 8,
    noiseReductionLevel: 'high',
    bufferSize: 2048,
    logLevel: 'info'
  });

  const [vadMetrics, setVadMetrics] = useState<VADMetrics>({
    originalVAD: 0,
    processedVAD: 0,
    noiseReduction: 0
  });

  // Calcular métricas VAD cuando hay chunks procesados
  useEffect(() => {
    if (engine.recordingState.chunks.length > 0) {
      const avgNoiseReduction = engine.getAverageNoiseReduction();
      
      // Calcular VAD promedio basado en los chunks
      const chunks = engine.recordingState.chunks;
      let totalOriginalVAD = 0;
      let totalProcessedVAD = 0;
      
      chunks.forEach(chunk => {
        // El VAD original se puede estimar como inverse de noise reduction
        const originalVAD = Math.max(0, 100 - chunk.noiseRemoved);
        const processedVAD = Math.min(100, originalVAD + chunk.noiseRemoved);
        
        totalOriginalVAD += originalVAD;
        totalProcessedVAD += processedVAD;
      });

      const avgOriginalVAD = chunks.length > 0 ? totalOriginalVAD / chunks.length : 0;
      const avgProcessedVAD = chunks.length > 0 ? totalProcessedVAD / chunks.length : 0;

      setVadMetrics({
        originalVAD: avgOriginalVAD / 100, // Normalizar a 0-1
        processedVAD: avgProcessedVAD / 100,
        noiseReduction: avgNoiseReduction
      });
    }
  }, [engine.recordingState.chunks, engine.getAverageNoiseReduction]);

  return {
    ...engine,
    vadMetrics
  };
}