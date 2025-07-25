'use client';

import { useState, useEffect, useRef } from 'react';

interface AudioProcessorProps {
  onProcessedAudio: (audioBlob: Blob) => void;
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
        const { processFile } = murmuraba;
        const result = await processFile(uploadedFile, {
          outputFormat: 'blob',
          enableTranscription: false
        });
        
        if (result.processedAudio) {
          processedFileRef.current = fileId;
          onProcessedAudio(result.processedAudio);
        }
      } catch (err) {
        setError('Processing failed');
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