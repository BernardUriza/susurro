// useSusurro.ts — lean & mean: MediaRecorder 100% en murmuraba

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMurmubaraEngine } from 'murmuraba';
import { ChunkMiddlewarePipeline } from '../lib/chunk-middleware';
import { useLatencyMonitor } from './use-latency-monitor';
import { DeepgramBackend } from '../lib/backend-deepgram';

import type {
  AudioChunk,
  ProcessingStatus,
  TranscriptionResult,
  SusurroChunk,
  UseSusurroOptions as BaseUseSusurroOptions,
  CompleteAudioResult,
  StreamingSusurroChunk,
  RecordingConfig,
  AudioMetadata,
} from '../lib/types';

// —— Whisper thin wrapper (runtime download, 16k resample) ——
const WHISPER_ENV = {
  useBrowserCache: true,
  logLevel: 'error' as const,
} as const;

// Singleton cache for ASR pipelines to prevent multiple loads
const ASR_PIPELINE_CACHE = new Map<string, CallableFunction>();

// Retry configuration for model loading
const RETRY_CONFIG = {
  maxAttempts: 3,
  delayMs: 2000,
  backoffMultiplier: 1.5,
} as const;

async function ensureASR(model: string, quantized: boolean, onProgress: (p: number) => void) {
  // Create cache key based on model and quantization
  const cacheKey = `${model}_${quantized ? 'q8' : 'fp32'}`;

  // Check if pipeline already exists in cache
  const cachedPipeline = ASR_PIPELINE_CACHE.get(cacheKey);
  if (cachedPipeline) {
    console.log(`[ensureASR] Using cached pipeline for ${cacheKey}`);
    onProgress(100); // Immediately complete since it's cached
    return cachedPipeline;
  }

  console.log(`[ensureASR] Creating new pipeline for ${cacheKey}`);

  // Retry logic with exponential backoff
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      console.log(`[ensureASR] Attempt ${attempt}/${RETRY_CONFIG.maxAttempts} to load model...`);

      // Import @huggingface/transformers v3
      const transformersModule = await import('@huggingface/transformers');

      // Extract what we need
      const { pipeline, env } = transformersModule;

      // Configure transformers v3 environment
      if (env) {
        env.useBrowserCache = WHISPER_ENV.useBrowserCache;
        // v3 uses allowRemoteModels (default true)
        env.allowRemoteModels = true;
        // Clear any stale cache on retry attempts
        if (attempt > 1) {
          console.log(`[ensureASR] Clearing browser cache for retry attempt ${attempt}`);
          env.useBrowserCache = false;
        }
      }

      // Use Xenova ONNX models that work with v3
      // Remove .en suffix to ensure multilingual support (needed for Spanish)
      const modelName = `Xenova/${model.replace('.en', '')}`;
      console.log(`[ensureASR] Loading model: ${modelName}`);

      // Create pipeline with v3 API
      const asr = await pipeline('automatic-speech-recognition', modelName, {
        // v3 uses dtype instead of quantized
        dtype: quantized ? 'q8' : 'fp32',
        // Optional: use WebGPU if available (requires COEP/COOP headers)
        // device: 'webgpu',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        progress_callback: (p: any) => {
          // v3 has different progress info structure
          if (p?.progress !== undefined) {
            const percent = p.progress <= 1 ? Math.round(p.progress * 100) : Math.round(p.progress);
            // Adjust progress for retry attempts
            const adjustedPercent =
              attempt > 1
                ? Math.min(100, Math.max(0, percent * 0.9 + (attempt - 1) * 10))
                : percent;
            onProgress(Math.min(100, Math.max(0, adjustedPercent)));
          } else if (p?.status) {
            // Log status updates
            console.log(`[ensureASR] Status: ${p.status}`);
          }
        },
      });

      // Store in cache for future use
      ASR_PIPELINE_CACHE.set(cacheKey, asr);
      console.log(`[ensureASR] Pipeline cached for ${cacheKey} after ${attempt} attempt(s)`);

      return asr;
    } catch (error) {
      lastError = error as Error;
      console.error(`[ensureASR] Attempt ${attempt} failed:`, error);

      // Check if error is related to JSON parsing (network/CORS issues)
      if (error instanceof Error) {
        if (error.message.includes('Unexpected token') || error.message.includes('JSON')) {
          console.error(`[ensureASR] Network/CORS error detected. The model server might be:
          1. Temporarily unavailable (503 error)
          2. Blocked by CORS policy
          3. Returning HTML instead of model files
          Please check network tab for actual response.`);
        }
      }

      // If not the last attempt, wait before retrying
      if (attempt < RETRY_CONFIG.maxAttempts) {
        const delay = RETRY_CONFIG.delayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
        console.log(`[ensureASR] Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All attempts failed
  const errorMessage = `Failed to load Whisper model after ${RETRY_CONFIG.maxAttempts} attempts. ${
    lastError?.message.includes('JSON')
      ? 'Network or CORS error: The server returned non-JSON content.'
      : ''
  } Last error: ${lastError?.message}`;

  throw new Error(errorMessage);
}

async function resampleTo16k(buffer: AudioBuffer): Promise<Float32Array> {
  if (buffer.sampleRate === 16000) return buffer.getChannelData(0).slice();
  const length = Math.ceil(buffer.duration * 16000);
  const offline = new OfflineAudioContext(1, length, 16000);
  const mono = offline.createBuffer(1, buffer.length, buffer.sampleRate);
  mono.copyToChannel(buffer.getChannelData(0), 0);
  const src = offline.createBufferSource();
  src.buffer = mono;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

async function transcribeBlobWith(asr: CallableFunction, blob: Blob, language: string) {
  const ab = await blob.arrayBuffer();
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(ab);
  const audioData = await resampleTo16k(decoded);
  ctx.close();

  // Ensure we have a Float32Array
  const audioArray = audioData instanceof Float32Array ? audioData : new Float32Array(audioData);

  console.log(
    '[transcribeBlobWith] Audio array type:',
    audioArray.constructor.name,
    'Length:',
    audioArray.length
  );

  // Whisper expects the audio directly as the first parameter
  // Build options based on what the model supports
  const options: {
    return_timestamps: boolean;
    chunk_length_s: number;
    stride_length_s: number;
    language?: string;
    task?: string;
  } = {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  };

  // Try with language/task first, if it fails, retry without them
  try {
    // First attempt with language and task (for multilingual models)
    const out = await asr(audioArray, {
      ...options,
      language: language || 'es', // Default to Spanish
      task: 'transcribe',
    });
    console.log('[transcribeBlobWith] Transcription successful with language:', language || 'es');
    return processTranscriptionResult(out);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('[transcribeBlobWith] First attempt failed:', errorMessage);

    // If error mentions English-only model, retry without language/task
    if (errorMessage?.includes('English-only') || errorMessage?.includes('Cannot specify')) {
      console.log('[transcribeBlobWith] Retrying for English-only model...');
      const out = await asr(audioArray, options);
      return processTranscriptionResult(out);
    }

    // If it's a different error, throw it
    throw error;
  }
}

function processTranscriptionResult(out: {
  text?: string;
  chunks?: Array<{ timestamp?: [number, number]; text?: string }>;
}): TranscriptionResult {
  const result: TranscriptionResult = {
    text: out?.text ?? '',
    chunkIndex: 0,
    timestamp: Date.now(),
    segments:
      out?.chunks?.map((c: { timestamp?: [number, number]; text?: string }, index: number) => ({
        id: index,
        seek: c.timestamp?.[0] ?? 0,
        start: c.timestamp?.[0] ?? 0,
        end: c.timestamp?.[1] ?? 0,
        text: c.text ?? '',
        tokens: [],
        temperature: 0,
        avg_logprob: 0,
        compression_ratio: 0,
        no_speech_prob: 0,
      })) ?? [],
  };
  return result;
}

async function urlToBlob(url?: string): Promise<Blob> {
  if (!url) return new Blob();
  const r = await fetch(url);
  return r.blob();
}

// —— Public API ——
export interface UseSusurroOptions extends BaseUseSusurroOptions {
  onWhisperProgressLog?: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
  initialModel?: 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'deepgram';
  engineConfig?: {
    bufferSize?: number;
    denoiseStrength?: number;
    enableMetrics?: boolean;
    noiseReductionLevel?: 'low' | 'medium' | 'high';
    algorithm?: 'rnnoise';
  };
  deepgramConfig?: {
    backendUrl?: string;
  };
}

export interface UseSusurroReturn {
  isRecording: boolean;
  isProcessing: boolean;
  transcriptions: TranscriptionResult[];
  audioChunks: AudioChunk[];
  processingStatus: ProcessingStatus;
  averageVad: number;
  startRecording: (config?: RecordingConfig) => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearTranscriptions: () => void;

  whisperReady: boolean;
  whisperProgress: number;
  whisperError: Error | string | null;
  transcribeWithWhisper: (blob: Blob) => Promise<TranscriptionResult | null>;

  exportChunkAsWav: (chunkId: string) => Promise<Blob>;

  conversationalChunks: SusurroChunk[];
  clearConversationalChunks: () => void;

  middlewarePipeline: ChunkMiddlewarePipeline;

  latencyReport: ReturnType<typeof useLatencyMonitor>['latencyReport'];
  latencyStatus: ReturnType<typeof useLatencyMonitor>['latencyStatus'];

  initializeAudioEngine: () => Promise<void>;
  resetAudioEngine: () => Promise<void>;
  isEngineInitialized: boolean;
  engineError: string | null;
  isInitializingEngine: boolean;

  processAndTranscribeFile: (file: File) => Promise<CompleteAudioResult>;

  startStreamingRecording: (
    onChunk: (chunk: StreamingSusurroChunk) => void,
    config?: RecordingConfig
  ) => Promise<void>;
  stopStreamingRecording: () => Promise<StreamingSusurroChunk[]>;

  analyzeVAD: (buffer: ArrayBuffer) => Promise<{
    averageVad: number;
    vadScores: number[];
    metrics: unknown[];
    voiceSegments: Array<{
      startTime: number;
      endTime: number;
      vadScore: number;
      confidence: number;
    }>;
  }>;
  convertBlobToBuffer: (blob: Blob) => Promise<ArrayBuffer>;

  currentStream: MediaStream | null; // exposed from murmuraba
}

// —— Hook ——
export function useSusurro(options: UseSusurroOptions = {}): UseSusurroReturn {
  const {
    chunkDurationMs = 8000,
    whisperConfig = {},
    conversational,
    onWhisperProgressLog,
  } = options;

  // — Murmuraba Engine: Direct integration with official hook —
  const murmubaraConfig = {
    bufferSize: (options.engineConfig?.bufferSize ?? 1024) as 256 | 512 | 1024 | 2048 | 4096,
    denoiseStrength: options.engineConfig?.denoiseStrength ?? 0.5,
    enableMetrics: options.engineConfig?.enableMetrics ?? true,
    noiseReductionLevel: options.engineConfig?.noiseReductionLevel ?? 'medium',
    algorithm: options.engineConfig?.algorithm ?? 'rnnoise',
    chunkDurationMs: chunkDurationMs,
    autoCleanup: true,
    useAudioWorklet: true,
    logLevel: 'error' as const, // Changed from 'info' to 'error' to reduce logs
    enableDebugLogs: false, // Explicitly disable debug logs
  };

  const {
    isInitialized: engineReady,
    error: engineError,
    recordingState,
    currentStream: engineStream,
    startRecording: murmubaraStartRecording,
    stopRecording: murmubaraStopRecording,
    pauseRecording: murmurbaraPauseRecording,
    resumeRecording: murmubaraResumeRecording,
    exportChunkAsWav: murmubaraExportChunkAsWav,
    initialize: murmubaraInitializeEngine,
    destroy: murmubaraDestroyEngine,
  } = useMurmubaraEngine(murmubaraConfig);

  // Derive isInitializing from engine state
  const [engineInitializing, setEngineInitializing] = useState(false);

  // — Whisper state —
  const [whisperReady, setWhisperReady] = useState(false);
  const [whisperProgress, setWhisperProgress] = useState(0);
  const [whisperError, setWhisperError] = useState<Error | string | null>(null);
  const asrRef = useRef<CallableFunction | null>(null);
  const deepgramBackendRef = useRef<DeepgramBackend | null>(null);

  // Use Xenova ONNX multilingual models for Spanish support
  // Removed .en suffix to support multiple languages including Spanish
  const modelMap: Record<string, string> = {
    tiny: 'whisper-tiny',
    base: 'whisper-base',
    medium: 'whisper-medium',
    small: 'whisper-small',
    large: 'whisper-large-v3',
    deepgram: 'deepgram', // Special marker for Deepgram backend
  };
  const selectedModel = options.initialModel || 'tiny';
  const isDeepgram = selectedModel === 'deepgram';
  const whisperModel = modelMap[selectedModel] || 'whisper-tiny';
  const whisperLanguage = whisperConfig?.language || 'es'; // Default to Spanish
  const whisperQuantized = true;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Log initial state

        if (isDeepgram) {
          // Initialize Deepgram backend
          if (onWhisperProgressLog) {
            onWhisperProgressLog('🌐 Conectando con Deepgram API...', 'info');
          }

          const backend = new DeepgramBackend(options.deepgramConfig || {});
          deepgramBackendRef.current = backend;

          // Mark as ready for Deepgram
          setWhisperProgress(100);
          setWhisperReady(true);

          if (onWhisperProgressLog) {
            onWhisperProgressLog('✅ Deepgram API conectado correctamente', 'success');
            onWhisperProgressLog('🎙️ Sistema de transcripción Deepgram listo', 'success');
          }
        } else {
          // Original Whisper logic
          const asr = await ensureASR(whisperModel, whisperQuantized, (p: number) => {
            setWhisperProgress(p);
            if (onWhisperProgressLog) {
              if (p === 100) {
                onWhisperProgressLog(
                  `✅ Modelo Whisper ${whisperModel} cargado correctamente`,
                  'success'
                );
                onWhisperProgressLog('🎙️ Sistema de transcripción listo para usar', 'success');
              } else if (p === 0) {
                onWhisperProgressLog(`📥 Iniciando descarga del modelo ${whisperModel}...`, 'info');
              } else if (p > 0 && p < 25) {
                onWhisperProgressLog(`📥 Descargando modelo Whisper... ${p}%`, 'info');
              } else if (p >= 25 && p < 50) {
                onWhisperProgressLog(`⚙️ Procesando modelo de IA... ${p}%`, 'info');
              } else if (p >= 50 && p < 75) {
                onWhisperProgressLog(`🔧 Configurando neural network... ${p}%`, 'info');
              } else if (p >= 75 && p < 100) {
                onWhisperProgressLog(`🚀 Finalizando inicialización... ${p}%`, 'info');
              }
            }
          });
          if (!cancelled) {
            asrRef.current = asr;
            setWhisperReady(true);
          }
        }
      } catch (e) {
        if (!cancelled) {
          const errorMessage = (e as Error)?.message ?? 'Failed to load Whisper';

          setWhisperError(errorMessage);
          onWhisperProgressLog?.(`❌ Error al cargar Whisper: ${errorMessage}`, 'error');
        }
      }
    })();
    return () => {
      cancelled = true;
      asrRef.current = null;
      setWhisperReady(false);
      setWhisperProgress(0);

      // Clean up Deepgram backend if it exists
      if (deepgramBackendRef.current) {
        deepgramBackendRef.current.disconnect();
        deepgramBackendRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whisperModel]);

  // — App state —
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([]);
  const [transcriptions, setTranscriptions] = useState<TranscriptionResult[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    currentChunk: 0,
    totalChunks: 0,
    stage: 'idle',
  });
  const [averageVad, setAverageVad] = useState(0);

  const [conversationalChunks, setConversationalChunks] = useState<SusurroChunk[]>([]);
  const processedAudioUrls = useRef(new Map<string, string>());
  const chunkTranscriptions = useRef(new Map<string, string>());
  const chunkProcessingTimes = useRef(new Map<string, number>());

  // Engine state is now managed by AudioEngineManager - no local state needed
  const [isStreamingRecording, setIsStreamingRecording] = useState(false);
  const streamingCallbackRef = useRef<((c: StreamingSusurroChunk) => void) | null>(null);
  const streamingSessionRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const lastProcessedChunkIndexRef = useRef(0);

  const { latencyReport, latencyStatus, recordMetrics } = useLatencyMonitor(300);

  const [middlewarePipeline] = useState(() => new ChunkMiddlewarePipeline());

  // — Engine init/reset — Now using Murmuraba directly
  const initializeAudioEngine = useCallback(async () => {
    if (engineReady || engineInitializing) return;
    setEngineInitializing(true);
    try {
      await murmubaraInitializeEngine();
    } finally {
      setEngineInitializing(false);
    }
  }, [engineReady, engineInitializing, murmubaraInitializeEngine]);

  // Move clearConversationalChunks declaration before resetAudioEngine
  const clearConversationalChunks = useCallback(() => {
    setConversationalChunks([]);
    processedAudioUrls.current.clear();
    chunkTranscriptions.current.clear();
    chunkProcessingTimes.current.clear();
  }, []);

  const resetAudioEngine = useCallback(async () => {
    // Stop any ongoing recordings first
    if (recordingState?.isRecording) {
      murmubaraStopRecording();
    }

    if (streamingSessionRef.current) {
      await streamingSessionRef.current.stop();
      streamingSessionRef.current = null;
    }
    setIsStreamingRecording(false);
    streamingCallbackRef.current = null;

    setAudioChunks([]);
    setTranscriptions([]);
    clearConversationalChunks();

    // Proper engine reset through Murmuraba
    await murmubaraDestroyEngine();
    setEngineInitializing(true);
    try {
      await murmubaraInitializeEngine();
    } finally {
      setEngineInitializing(false);
    }
  }, [
    recordingState,
    murmubaraStopRecording,
    murmubaraDestroyEngine,
    murmubaraInitializeEngine,
    clearConversationalChunks,
  ]);

  // Engine state synchronization is now handled by AudioEngineManager - no manual sync needed

  // — Recording controls (using Murmuraba directly) —
  const startRecording = useCallback(
    async (config?: RecordingConfig) => {
      // Ensure engine is ready
      if (!engineReady) {
        await initializeAudioEngine();
      }

      const seconds = (config?.chunkDuration ?? chunkDurationMs / 1000) | 0;
      await murmubaraStartRecording(seconds);
    },
    [engineReady, initializeAudioEngine, murmubaraStartRecording, chunkDurationMs]
  );

  const stopRecording = useCallback(() => {
    murmubaraStopRecording();
  }, [murmubaraStopRecording]);

  const pauseRecording = useCallback(() => {
    murmurbaraPauseRecording();
  }, [murmurbaraPauseRecording]);

  const resumeRecording = useCallback(() => {
    murmubaraResumeRecording();
  }, [murmubaraResumeRecording]);

  const clearTranscriptions = useCallback(() => {
    setTranscriptions([]);
    setAudioChunks([]);
    chunkTranscriptions.current.clear();
    processedAudioUrls.current.clear();
    chunkProcessingTimes.current.clear();
    setConversationalChunks([]);
  }, []);

  // — RNNoise processing for audio blobs —
  const processAudioBlobWithRNNoise = useCallback(
    async (blob: Blob): Promise<Blob> => {
      try {
        // Convert blob to ArrayBuffer
        const arrayBuffer = await blob.arrayBuffer();

        // Load Murmuraba processing utilities
        const { loadMurmubaraProcessing } = await import('../lib/dynamic-loaders');
        const {
          processFileWithMetrics,
          getEngineStatus,
          initializeAudioEngine: initProc,
        } = await loadMurmubaraProcessing();

        // Ensure processing engine is initialized
        try {
          const status = getEngineStatus?.() ?? 'uninitialized';
          if (status === 'uninitialized' && initProc) {
            await initProc({
              noiseReductionLevel: options.engineConfig?.noiseReductionLevel ?? 'medium',
              bufferSize: (options.engineConfig?.bufferSize ?? 2048) as
                | 256
                | 512
                | 1024
                | 2048
                | 4096,
              algorithm: 'rnnoise',
              denoiseStrength: options.engineConfig?.denoiseStrength ?? 0.5,
              logLevel: 'error',
              autoCleanup: true,
              useAudioWorklet: true,
            });
          }
        } catch (initError) {
          console.warn('[RNNoise] Engine initialization warning:', initError);
          // Continue without RNNoise if initialization fails
        }

        // Process audio with RNNoise
        const processed = await processFileWithMetrics(arrayBuffer, () => {});

        // Convert processed buffer back to Blob
        const processedBlob = new Blob([processed.processedBuffer], { type: 'audio/wav' });

        console.log(
          '[RNNoise] Audio processed:',
          `${blob.size} → ${processedBlob.size} bytes`,
          `(${((processedBlob.size / blob.size) * 100).toFixed(1)}%)`
        );

        return processedBlob;
      } catch (error) {
        console.error('[RNNoise] Processing error, using original audio:', error);
        // Fallback to original blob if processing fails
        return blob;
      }
    },
    [options.engineConfig]
  );

  // — Whisper/Deepgram transcription call —
  const transcribeWithWhisper = useCallback(
    async (blob: Blob): Promise<TranscriptionResult | null> => {
      if (!whisperReady) return null;

      const t0 = performance.now();
      let out: TranscriptionResult | null = null;

      if (isDeepgram && deepgramBackendRef.current) {
        // Use Deepgram backend with RNNoise preprocessing
        try {
          // Apply RNNoise processing to blob before sending to Deepgram
          const processedBlob = await processAudioBlobWithRNNoise(blob);

          const result = await deepgramBackendRef.current.transcribeChunk(processedBlob);
          out = {
            text: result.transcript || '',
            chunkIndex: 0,
            timestamp: Date.now(),
            segments: [],
            confidence: result.confidence || 0,
          };
        } catch (error) {
          console.error('[Deepgram] Transcription error:', error);
          return null;
        }
      } else if (asrRef.current) {
        // Use local Whisper model
        out = await transcribeBlobWith(asrRef.current, blob, whisperLanguage);
      }

      // latency metrics (best-effort)
      recordMetrics({
        chunkId: 'file',
        audioToEmitLatency: performance.now() - t0,
        audioProcessingLatency: 0,
        transcriptionLatency: performance.now() - t0,
        middlewareLatency: 0,
        vadScore: 0,
        audioSize: blob.size,
      });
      return out;
    },
    [whisperReady, whisperLanguage, recordMetrics, isDeepgram, processAudioBlobWithRNNoise]
  );

  // — VAD / metadata vía murmuraba processing helpers —
  const analyzeVAD = useCallback(async (buffer: ArrayBuffer) => {
    try {
      const { loadMurmubaraProcessing } = await import('../lib/dynamic-loaders');
      const { murmubaraVAD } = await loadMurmubaraProcessing();

      if (!murmubaraVAD) {
        console.warn('murmubaraVAD function not available in murmuraba module');
        return { averageVad: 0, vadScores: [], metrics: [], voiceSegments: [] };
      }

      // Log for debugging
      console.log('[analyzeVAD] Buffer type:', buffer.constructor.name, 'Size:', buffer.byteLength);
      console.log('[analyzeVAD] murmubaraVAD type:', typeof murmubaraVAD);

      const r = await murmubaraVAD(buffer);

      console.log('[analyzeVAD] Result type:', typeof r, 'Keys:', r ? Object.keys(r) : 'null');

      return {
        averageVad: r.average || 0,
        vadScores: r.scores || [],
        metrics: r.metrics || [],
        voiceSegments: (r.voiceSegments || []).map(
          (s: {
            startTime?: number;
            endTime?: number;
            vadScore?: number;
            confidence?: number;
          }) => ({
            startTime: s.startTime || 0,
            endTime: s.endTime || 0,
            vadScore: s.vadScore || 0,
            confidence: s.confidence || 0,
          })
        ),
      };
    } catch (error) {
      console.error('VAD analysis failed:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      return { averageVad: 0, vadScores: [], metrics: [], voiceSegments: [] };
    }
  }, []);

  const convertBlobToBuffer = useCallback((blob: Blob) => blob.arrayBuffer(), []);

  const calculateDuration = useCallback(async (buffer: ArrayBuffer): Promise<number> => {
    try {
      const { loadMurmubaraProcessing } = await import('../lib/dynamic-loaders');
      const { extractAudioMetadata } = await loadMurmubaraProcessing();
      const metadata = extractAudioMetadata(buffer);
      return metadata.duration;
    } catch {
      const bytes = buffer.byteLength;
      return Math.max(0.1, bytes / (44100 * 2 * 2));
    }
  }, []);

  // — Streaming API (callback por chunk) —
  const startStreamingRecording = useCallback(
    async (onChunk: (chunk: StreamingSusurroChunk) => void, config?: RecordingConfig) => {
      if (isStreamingRecording) throw new Error('Already recording. Stop first.');

      // Ensure engine is ready
      if (!engineReady) {
        await initializeAudioEngine();
      }

      setIsStreamingRecording(true);
      streamingCallbackRef.current = onChunk;
      lastProcessedChunkIndexRef.current = recordingState?.chunks?.length ?? 0;

      // Clear previous streaming chunks
      streamingChunksRef.current = [];

      const seconds = (config?.chunkDuration ?? chunkDurationMs / 1000) | 0;

      // Start recording with Murmuraba
      await murmubaraStartRecording(seconds);

      // Set up cleanup session
      streamingSessionRef.current = {
        stop: async () => {
          murmubaraStopRecording();
          setIsStreamingRecording(false);
          streamingCallbackRef.current = null;
        },
      };
    },
    [
      isStreamingRecording,
      engineReady,
      initializeAudioEngine,
      murmubaraStartRecording,
      murmubaraStopRecording,
      chunkDurationMs,
      recordingState?.chunks?.length,
    ]
  );

  // Track streaming chunks separately
  const streamingChunksRef = useRef<StreamingSusurroChunk[]>([]);

  const stopStreamingRecording = useCallback(async (): Promise<StreamingSusurroChunk[]> => {
    console.log('[stopStreamingRecording] Stopping recording...');

    if (streamingSessionRef.current) {
      await streamingSessionRef.current.stop();
      streamingSessionRef.current = null;
    }
    setIsStreamingRecording(false);
    streamingCallbackRef.current = null;

    // Return the chunks that were processed during streaming
    const chunks = [...streamingChunksRef.current];
    console.log('[stopStreamingRecording] Returning', chunks.length, 'chunks');

    // Clear for next recording session
    streamingChunksRef.current = [];
    lastProcessedChunkIndexRef.current = 0;

    return chunks;
  }, []);

  // — Observa y consume chunks de murmuraba (REACTIVO Y LIMPIO) —
  useEffect(() => {
    if (!engineReady || !recordingState?.chunks) {
      return;
    }

    const chunks = recordingState.chunks;

    // Process new chunks for regular recording
    const newOnes: AudioChunk[] = [];
    for (let i = audioChunks.length; i < chunks.length; i++) {
      const src = chunks[i];

      const id = src.id || `chunk-${Date.now()}-${i}`;
      const startTime = src.startTime ?? i * chunkDurationMs;
      const endTime = src.endTime ?? (i + 1) * chunkDurationMs;
      const vadScore = src.averageVad ?? 0;

      newOnes.push({
        id,
        blob: undefined as unknown as Blob, // lo traemos on-demand al transcribir
        startTime,
        endTime,
        vadScore,
        duration: src.duration ?? chunkDurationMs,
      });

      if (src.processedAudioUrl) {
        processedAudioUrls.current.set(id, src.processedAudioUrl);
      }
    }

    if (newOnes.length) {
      setAudioChunks((prev) => [...prev, ...newOnes]);
    }

    // promedio de VAD del último
    const last = chunks[chunks.length - 1];
    if (last?.averageVad != null) setAverageVad(last.averageVad);
  }, [engineReady, recordingState?.chunks, audioChunks.length, chunkDurationMs]);

  // — Streaming Transcription: Monitoreo reactivo separado —
  useEffect(() => {
    if (!isStreamingRecording || !streamingCallbackRef.current || !recordingState?.chunks) {
      return;
    }

    const chunks = recordingState.chunks;
    const newChunks = chunks.slice(lastProcessedChunkIndexRef.current);

    if (newChunks.length === 0) return;

    // Process new chunks for streaming
    newChunks.forEach(async (chunk, relativeIndex) => {
      const absoluteIndex = lastProcessedChunkIndexRef.current + relativeIndex;

      try {
        const audioBlob = await urlToBlob(chunk.processedAudioUrl);
        const vadScore = chunk.averageVad ?? 0;
        const isVoiceActive = vadScore > 0.3;

        let transcriptionText = '';
        if (whisperReady && isVoiceActive && audioBlob.size > 0) {
          try {
            const r = await transcribeWithWhisper(audioBlob);
            transcriptionText = r?.text ?? '';
          } catch (error) {
            console.error('[STREAMING] Transcription error:', error);
          }
        }

        const streamingChunk: StreamingSusurroChunk = {
          id: chunk.id || `chunk-${Date.now()}-${absoluteIndex}`,
          audioBlob,
          vadScore,
          timestamp: Date.now(),
          transcriptionText,
          duration: chunk.duration ?? chunkDurationMs,
          isVoiceActive,
        };

        streamingChunksRef.current.push(streamingChunk);
        streamingCallbackRef.current?.(streamingChunk);
      } catch (error) {
        console.error('[STREAMING] Error processing chunk:', error);
      }
    });

    lastProcessedChunkIndexRef.current = chunks.length;
  }, [
    recordingState?.chunks,
    isStreamingRecording,
    whisperReady,
    transcribeWithWhisper,
    chunkDurationMs,
  ]);

  // — Conversational emit: cuando audio + transcripción están listos —
  const tryEmitChunk = useCallback(
    async (chunk: AudioChunk, forceEmit = false) => {
      if (!conversational?.onChunk) return;

      const audioUrl = processedAudioUrls.current.get(chunk.id);
      const transcript = chunkTranscriptions.current.get(chunk.id);
      const t0 = chunkProcessingTimes.current.get(chunk.id);

      if (audioUrl && (transcript || forceEmit)) {
        let emitted: SusurroChunk = {
          id: chunk.id,
          audioUrl,
          transcript: transcript ?? '',
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          vadScore: chunk.vadScore ?? 0,
          isComplete: Boolean(transcript),
          processingLatency: t0 ? Date.now() - t0 : undefined,
        };

        const t1 = performance.now();
        try {
          emitted = await middlewarePipeline.process(emitted);
        } catch {
          /* ignore middleware errors */
        }
        const middlewareLatency = performance.now() - t1;

        if (emitted.processingLatency != null) {
          recordMetrics({
            chunkId: chunk.id,
            audioToEmitLatency: emitted.processingLatency,
            audioProcessingLatency: Math.max(0, emitted.processingLatency - middlewareLatency),
            transcriptionLatency: 0,
            middlewareLatency,
            vadScore: chunk.vadScore,
            audioSize: 0,
          });
        }

        setConversationalChunks((prev) => [...prev, emitted]);
        conversational.onChunk(emitted);
        chunkProcessingTimes.current.delete(chunk.id);
      }
    },
    [conversational, middlewarePipeline, recordMetrics]
  );

  // — Auto-procesa al terminar la grabación (batch) —
  const processChunks = useCallback(
    async (chunks: AudioChunk[]) => {
      if (!chunks.length) return;
      setProcessingStatus({
        isProcessing: true,
        currentChunk: 0,
        totalChunks: chunks.length,
        stage: 'processing',
      });

      for (let i = 0; i < chunks.length; i++) {
        setProcessingStatus((p) => ({ ...p, currentChunk: i + 1 }));
        const id = chunks[i].id;
        const processedUrl = processedAudioUrls.current.get(id);
        if (!processedUrl) continue;
        try {
          const blob = await urlToBlob(processedUrl);
          const r = await transcribeWithWhisper(blob);
          if (r) {
            setTranscriptions((prev) => [...prev, { ...r, chunkIndex: i, timestamp: Date.now() }]);
            chunkTranscriptions.current.set(id, r.text);
            await tryEmitChunk(chunks[i]);
          }
        } catch {
          /* ignore chunk fail */
        }
      }

      setProcessingStatus({
        isProcessing: false,
        currentChunk: 0,
        totalChunks: 0,
        stage: 'complete',
      });
    },
    [transcribeWithWhisper, tryEmitChunk]
  );

  useEffect(() => {
    // si hay chunks y no estamos grabando → procesar batch
    if (audioChunks.length > 0 && engineReady && whisperReady) {
      const isRecording = recordingState?.isRecording ?? false;

      if (!isRecording) {
        setTimeout(() => {
          if (!conversational?.onChunk || conversational.enableInstantTranscription) {
            processChunks(audioChunks);
          }
        }, 50);
      }
    }
  }, [
    audioChunks,
    engineReady,
    whisperReady,
    recordingState?.isRecording,
    conversational,
    processChunks,
  ]);

  // — Limpieza — (already moved before resetAudioEngine)

  useEffect(() => {
    return () => {
      clearConversationalChunks();
      if (streamingSessionRef.current) {
        streamingSessionRef.current.stop().catch(() => {});
      }
    };
  }, [clearConversationalChunks]);

  // — Export chunk as WAV (using Murmuraba's export) —
  const exportChunkAsWav = useCallback(
    async (chunkId: string) => {
      if (!murmubaraExportChunkAsWav) {
        console.warn('Export chunk feature not available');
        return new Blob();
      }
      return murmubaraExportChunkAsWav(chunkId, 'processed');
    },
    [murmubaraExportChunkAsWav]
  );

  // — File pipeline end-to-end —
  const processAndTranscribeFile = useCallback(
    async (file: File): Promise<CompleteAudioResult> => {
      const t0 = performance.now();
      if (!whisperReady) throw new Error('Whisper model not ready');

      await initializeAudioEngine();

      const originalBuffer = await file.arrayBuffer();
      const originalAudioUrl = URL.createObjectURL(file);

      const { loadMurmubaraProcessing } = await import('../lib/dynamic-loaders');
      const {
        processFileWithMetrics,
        getEngineStatus,
        initializeAudioEngine: initProc,
      } = await loadMurmubaraProcessing();

      try {
        const status = getEngineStatus?.() ?? 'uninitialized';
        if (status === 'uninitialized' && initProc) {
          await initProc({
            noiseReductionLevel: 'medium',
            bufferSize: 1024,
            algorithm: 'rnnoise',
            logLevel: 'info',
            autoCleanup: true,
            useAudioWorklet: true,
          });
        }
      } catch {
        /* ignore */
      }

      const processed = await processFileWithMetrics(originalBuffer, () => {});
      const processedBlob = new Blob([processed.processedBuffer], { type: 'audio/wav' });
      const processedAudioUrl = URL.createObjectURL(processedBlob);

      const vadAnalysis = await analyzeVAD(originalBuffer);
      const tr = await transcribeWithWhisper(processedBlob);
      if (!tr) throw new Error('Transcription failed');

      const metadata: AudioMetadata = {
        duration: await calculateDuration(originalBuffer),
        sampleRate: 44100,
        channels: 2,
        fileSize: file.size,
        processedSize: processed.processedBuffer.byteLength,
      };

      return {
        originalAudioUrl,
        processedAudioUrl,
        transcriptionText: tr.text,
        transcriptionSegments: tr.segments,
        vadAnalysis,
        metadata,
        processingTime: performance.now() - t0,
      };
    },
    [whisperReady, initializeAudioEngine, analyzeVAD, transcribeWithWhisper, calculateDuration]
  );

  return {
    // Recording (managed by Murmuraba directly)
    isRecording: recordingState?.isRecording ?? false,
    isProcessing: processingStatus.isProcessing,
    transcriptions,
    audioChunks,
    processingStatus,
    averageVad,

    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearTranscriptions,

    exportChunkAsWav,

    whisperReady,
    whisperProgress,
    whisperError,
    transcribeWithWhisper,

    conversationalChunks,
    clearConversationalChunks,

    middlewarePipeline,

    latencyReport,
    latencyStatus,

    initializeAudioEngine,
    resetAudioEngine,
    isEngineInitialized: engineReady,
    engineError: engineError ? String(engineError) : null,
    isInitializingEngine: engineInitializing,

    processAndTranscribeFile,

    startStreamingRecording,
    stopStreamingRecording,

    analyzeVAD,
    convertBlobToBuffer,

    currentStream: engineStream,
  };
}
