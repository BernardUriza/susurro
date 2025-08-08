import { useCallback, useEffect, useRef, useState } from 'react';
import { pipeline, env } from '@xenova/transformers';

// Configuración simple que FUNCIONA (basada en vanilla)
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.logLevel = 'error';

interface WhisperOptions {
  model?: string;
  language?: string;
  quantized?: boolean;
}

interface TranscriptionResult {
  text: string;
  chunks?: Array<{ text: string; timestamp: [number, number] }>;
}

interface UseWhisperReturn {
  isLoading: boolean;
  isReady: boolean;
  progress: number;
  error: string | null;
  transcribe: (audio: Blob | Float32Array) => Promise<TranscriptionResult | null>;
}

export function useWhisper(options: WhisperOptions = {}): UseWhisperReturn {
  const {
    model = 'whisper-tiny',
    language = 'es',
    quantized = true,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const pipelineRef = useRef<unknown>(null);
  const initStarted = useRef(false);

  useEffect(() => {
    // Solo inicializar una vez
    if (initStarted.current) return;
    initStarted.current = true;

    const initPipeline = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const modelName = `Xenova/${model}`;
        
        pipelineRef.current = await pipeline(
          'automatic-speech-recognition',
          modelName,
          {
            quantized,
            progress_callback: (p: { progress?: number }) => {
              if (p.progress) {
                const percent = Math.round(p.progress * 100);
                setProgress(percent);
              }
            }
          }
        );
        
        setIsReady(true);
        setProgress(100);
      } catch (err: unknown) {
        setError(err.message || 'Failed to load model');
      } finally {
        setIsLoading(false);
      }
    };

    initPipeline();
  }, [model, quantized]); // Include dependencies

  const transcribe = useCallback(async (audio: Blob | Float32Array): Promise<TranscriptionResult | null> => {
    if (!pipelineRef.current || !isReady) {
      return null;
    }

    try {
      let audioInput: string;
      
      if (audio instanceof Float32Array) {
        // Convertir Float32Array a Blob WAV
        const blob = float32ArrayToWav(audio, 16000);
        audioInput = URL.createObjectURL(blob);
      } else {
        // Blob directo
        audioInput = URL.createObjectURL(audio);
      }
      
      const output = await pipelineRef.current(audioInput, {
        language,
        task: 'transcribe',
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
      });
      
      URL.revokeObjectURL(audioInput);
      
      return { 
        text: output.text || '',
        chunks: output.chunks || []
      };
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
      return null;
    }
  }, [isReady, language]);

  return {
    isLoading,
    isReady,
    progress,
    error,
    transcribe
  };
}

// Función auxiliar para convertir Float32Array a WAV
function float32ArrayToWav(float32Array: Float32Array, sampleRate: number): Blob {
  const length = float32Array.length;
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);
  
  // Convert float32 to int16
  const offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset + i * 2, sample * 0x7FFF, true);
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}