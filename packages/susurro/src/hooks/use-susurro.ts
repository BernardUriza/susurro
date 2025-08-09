// useSusurro.ts — lean & mean: MediaRecorder 100% en murmuraba

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChunkMiddlewarePipeline } from '../lib/chunk-middleware';
import { useLatencyMonitor } from './use-latency-monitor';
import { useAudioEngineManager } from './use-audio-engine-manager';

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

async function ensureASR(model: string, quantized: boolean, onProgress: (p: number) => void) {
  try {
    // Import @huggingface/transformers v3
    const transformersModule = await import('@huggingface/transformers');

    // Extract what we need
    const { pipeline, env } = transformersModule;

    // Configure transformers v3 environment
    if (env) {
      env.useBrowserCache = WHISPER_ENV.useBrowserCache;
      // v3 uses allowRemoteModels (default true)
      env.allowRemoteModels = true;
    }

    // Use Xenova ONNX models that work with v3
    const modelName = `Xenova/${model}`;

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
          onProgress(Math.min(100, Math.max(0, percent)));
        } else if (p?.status) {
          // Log status updates
        }
      },
    });

    return asr;
  } catch (error) {
    throw error;
  }
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
  
  console.log('[transcribeBlobWith] Audio array type:', audioArray.constructor.name, 'Length:', audioArray.length);

  // Whisper expects the audio directly as the first parameter
  // Build options based on what the model supports
  const options: any = {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  };
  
  // Try with language/task first, if it fails, retry without them
  try {
    // First attempt with language and task (for multilingual models)
    const out = await asr(audioArray, {
      ...options,
      language: language || 'en',
      task: 'transcribe',
    });
    return processTranscriptionResult(out);
  } catch (error: any) {
    console.warn('[transcribeBlobWith] First attempt failed:', error?.message);
    
    // If error mentions English-only model, retry without language/task
    if (error?.message?.includes('English-only') || error?.message?.includes('Cannot specify')) {
      console.log('[transcribeBlobWith] Retrying for English-only model...');
      const out = await asr(audioArray, options);
      return processTranscriptionResult(out);
    }
    
    // If it's a different error, throw it
    throw error;
  }
}

