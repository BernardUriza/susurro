// useSusurro.ts — lean & mean: MediaRecorder 100% en murmuraba

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMurmubaraEngine } from 'murmuraba';
import { ChunkMiddlewarePipeline } from '../lib/chunk-middleware';
import { useLatencyMonitor } from './use-latency-monitor';

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
  allowLocalModels: false,
  useBrowserCache: true,
  logLevel: 'error' as const,
} as const;

async function ensureASR(model: string, quantized: boolean, onProgress: (p: number) => void) {
  // Dynamic import to enable code-splitting
  const { loadTransformers } = await import('../lib/dynamic-loaders');
  const { pipeline, env } = await loadTransformers();
  
  // Configure transformers environment
  env.allowLocalModels = WHISPER_ENV.allowLocalModels;
  env.useBrowserCache = WHISPER_ENV.useBrowserCache;
  env.backends.onnx.logLevel = WHISPER_ENV.logLevel;
  
  const asr = await pipeline('automatic-speech-recognition', `Xenova/${model}`, {
    quantized,
    progress_callback: (p: any) => {
      if (typeof p?.progress === 'number') onProgress(Math.round(p.progress * 100));
    },
  });
  return asr;
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

async function transcribeBlobWith(asr: any, blob: Blob, language: string) {
  const ab = await blob.arrayBuffer();
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(ab);
  const array = await resampleTo16k(decoded);
  ctx.close();

  const out = await asr(
    { array, sampling_rate: 16000 },
    {
      language,
      task: 'transcribe',
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    }
  );

  const result: TranscriptionResult = {
    text: out?.text ?? '',
    chunkIndex: 0,
    timestamp: Date.now(),
    segments:
      out?.chunks?.map((c: any, index: number) => ({
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

  analyzeVAD: (buffer: ArrayBuffer) => Promise<any>;
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

  // — Murmuraba: única fuente de verdad de MediaRecorder —
  // Import the hook directly instead of lazy loading to avoid conditional hook calls
  const {
    recordingState, // { isRecording, chunks[], stream? }
    startRecording: startMurmurabaRecording,
    stopRecording: stopMurmurabaRecording,
    pauseRecording: pauseMurmurabaRecording,
    resumeRecording: resumeMurmurabaRecording,
    isInitialized: murmubaraInitialized,
    initialize: initializeMurmuraba,
    error: murmubaraError,
    isLoading: murmubaraLoading,
    currentStream,
    // NOTE: murmuraba maneja internamente getUserMedia/MediaRecorder
  } = useMurmubaraEngine({
    autoInitialize: false,
  });

  // — Whisper state —
  const [whisperReady, setWhisperReady] = useState(false);
  const [whisperProgress, setWhisperProgress] = useState(0);
  const [whisperError, setWhisperError] = useState<Error | string | null>(null);
  const asrRef = useRef<any>(null);

  const whisperModel = options.initialModel ? `whisper-${options.initialModel}` : 'whisper-tiny';
  const whisperLanguage = whisperConfig?.language || 'es';
  const whisperQuantized = true;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const asr = await ensureASR(whisperModel, whisperQuantized, (p) => {
          setWhisperProgress(p);
          if (onWhisperProgressLog) {
            if (p === 100) onWhisperProgressLog('Whisper model ready', 'success');
            else onWhisperProgressLog(`Loading Whisper model... ${p}%`, 'info');
          }
        });
        if (!cancelled) {
          asrRef.current = asr;
          setWhisperReady(true);
        }
      } catch (e: any) {
        if (!cancelled) {
          setWhisperError(e?.message ?? 'Failed to load Whisper');
          onWhisperProgressLog?.(String(whisperError), 'error');
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

  const [isEngineInitialized, setIsEngineInitialized] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [isInitializingEngine, setIsInitializingEngine] = useState(false);
  const [isStreamingRecording, setIsStreamingRecording] = useState(false);
  const streamingCallbackRef = useRef<((c: StreamingSusurroChunk) => void) | null>(null);
  const streamingSessionRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const lastProcessedChunkIndexRef = useRef(0);

  const { latencyReport, latencyStatus, recordMetrics } = useLatencyMonitor(300);

  const [middlewarePipeline] = useState(() => new ChunkMiddlewarePipeline());

  // — Engine init/reset —
  const initializeAudioEngine = useCallback(async () => {
    if (murmubaraInitialized || isEngineInitialized || isInitializingEngine || murmubaraLoading)
      return;
    try {
      setIsInitializingEngine(true);
      setEngineError(null);
      await initializeMurmuraba();
      setIsEngineInitialized(true);
    } catch (e: any) {
      setEngineError(e?.message ?? 'Engine initialization failed');
      setIsEngineInitialized(false);
      throw e;
    } finally {
      setIsInitializingEngine(false);
    }
  }, [
    initializeMurmuraba,
    murmubaraInitialized,
    isEngineInitialized,
    isInitializingEngine,
    murmubaraLoading,
  ]);

  const resetAudioEngine = useCallback(async () => {
    if (recordingState.isRecording) stopMurmurabaRecording();
    if (streamingSessionRef.current) {
      await streamingSessionRef.current.stop();
      streamingSessionRef.current = null;
    }
    setIsStreamingRecording(false);
    streamingCallbackRef.current = null;

    setAudioChunks([]);
    setTranscriptions([]);
    clearConversationalChunks();

    // Re-init
    try {
      await initializeAudioEngine();
    } catch {
      /* noop */
    }
  }, [recordingState.isRecording, stopMurmurabaRecording, initializeAudioEngine]);

  useEffect(() => {
    if (murmubaraInitialized && !isEngineInitialized && !isInitializingEngine) {
      setIsEngineInitialized(true);
      setEngineError(null);
    } else if (murmubaraError && !engineError) {
      setEngineError(murmubaraError);
      setIsEngineInitialized(false);
    }
  }, [
    murmubaraInitialized,
    murmubaraError,
    isEngineInitialized,
    isInitializingEngine,
    engineError,
  ]);

  // — Recording controls (delegados) —
  const startRecording = useCallback(
    async (config?: RecordingConfig) => {
      await initializeAudioEngine();
      const seconds = (config?.chunkDuration ?? chunkDurationMs / 1000) | 0;
      await startMurmurabaRecording(seconds);
      // murmuraba maneja el MediaRecorder internamente
    },
    [initializeAudioEngine, startMurmurabaRecording, chunkDurationMs]
  );

  const stopRecording = useCallback(() => {
    stopMurmurabaRecording();
  }, [stopMurmurabaRecording]);

  const pauseRecording = useCallback(() => {
    pauseMurmurabaRecording();
  }, [pauseMurmurabaRecording]);

  const resumeRecording = useCallback(() => {
    resumeMurmurabaRecording();
  }, [resumeMurmurabaRecording]);

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
      const r = await murmubaraVAD(buffer);
      return {
        averageVad: r.average || 0,
        vadScores: r.scores || [],
        metrics: r.metrics || [],
        voiceSegments: (r.voiceSegments || []).map((s: any) => ({
          startTime: s.startTime || 0,
          endTime: s.endTime || 0,
          vadScore: s.vadScore || 0,
          confidence: s.confidence || 0,
        })),
      };
    } catch {
      return { averageVad: 0, vadScores: [], metrics: [], voiceSegments: [] };
    }
  }, []);

  const convertBlobToBuffer = useCallback((blob: Blob) => blob.arrayBuffer(), []);

  const calculateDuration = useCallback(async (buffer: ArrayBuffer): Promise<number> => {
    try {
      const { loadMurmubaraProcessing } = await import('../lib/dynamic-loaders');
      const { extractAudioMetadata } = await loadMurmubaraProcessing();
      const metadata = await extractAudioMetadata(buffer);
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
      await initializeAudioEngine();

      setIsStreamingRecording(true);
      streamingCallbackRef.current = onChunk;
      lastProcessedChunkIndexRef.current = recordingState.chunks?.length ?? 0;

      const seconds = (config?.chunkDuration ?? chunkDurationMs / 1000) | 0;
      await startMurmurabaRecording(seconds);

      streamingSessionRef.current = {
        stop: async () => {
          stopMurmurabaRecording();
          setIsStreamingRecording(false);
          streamingCallbackRef.current = null;
        },
      };
    },
    [
      isStreamingRecording,
      initializeAudioEngine,
      recordingState.chunks,
      startMurmurabaRecording,
      stopMurmurabaRecording,
      chunkDurationMs,
    ]
  );

  const stopStreamingRecording = useCallback(async (): Promise<StreamingSusurroChunk[]> => {
    if (streamingSessionRef.current) {
      await streamingSessionRef.current.stop();
      streamingSessionRef.current = null;
    }
    setIsStreamingRecording(false);
    streamingCallbackRef.current = null;
    // devolvemos lo que haya en conversationalChunks como snapshot simple
    const chunks = conversationalChunks.map<StreamingSusurroChunk>((c) => ({
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

  // — Observa y consume chunks de murmuraba (nada de MediaRecorder manual) —
  useEffect(() => {
    const chunks = recordingState.chunks || [];
    // nuevos
    const newOnes: AudioChunk[] = [];
    for (let i = audioChunks.length; i < chunks.length; i++) {
      const src = chunks[i];

      // Murmuraba v3 debería proveer processedAudioUrl y averageVad
      const id = src.id || `chunk-${Date.now()}-${i}`;
      const startTime = src.startTime ?? i * chunkDurationMs;
      const endTime = src.endTime ?? (i + 1) * chunkDurationMs;
      const vadScore = src.averageVad ?? 0;

      newOnes.push({
        id,
        blob: undefined as any, // lo traemos on-demand al transcribir
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
  }, [
    recordingState.chunks,
    audioChunks.length,
    chunkDurationMs,
    isStreamingRecording,
    whisperReady,
    transcribeWithWhisper,
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
            setTranscriptions((prev) => [
              ...prev,
              { ...r, chunkIndex: i, timestamp: Date.now() } as any,
            ]);
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
    if (audioChunks.length > 0 && !recordingState.isRecording && whisperReady) {
      setTimeout(() => {
        if (!conversational?.onChunk || conversational.enableInstantTranscription) {
          processChunks(audioChunks);
        }
      }, 50);
    }
  }, [audioChunks, recordingState.isRecording, whisperReady, processChunks, conversational]);

  // — Limpieza —
  const clearConversationalChunks = useCallback(() => {
    setConversationalChunks([]);
    processedAudioUrls.current.clear();
    chunkTranscriptions.current.clear();
    chunkProcessingTimes.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      clearConversationalChunks();
      if (streamingSessionRef.current) {
        streamingSessionRef.current.stop().catch(() => {});
      }
    };
  }, [clearConversationalChunks]);

  // — Export stub (murmuraba puede ofrecer export real si lo expone) —
  const exportChunkAsWav = useCallback(async (_chunkId: string) => {
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
    // Recording (puro murmuraba)
    isRecording: recordingState.isRecording,
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
    isEngineInitialized,
    engineError,
    isInitializingEngine,

    processAndTranscribeFile,

    startStreamingRecording,
    stopStreamingRecording,

    analyzeVAD,
    convertBlobToBuffer,

    currentStream, // provisto por murmuraba
  };
}
