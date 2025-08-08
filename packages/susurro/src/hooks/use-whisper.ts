import { useCallback, useEffect, useRef, useState } from 'react';
import { pipeline, env } from '@xenova/transformers';

interface WhisperOptions {
  model?: string; // e.g. 'whisper-tiny'
  language?: string; // e.g. 'es'
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
    quantized = true, // runtime-friendly
  } = options;

  // —— Remote models + browser cache (IndexedDB) ——
  env.allowLocalModels = false; // queremos descarga remota
  env.useBrowserCache = true; // cachea todo en IndexedDB
  // Opcional: env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency ?? 4;

  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipelineRef = useRef<any>(null);
  const isInitializingRef = useRef(false);

  const initializePipeline = useCallback(async () => {
    if (isInitializingRef.current || isReady) return;

    isInitializingRef.current = true;
    setIsLoading(true);
    setError(null);
    setProgress(0);

    try {
      pipelineRef.current = await pipeline('automatic-speech-recognition', `Xenova/${model}`, {
        quantized,
        // Nada de local_files_only ni nombres forzados.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        progress_callback: (p: any) => {
          if (typeof p.progress === 'number') setProgress(Math.round(p.progress * 100));
        },
      });

      setIsReady(true);
      setIsLoading(false);
      setProgress(100);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err?.message ?? 'Failed to initialize pipeline');
      setIsLoading(false);
      setIsReady(false);
    }
    isInitializingRef.current = false;
  }, [model, quantized, isReady]);

  async function resampleTo16k(input: AudioBuffer): Promise<Float32Array> {
    if (input.sampleRate === 16000) return input.getChannelData(0).slice();
    const length = Math.ceil(input.duration * 16000);
    const offline = new OfflineAudioContext(1, length, 16000);
    const buf = offline.createBuffer(1, input.length, input.sampleRate);
    buf.copyToChannel(input.getChannelData(0), 0);
    const src = offline.createBufferSource();
    src.buffer = buf;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  }

  const transcribe = useCallback(
    async (audio: Blob | Float32Array): Promise<TranscriptionResult | null> => {
      if (!pipelineRef.current || !isReady) throw new Error('Whisper model not ready');

      try {
        let array: Float32Array;
        const rate = 16000;

        if (audio instanceof Blob) {
          const ab = await audio.arrayBuffer();
          const ctx = new AudioContext();
          const decoded = await ctx.decodeAudioData(ab);
          array = await resampleTo16k(decoded);
          ctx.close();
        } else {
          array = audio; // asume ya 16k
        }

        const output = await pipelineRef.current(
          { array, sampling_rate: rate },
          {
            language,
            task: 'transcribe',
            return_timestamps: true,
            chunk_length_s: 30,
            stride_length_s: 5,
          }
        );

        return { text: output.text ?? '', chunks: output.chunks ?? [] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        throw new Error(err?.message ?? 'Transcription failed');
      }
    },
    [isReady, language]
  );

  useEffect(() => {
    initializePipeline();
    return () => {
      pipelineRef.current = null;
      setIsReady(false);
      setIsLoading(false);
      setProgress(0);
    };
  }, [initializePipeline]);

  return { isLoading, isReady, progress, error, transcribe };
}