function processTranscriptionResult(out: any): TranscriptionResult {

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
  initialModel?: 'tiny' | 'base' | 'medium';
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

  // — Audio Engine Manager: Single source of truth for Murmuraba —
  const {
    isReady: engineReady,
    isInitializing: engineInitializing,
    hasError: engineHasError,
    initialize: initializeEngine,
    reset: resetEngine,
    getEngine,
    currentStream: engineStream,
  } = useAudioEngineManager();

  // — Whisper state —
  const [whisperReady, setWhisperReady] = useState(false);
  const [whisperProgress, setWhisperProgress] = useState(0);
  const [whisperError, setWhisperError] = useState<Error | string | null>(null);
  const asrRef = useRef<CallableFunction | null>(null);

  // Use Xenova ONNX models compatible with v3
  // Using English models that are known to work
  const modelMap: Record<string, string> = {
    tiny: 'whisper-tiny.en',
    base: 'whisper-base.en',
    medium: 'whisper-medium.en',
  };
  const whisperModel = modelMap[options.initialModel || 'tiny'] || 'whisper-tiny.en';
  const whisperLanguage = whisperConfig?.language || 'en';
  const whisperQuantized = true;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Log initial state

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

  // — Engine init/reset — Now delegated to AudioEngineManager
  const initializeAudioEngine = useCallback(async () => {
    if (engineReady || engineInitializing) return;
    await initializeEngine();
  }, [engineReady, engineInitializing, initializeEngine]);

  // Move clearConversationalChunks declaration before resetAudioEngine
  const clearConversationalChunks = useCallback(() => {
    setConversationalChunks([]);
    processedAudioUrls.current.clear();
    chunkTranscriptions.current.clear();
    chunkProcessingTimes.current.clear();
  }, []);

  const resetAudioEngine = useCallback(async () => {
    // Stop any ongoing recordings first
    try {
      const engine = getEngine();
      if (engine.recordingState?.isRecording) {
        engine.stopRecording();
      }
    } catch {
      // Engine not ready, that's fine
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

    // Proper engine reset through manager
    await resetEngine();
  }, [getEngine, resetEngine, clearConversationalChunks]);

  // Engine state synchronization is now handled by AudioEngineManager - no manual sync needed

  // — Recording controls (delegados) —
  const startRecording = useCallback(
    async (config?: RecordingConfig) => {
      // Ensure engine is ready
      if (!engineReady) {
        await initializeAudioEngine();
      }

      const engine = getEngine();
      const seconds = (config?.chunkDuration ?? chunkDurationMs / 1000) | 0;

      await engine.startRecording(seconds);
    },
    [engineReady, initializeAudioEngine, getEngine, chunkDurationMs]
  );

  const stopRecording = useCallback(() => {
    try {
      const engine = getEngine();
      engine.stopRecording();
    } catch (error) {}
  }, [getEngine]);

  const pauseRecording = useCallback(() => {
    try {
      const engine = getEngine();
      engine.pauseRecording();
    } catch (error) {}
  }, [getEngine]);

  const resumeRecording = useCallback(() => {
    try {
      const engine = getEngine();
      engine.resumeRecording();
    } catch (error) {}
  }, [getEngine]);

  const clearTranscriptions = useCallback(() => {
    setTranscriptions([]);
    setAudioChunks([]);
    chunkTranscriptions.current.clear();
    processedAudioUrls.current.clear();
    chunkProcessingTimes.current.clear();
    setConversationalChunks([]);
  }, []);

  // — Whisper call —
  const transcribeWithWhisper = useCallback(
    async (blob: Blob): Promise<TranscriptionResult | null> => {
      if (!asrRef.current || !whisperReady) return null;
      const t0 = performance.now();
      const out = await transcribeBlobWith(asrRef.current, blob, whisperLanguage);
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
    [whisperReady, whisperLanguage, recordMetrics]
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

      const engine = getEngine();

      setIsStreamingRecording(true);
      streamingCallbackRef.current = onChunk;
      lastProcessedChunkIndexRef.current = engine.recordingState?.chunks?.length ?? 0;

      const seconds = (config?.chunkDuration ?? chunkDurationMs / 1000) | 0;

      await engine.startRecording(seconds);

      streamingSessionRef.current = {
        stop: async () => {
          engine.stopRecording();
          setIsStreamingRecording(false);
          streamingCallbackRef.current = null;
        },
      };
    },
    [isStreamingRecording, engineReady, initializeAudioEngine, getEngine, chunkDurationMs]
  );

  const stopStreamingRecording = useCallback(async (): Promise<StreamingSusurroChunk[]> => {
    if (streamingSessionRef.current) {
      await streamingSessionRef.current.stop();
      streamingSessionRef.current = null;
    }
    setIsStreamingRecording(false);
    streamingCallbackRef.current = null;
    // devolvemos lo que haya en conversationalChunks como snapshot simple
    const chunks = conversationalChunks.map<StreamingSusurroChunk>((c: any) => ({
      id: c.id,
      audioBlob: new Blob(), // not retaining blobs; stream consumers should handle in real time
      vadScore: c.vadScore ?? 0,
      timestamp: Date.now(),
      transcriptionText: c.transcript ?? '',
      duration: Math.max(0, (c.endTime ?? 0) - (c.startTime ?? 0)),
      isVoiceActive: (c.vadScore ?? 0) > 0.3,
    }));
    return chunks;
  }, [conversationalChunks]);

  // — Observa y consume chunks de murmuraba —
  useEffect(() => {
    if (!engineReady) return;

    try {
      const engine = getEngine();
      const chunks = engine.recordingState?.chunks || [];

      // Process new chunks
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
        setAudioChunks((prev: any[]) => [...prev, ...newOnes]);
      }

      // promedio de VAD del último
      const last = chunks[chunks.length - 1];
      if (last?.averageVad != null) setAverageVad(last.averageVad);

      // STREAMING: emite sólo el último chunk disponible
      if (isStreamingRecording && streamingCallbackRef.current && chunks.length > 0) {
        if (chunks.length > lastProcessedChunkIndexRef.current) {
          const latest = chunks[chunks.length - 1];
          (async () => {
            const audioBlob = await urlToBlob(latest.processedAudioUrl);
            const vadScore = latest.averageVad ?? 0;
            const isVoiceActive = vadScore > 0.3;

            let transcriptionText = '';
            if (whisperReady && isVoiceActive && audioBlob.size > 0) {
              try {
                const r = await transcribeWithWhisper(audioBlob);
                transcriptionText = r?.text ?? '';
              } catch {
                /* ignore */
              }
            }

            const streamingChunk: StreamingSusurroChunk = {
              id: latest.id || `chunk-${Date.now()}`,
              audioBlob,
              vadScore,
              timestamp: Date.now(),
              transcriptionText,
              duration: latest.duration ?? chunkDurationMs,
              isVoiceActive,
            };

            streamingCallbackRef.current?.(streamingChunk);
            lastProcessedChunkIndexRef.current = chunks.length;
          })();
        }
      }
    } catch (error) {
      // Engine not ready or error accessing it - ignore for now
    }
  }, [
    engineReady,
    audioChunks.length,
    chunkDurationMs,
    isStreamingRecording,
    whisperReady,
    // Remove getEngine and transcribeWithWhisper to prevent infinite loops
    // They are accessed via refs within the effect
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

        setConversationalChunks((prev: any[]) => [...prev, emitted]);
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
        setProcessingStatus((p: any) => ({ ...p, currentChunk: i + 1 }));
        const id = chunks[i].id;
        const processedUrl = processedAudioUrls.current.get(id);
        if (!processedUrl) continue;
        try {
          const blob = await urlToBlob(processedUrl);
          const r = await transcribeWithWhisper(blob);
          if (r) {
            setTranscriptions((prev: any[]) => [...prev, { ...r, chunkIndex: i, timestamp: Date.now() }]);
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
      try {
        const engine = getEngine();
        const isRecording = engine.recordingState?.isRecording ?? false;

        if (!isRecording) {
          setTimeout(() => {
            if (!conversational?.onChunk || conversational.enableInstantTranscription) {
              processChunks(audioChunks);
            }
          }, 50);
        }
      } catch {
        // Engine not ready, skip processing
      }
    }
  }, [audioChunks, engineReady, whisperReady, conversational]); // Remove getEngine and processChunks to prevent loops

  // — Limpieza — (already moved before resetAudioEngine)

  useEffect(() => {
    return () => {
      clearConversationalChunks();
      if (streamingSessionRef.current) {
        streamingSessionRef.current.stop().catch(() => {});
      }
    };
  }, [clearConversationalChunks]);

  // — Export stub (murmuraba puede ofrecer export real si lo expone) —
  const exportChunkAsWav = useCallback(async () => {
    // delegable a murmuraba si publica API; placeholder para compatibilidad
    return new Blob();
  }, []);

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
    // Recording (managed by AudioEngineManager)
    isRecording: (() => {
      try {
        return engineReady ? (getEngine().recordingState?.isRecording ?? false) : false;
      } catch {
        return false;
      }
    })(),
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
    engineError: engineHasError ? 'Engine error detected' : null,
    isInitializingEngine: engineInitializing,

    processAndTranscribeFile,

    startStreamingRecording,
    stopStreamingRecording,

    analyzeVAD,
    convertBlobToBuffer,

    currentStream: engineStream,
  };
}
