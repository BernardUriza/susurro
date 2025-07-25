'use client';

import { useState, useEffect, useRef } from 'react';

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
  const [murmuraba, setMurmuraba] = useState<any>(null);
  const processedFileRef = useRef<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const m = await import('murmuraba');
        setMurmuraba(m);
      } catch (err) {
        setError('Error loading audio processor');
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!uploadedFile || !murmuraba || isProcessing) return;
    
    // Evitar reprocesar el mismo archivo
    const fileId = `${uploadedFile.name}-${uploadedFile.size}-${uploadedFile.lastModified}`;
    if (processedFileRef.current === fileId) return;
    
    const process = async () => {
      setIsProcessing(true);
      setError(null);
      
      try {
        // Inicializar el motor si es necesario
        if (!murmuraba.isInitialized) {
          await murmuraba.initializeAudioEngine({
            enableAGC: true,
            enableNoiseSuppression: true,
            enableEchoCancellation: true
          });
        }
        
        const { processFile, analyzeVAD } = murmuraba;
        const result = await processFile(uploadedFile, {
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
            const originalVAD = await analyzeVAD(uploadedFile);
            // Analizar VAD del archivo procesado
            const processedVAD = await analyzeVAD(result.processedAudio);
            
            vadMetrics = {
              original: originalVAD?.score || 0,
              processed: processedVAD?.score || 0,
              reduction: result.noiseRemoved || 0
            };
          } catch (err) {
            console.error('Error calculating VAD metrics:', err);
          }
          
          onProcessedAudio(result.processedAudio, vadMetrics);
        } else {
          // Si no hay audio procesado, usar el original
          onProcessedAudio(uploadedFile);
        }
      } catch (err) {
        console.error('Murmuraba error:', err);
        // En caso de error, usar el archivo original
        onProcessedAudio(uploadedFile);
      } finally {
        setIsProcessing(false);
      }
    };
    
    process();
  }, [uploadedFile, murmuraba, onProcessedAudio, isProcessing]);

  if (error) return <div className="text-red-500">{error}</div>;
  if (isProcessing) return <div>Processing audio...</div>;
  
  return null;
}