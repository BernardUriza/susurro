'use client';

import { useState, useEffect, useRef } from 'react';
import { murmurabaManager } from '../lib/murmuraba-singleton';

interface AudioProcessorProps {
  onProcessedAudio: (audioBlob: Blob, vadMetrics?: { original: number; processed: number; reduction: number }) => void;
  uploadedFile: File | null;
}

// Polyfill global
if (typeof window !== 'undefined' && typeof global === 'undefined') {
  (window as any).global = window;
}

export default function AudioProcessor({ onProcessedAudio, uploadedFile }: AudioProcessorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processedFileRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      murmurabaManager.destroy();
    };
  }, []);

  useEffect(() => {
    if (!uploadedFile || isProcessing) return;
    
    // Evitar reprocesar el mismo archivo
    const fileId = `${uploadedFile.name}-${uploadedFile.size}-${uploadedFile.lastModified}`;
    if (processedFileRef.current === fileId) return;
    
    const process = async () => {
      setIsProcessing(true);
      setError(null);
      
      try {
        // Initialize murmuraba if needed
        await murmurabaManager.initialize();
        
        const result = await murmurabaManager.processFile(uploadedFile, {
          outputFormat: 'blob',
          enableTranscription: false,
          enableVAD: true
        });
        
        if (result && result.processedAudio) {
          processedFileRef.current = fileId;
          
          // Calcular métricas VAD
          let vadMetrics = { original: 0, processed: 0, reduction: 0 };
          
          try {
            // Analizar VAD del archivo original
            const murmuraba = await murmurabaManager.getMurmuraba();
            if (murmuraba.analyzeVAD) {
              const originalVAD = await murmuraba.analyzeVAD(uploadedFile);
              // Analizar VAD del archivo procesado
              const processedVAD = await murmuraba.analyzeVAD(result.processedAudio);
              
              vadMetrics = {
                original: originalVAD?.score || 0,
                processed: processedVAD?.score || 0,
                reduction: result.noiseRemoved || 0
              };
            }
          } catch (err) {
            console.error('Error calculating VAD metrics:', err);
          }
          
          onProcessedAudio(result.processedAudio, vadMetrics);
        } else {
          // Si no hay audio procesado, usar el original
          onProcessedAudio(uploadedFile);
        }
      } catch (err: any) {
        console.error('Murmuraba error:', err);
        // En caso de error, usar el archivo original
        onProcessedAudio(uploadedFile);
        setError(`Audio processing failed: ${err.message || 'Unknown error'}`);
      } finally {
        setIsProcessing(false);
      }
    };
    
    process();
  }, [uploadedFile, onProcessedAudio, isProcessing]);

  if (error) return <div className="text-red-500">{error}</div>;
  if (isProcessing) return <div>Processing audio...</div>;
  
  return null;
}