import { useCallback, useEffect, useRef, useState } from 'react';

interface WhisperOptions {
  model?: string;
  language?: string;
}

interface TranscriptionResult {
  text: string;
  chunks?: Array<{
    text: string;
    timestamp: [number, number];
  }>;
}

interface UseWhisperReturn {
  isLoading: boolean;
  isReady: boolean;
  progress: number;
  error: string | null;
  transcribe: (audio: Blob | Float32Array) => Promise<TranscriptionResult | null>;
}

export function useWhisper(options: WhisperOptions = {}): UseWhisperReturn {
  const { model = 'Xenova/whisper-tiny' } = options;
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Worker ref
  const workerRef = useRef<Worker | null>(null);
  const isInitializingRef = useRef(false);
  
  // Initialize worker and load model
  const initializeWorker = useCallback(async () => {
    if (isInitializingRef.current || isReady) {
      return;
    }
    
    isInitializingRef.current = true;
    setIsLoading(true);
    setError(null);
    setProgress(0);
    
    try {
      // Create worker
      workerRef.current = new Worker(
        new URL('../workers/whisper.worker.js', import.meta.url),
        { type: 'module' }
      );
      
      // Set up worker message handler
      workerRef.current.onmessage = (event) => {
        const { status, progress: workerProgress, error: workerError } = event.data;
        
        if (status === 'ready') {
          setIsReady(true);
          setIsLoading(false);
          setProgress(100);
        } else if (status === 'error') {
          setError(workerError || 'Worker error occurred');
          setIsLoading(false);
          setIsReady(false);
        } else if (workerProgress !== undefined) {
          setProgress(Math.round(workerProgress * 100));
        }
      };
      
      workerRef.current.onerror = () => {
        setError('Worker failed to load');
        setIsLoading(false);
        setIsReady(false);
      };
      
      // Start loading the model
      workerRef.current.postMessage({
        type: 'load',
        model: model
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize worker';
      setError(errorMessage);
      setIsLoading(false);
      setIsReady(false);
    }
    
    isInitializingRef.current = false;
  }, [model, isReady]);
  
  // Transcribe function
  const transcribe = useCallback(async (audio: Blob | Float32Array): Promise<TranscriptionResult | null> => {
    if (!workerRef.current || !isReady) {
      throw new Error('Whisper model not ready');
    }
    
    try {
      // Convert audio to the format expected by the worker
      let audioData: Float32Array;
      
      if (audio instanceof Blob) {
        // Convert blob to Float32Array
        const arrayBuffer = await audio.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioData = audioBuffer.getChannelData(0); // Get first channel
        audioContext.close();
      } else {
        audioData = audio;
      }
      
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not available'));
          return;
        }
        
        const messageHandler = (event: MessageEvent) => {
          const { status, text, chunks, error: workerError } = event.data;
          
          if (status === 'complete') {
            workerRef.current?.removeEventListener('message', messageHandler);
            resolve({
              text: text || '',
              chunks: chunks || []
            });
          } else if (status === 'error') {
            workerRef.current?.removeEventListener('message', messageHandler);
            reject(new Error(workerError || 'Transcription failed'));
          }
        };
        
        workerRef.current.addEventListener('message', messageHandler);
        
        // Send transcription request
        workerRef.current.postMessage({
          type: 'transcribe',
          audio: audioData
        });
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transcription failed';
      throw new Error(errorMessage);
    }
  }, [isReady]);
  
  // Initialize on mount
  useEffect(() => {
    initializeWorker();
    
    // Cleanup on unmount
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      setIsReady(false);
      setIsLoading(false);
      setProgress(0);
    };
  }, [initializeWorker]);
  
  return {
    isLoading,
    isReady,
    progress,
    error,
    transcribe
  };
}