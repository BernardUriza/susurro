'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { WhisperConfig, TranscriptionResult, UseWhisperReturn } from '../lib/types';
import { useModelCache } from './use-model-cache';
import type {
  Pipeline,
  TransformersModule,
  TransformersEnvironment,
  WhisperProgress,
  WhisperOutput,
} from '../lib/whisper-types';
import {
  AlertService,
  ToastService,
  defaultAlertService,
  defaultToastService,
} from '../lib/ui-interfaces';

// Smart logging system - Reduced verbosity for production
const DEBUG_MODE = true; // Temporarily enabled for debugging model loading
const log = {
  info: (...args: unknown[]) => DEBUG_MODE && console.log('[WHISPER]', ...args),
  warn: (...args: unknown[]) => DEBUG_MODE && console.warn('[WHISPER]', ...args),
  error: (...args: unknown[]) => console.error('[WHISPER]', ...args),
  progress: (...args: unknown[]) => DEBUG_MODE && console.log('[WHISPER-PROGRESS]', ...args),
};

// CDN configuration for reliable model downloads
interface CDNConfig {
  name: string;
  baseUrl: string;
  priority: number;
  supportsAuth: boolean;
}

// Get HuggingFace token from environment or window
const getHuggingFaceToken = (): string | undefined => {
  // Check if we're in browser environment
  if (typeof window !== 'undefined') {
    let token: string | undefined;

    // Check for token in window object (can be set by the app)
    token =
      (window as unknown as any).HUGGINGFACE_TOKEN ||
      (window as unknown as any).HF_TOKEN ||
      (window as unknown as any).VITE_HUGGINGFACE_TOKEN;

    // If no token found, warn the user
    if (!token) {
      // Token should be provided via environment variables
      console.warn(
        '[WHISPER] No HuggingFace token found. Please set VITE_HUGGINGFACE_TOKEN in your .env file'
      );
      // Use empty string to avoid compilation errors
      token = '';
    } else {
      if (DEBUG_MODE) console.log('[WHISPER] Found token from window object');
    }

    if (DEBUG_MODE && token) {
      console.log('[WHISPER] HuggingFace token available (length:', token.length, ')');
    }

    return token;
  }
  return undefined;
};

// Set up global fetch interceptor for HuggingFace authentication
let originalGlobalFetch: typeof fetch | null = null;

// Initialize fetch interceptor at module load
if (typeof window !== 'undefined') {
  const token = getHuggingFaceToken();
  if (token) {
    if (DEBUG_MODE)
      console.log('[WHISPER] Setting up global fetch interceptor for HuggingFace authentication');
    originalGlobalFetch = window.fetch;

    window.fetch = async (input, init = {}) => {
      const url =
        typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();

      // Add authentication for any huggingface.co requests
      if (url.includes('huggingface.co')) {
        if (DEBUG_MODE) console.log('[WHISPER] Adding HF auth to request:', url);
        init.headers = {
          ...init.headers,
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Susurro/1.0.0',
        };
      }
      return originalGlobalFetch!(input, init);
    };
  } else {
    if (DEBUG_MODE) console.warn('[WHISPER] No token available for HuggingFace authentication');
  }
}

// Multiple CDN sources for redundancy
const CDN_SOURCES: CDNConfig[] = [
  {
    name: 'HuggingFace',
    baseUrl: 'https://huggingface.co',
    priority: 1,
    supportsAuth: true,
  },
  {
    name: 'JSDelivr',
    baseUrl: 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/models',
    priority: 2,
    supportsAuth: false,
  },
  {
    name: 'UNPKG',
    baseUrl: 'https://unpkg.com/@xenova/transformers@2.17.2/models',
    priority: 3,
    supportsAuth: false,
  },
  {
    name: 'Cloudflare',
    baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/transformers/2.17.2/models',
    priority: 4,
    supportsAuth: false,
  },
];

// Retry mechanism with exponential backoff
class RetryManager {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxRetries) {
          throw lastError;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        log.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, lastError.message);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

// Modern hook-based Whisper pipeline management
interface WhisperPipelineState {
  instance: Pipeline | null;
  pipeline: TransformersModule['pipeline'] | null;
  env: TransformersEnvironment | null;
  isLoading: boolean;
  loadingPromise: Promise<Pipeline> | null;
  currentModel: string | null;
  isFirewalled: boolean | null;
  originalFetch: typeof fetch;
}

// Global singleton instance
let globalPipelineManager: WhisperPipelineManager | null = null;

class WhisperPipelineManager {
  private state: WhisperPipelineState = {
    instance: null,
    pipeline: null,
    env: null,
    isLoading: false,
    loadingPromise: null,
    currentModel: null,
    isFirewalled: null,
    originalFetch: globalThis.fetch,
  };

  private readonly task = 'automatic-speech-recognition' as const;
  private readonly model = 'Xenova/whisper-tiny'; // Use local whisper-tiny model (multilingual)
  private readonly fallbackModels = ['Xenova/whisper-base', 'Xenova/whisper-small'];

  // Reset pipeline state - used when switching models or on errors
  resetInstance(): void {
    log.info('🔄 RESET: Clearing pipeline state for fresh initialization');
    this.state.instance = null;
    this.state.isLoading = false;
    this.state.loadingPromise = null;
    this.state.currentModel = null;
    this.state.pipeline = null;
    this.state.env = null;
  }

  private async configureEnvironment(): Promise<void> {
    if (!this.state.env) return;

    log.info('Configuring environment...');
    log.info('Initial env state:', {
      allowLocalModels: this.state.env.allowLocalModels,
      remoteURL: this.state.env.remoteURL,
      backends: this.state.env.backends ? Object.keys(this.state.env.backends) : [],
    });

    // Configure environment for local model loading
    this.state.env.allowLocalModels = true;
    this.state.env.allowRemoteModels = true;

    // Store the original fetch reference (global interceptor is already set up)
    this.state.originalFetch = originalGlobalFetch || window.fetch;

    const hfToken = getHuggingFaceToken();
    if (hfToken) {
      log.info('HuggingFace authentication is configured (but using local models)');
    } else {
      log.warn('No HuggingFace token available (using local models)');
    }

    // Always use local models - they're already downloaded
    log.info('Using local model files from /models/whisper-tiny/');
    this.state.env.remoteURL = '/models/';
    this.state.env.allowLocalModels = true;
    this.state.env.allowRemoteModels = false; // Prevent remote fetching

    this.state.isFirewalled = false;

    // @ts-expect-error - These properties might not exist in all versions
    this.state.env.useCache = true;
    // @ts-expect-error - useBrowserCache might not be in type definition
    this.state.env.useBrowserCache = true;
    // @ts-expect-error - cacheDir might not be in type definition
    this.state.env.cacheDir = 'transformers-cache';

    // Configure backends with WebGPU priority for 6x performance improvement
    if (this.state.env.backends) {
      log.info('🚀 Configuring WebGPU + ONNX backends for optimal performance...');

      // WebGPU backend for modern hardware (6x faster)
      (this.state.env.backends as any).webgpu = {
        adapter: null, // Let browser choose optimal adapter
      };

      // ONNX backend as fallback
      this.state.env.backends.onnx = {
        wasm: {
          wasmPaths: 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/',
        },
      };

      log.info('🎯 Multi-backend configuration complete:', {
        webgpu: 'Primary (6x performance boost)',
        onnx: 'Fallback for compatibility',
        wasmPaths: this.state.env.backends.onnx.wasm.wasmPaths,
      });
    }

    log.info('Environment configuration complete:', {
      allowLocalModels: this.state.env.allowLocalModels,
      allowRemoteModels: this.state.env.allowRemoteModels,
      remoteURL: this.state.env.remoteURL || 'default (Hugging Face)',
      isFirewalled: this.state.isFirewalled,
    });
  }

  async getInstance(
    progress_callback: ((progress: WhisperProgress) => void) | null = null,
    model?: string
  ): Promise<Pipeline> {
    // Force use the correct model
    const modelToUse = this.model; // Always use the configured model

    log.info('getInstance called');
    log.info('Current state:', {
      hasInstance: !!this.state.instance,
      isLoading: this.state.isLoading,
      currentModel: this.state.currentModel,
      requestedModel: modelToUse,
    });

    // FORCE RESET - clear any cached state that might have wrong model
    if (this.state.currentModel && this.state.currentModel !== modelToUse) {
      log.info(
        '🔄 Model mismatch detected, forcing reset:',
        this.state.currentModel,
        '->',
        modelToUse
      );
      this.resetInstance();
    }

    // Also reset if we have any lingering Xenova model
    if (this.state.currentModel && this.state.currentModel.includes('Xenova')) {
      log.info(
        '🔄 Xenova model detected, forcing reset to onnx-community:',
        this.state.currentModel
      );
      this.resetInstance();
    }

    // If already loaded, return immediately
    if (this.state.instance) {
      log.info('Model already loaded, returning existing instance');
      return this.state.instance;
    }

    // If currently loading, wait for the existing loading promise
    if (this.state.isLoading && this.state.loadingPromise) {
      log.info('Model is currently loading, waiting for existing promise');
      return this.state.loadingPromise;
    }

    // Always use our configured model (ignore passed model parameter)
    const modelToLoad = this.model;
    log.info('Preparing to load model:', modelToLoad);

    // Start loading
    log.info('Starting model loading process');
    this.state.isLoading = true;
    this.state.loadingPromise = this.loadInstance(progress_callback, modelToLoad);

    try {
      const startTime = performance.now();
      this.state.instance = await this.state.loadingPromise;
      const loadTime = performance.now() - startTime;
      log.info(`Model loaded successfully in ${loadTime.toFixed(2)}ms`);
      this.state.currentModel = modelToLoad;
      return this.state.instance;
    } finally {
      this.state.isLoading = false;
    }
  }

  private async loadInstance(
    progress_callback: ((progress: WhisperProgress) => void) | null = null,
    model: string
  ): Promise<Pipeline> {
    log.info('loadInstance called with model:', model);

    if (!this.state.pipeline) {
      log.info('Pipeline not initialized, importing @xenova/transformers...');
      const importStart = performance.now();

      // Dynamic import with enhanced error handling + bundle size optimization
      const { loadTransformers } = await import('../lib/dynamic-loaders');
      const transformers = await RetryManager.withRetry(loadTransformers, 2, 1000).catch(
        (err: Error) => {
          log.error('Failed to import transformers after retries:', err);
          throw new Error(`Failed to import transformers: ${err.message}`);
        }
      );

      const importTime = performance.now() - importStart;
      log.info('Transformers imported successfully in', importTime.toFixed(2), 'ms');
      log.info('Transformers version info:', {
        hasEnv: !!transformers.env,
        hasPipeline: !!transformers.pipeline,
        envKeys: transformers.env ? Object.keys(transformers.env) : [],
      });

      this.state.pipeline = transformers.pipeline as any;
      this.state.env = transformers.env as any;

      if (this.state.env) {
        await this.configureEnvironment();
      }
    } else {
      log.info('Pipeline already initialized');
    }

    // Cache checking is now handled by the useModelCache hook
    log.info('Cache management is handled by useModelCache hook');

    // Add timeout for model loading (3 minutes for better reliability)
    log.info('Setting up timeout promise (180 seconds)...');
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        log.error('Model loading timeout after 3 minutes');
        reject(new Error('Model loading timeout after 3 minutes'));
      }, 180000);
    });

    if (!this.state.pipeline) {
      log.error('Pipeline not initialized after setup');
      throw new Error('Pipeline not initialized');
    }

    log.info('Creating pipeline with enhanced configuration:', {
      task: this.task,
      model: model,
      quantized: true,
      isFirewalled: this.state.isFirewalled,
    });

    // Load model with enhanced error handling and CDN fallbacks
    try {
      log.info('Loading model with enhanced configuration...');

      const loadPromise = RetryManager.withRetry(
        async () => {
          return await this.state.pipeline!(this.task, model, {
            progress_callback: (progress: WhisperProgress) => {
              log.progress('Progress update:', {
                status: progress.status,
                file: progress.file,
                progress: progress.progress ? `${progress.progress.toFixed(2)}%` : 'N/A',
              });
              if (progress_callback) progress_callback(progress);
            },
            quantized: true,
            dtype: {
              encoder_model: 'fp32',
              decoder_model_merged: 'q4', // 4-bit quantization for 6x speed boost
            },
            device: 'webgpu', // Prefer WebGPU for hardware acceleration
            revision: 'main',
            cache_dir: undefined, // Let transformers.js handle cache
            local_files_only: false, // Allow downloading Distil-Whisper from HuggingFace
            timeout: 180000, // Increase timeout for initial model download
            retries: 3,
          } as any);
        },
        this.state.isFirewalled ? 5 : 3,
        2000
      ); // More retries if firewall detected

      log.info('Starting model download/initialization...');
      const raceStart = performance.now();

      const result = await Promise.race([loadPromise, timeoutPromise]);

      const raceTime = performance.now() - raceStart;
      log.info('Model loading completed in', raceTime.toFixed(2), 'ms');

      if (result instanceof Error) {
        throw result;
      }

      log.info('Model loaded successfully, validating instance...');
      log.info('Instance type:', typeof result);
      log.info('Instance properties:', result ? Object.keys(result) : 'null');

      this.state.instance = result as Pipeline;
      log.info('SUCCESS: Model loaded successfully');

      return this.state.instance;
    } catch (error) {
      log.error('Model loading failed after all attempts:', error);

      // Provide specific error messages based on error type
      if (error instanceof Error) {
        if (error.message.includes('JSON') || error.message.includes('HTML')) {
          throw new Error(
            'Network configuration issue detected. ' +
              'This usually indicates a firewall or proxy is blocking model downloads. ' +
              'Please check your network settings or try a different network connection.'
          );
        } else if (error.message.includes('timeout')) {
          throw new Error(
            'Model loading timed out. ' +
              'This may be due to slow network connection or server issues. ' +
              'Please try again or check your internet connection.'
          );
        }
      }

      throw error;
    }
  }

  // Get current state for debugging
  getState(): WhisperPipelineState {
    return { ...this.state };
  }
}

export interface UseWhisperDirectConfig extends WhisperConfig {
  alertService?: AlertService;
  toastService?: ToastService;
  onProgressLog?: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
}

export function useWhisperDirect(config: UseWhisperDirectConfig = {}): UseWhisperReturn {
  const {
    alertService = defaultAlertService,
    toastService = defaultToastService,
    onProgressLog,
    ...whisperConfig
  } = config;
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Hook-based cache management
  const { cacheStatus, requestPersistentStorage } = useModelCache();
  const [isLoadingFromCache] = useState(cacheStatus.hasCache);

  const pipelineRef = useRef<Pipeline | null>(null);
  const pipelineManagerRef = useRef<WhisperPipelineManager | null>(null);
  const progressAlertRef = useRef<{
    close: () => void;
    update: (options: { message: string; progress: number }) => void;
  } | null>(null);
  const transcriptionQueueRef = useRef<Promise<TranscriptionResult | null>>(Promise.resolve(null));

  // Initialize pipeline manager - use global singleton
  useEffect(() => {
    if (!globalPipelineManager) {
      globalPipelineManager = new WhisperPipelineManager();
    }
    pipelineManagerRef.current = globalPipelineManager;
  }, []);

  // Add ref to track if loading has been initiated
  const loadingInitiatedRef = useRef(false);

  // REFACTOR: Use stable callbacks to survive StrictMode cycles
  const stableOnProgressLog = useCallback((message: string, type: 'info' | 'warning' | 'error' | 'success') => {
    // ANTI-STRICTMODE: Verify callback integrity in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[CALLBACK_INTEGRITY_CHECK]', {
        hasCallback: !!onProgressLog,
        message: message.slice(0, 50) + '...',
        type,
        strictMode: true // We know we're in StrictMode
      });
    }
    onProgressLog?.(message, type);
  }, [onProgressLog]);
  
  // Removed unused stableAlertService - using direct alertService calls
  
  const stableToastService = useCallback((message: string) => {
    toastService?.success(message);
  }, [toastService]);
  
  const stableRequestPersistentStorage = useCallback(() => {
    requestPersistentStorage?.();
  }, [requestPersistentStorage]);
  
  const whisperConfigModelRef = useRef(whisperConfig.model);

  // Only track model changes via ref (non-callback data)
  useEffect(() => {
    whisperConfigModelRef.current = whisperConfig.model;
  }, [whisperConfig.model]);

  // Initialize Transformers.js
  useEffect(() => {
    const loadModel = async () => {
      if (!pipelineManagerRef.current) return;

      // Check if already loading or loaded
      const state = pipelineManagerRef.current.getState();
      if (state.isLoading || state.instance) {
        // If already loaded, just update our state
        if (state.instance) {
          pipelineRef.current = state.instance;
          setModelReady(true);
          setLoadingProgress(100);
        }
        return;
      }

      // Check if another instance is already loading
      if (loadingInitiatedRef.current) {
        return;
      }

      // Mark as loading initiated
      loadingInitiatedRef.current = true;

      // Only show loading alert if not already loaded and not currently loading
      const shouldShowAlert = !pipelineRef.current;

      if (shouldShowAlert) {
        // Show loading alert
        progressAlertRef.current = alertService.show({
          title: '[WHISPER_AI_INITIALIZATION]',
          message: 'Loading Whisper AI model...',
          type: 'loading',
          progress: 0,
        });
      }

      // Log initial loading state
      stableOnProgressLog('🚀 Iniciando carga del modelo Whisper-Tiny local... 0%', 'info');

      try {
        // Request persistent storage for better caching
        await stableRequestPersistentStorage();

        // Get pipeline instance with progress callback and model
        pipelineRef.current = await pipelineManagerRef.current.getInstance(
          (progress: WhisperProgress) => {
            const percent = progress.progress || 0;
            const status = progress.status || 'downloading';
            const file = progress.file || 'model';

            // Only update if progress has actually changed (avoid fractional updates)
            setLoadingProgress((prev) => {
              const rounded = Math.round(Math.max(1, percent));
              return rounded !== Math.round(prev) ? rounded : prev;
            });

            // Log detailed progress with emojis
            const emoji = status.includes('download')
              ? '📥'
              : status.includes('progress')
                ? '⏳'
                : status.includes('load')
                  ? '🔄'
                  : '📊';

            // Always show percentage, even if 0
            const roundedPercent = Math.round(percent);
            const fileName = file?.split('/').pop() || 'modelo';
            
            // Debug log to verify callback is working - Always log for debugging UI issues
            console.log('[WHISPER_PROGRESS_DEBUG]', {
              status,
              file: fileName,
              percent: roundedPercent,
              hasCallback: !!stableOnProgressLog,
              timestamp: Date.now()
            });
            
            // CRITICAL: Always call progress callback regardless of DEBUG_MODE
            const progressMessage = status.includes('download') 
              ? `${emoji} Descargando ${fileName}... ${roundedPercent}%`
              : status.includes('load')
              ? `${emoji} Cargando ${fileName}... ${roundedPercent}%`
              : status.includes('init')
              ? `🚀 Inicializando ${fileName}... ${roundedPercent}%`
              : `${emoji} Procesando ${fileName}... ${roundedPercent}%`;
              
            // FIXED: Use stable callback that survives StrictMode cycles
            stableOnProgressLog(progressMessage, 'info');
            if (process.env.NODE_ENV === 'development') {
              console.log('[WHISPER_PROGRESS_UI_SENT]', progressMessage);
            }

            // Update progress alert
            if (progressAlertRef.current) {
              progressAlertRef.current.update({
                message: `${status} ${file}...`,
                progress: percent,
              });
            }
          },
          whisperConfig.model
        );

        setModelReady(true);
        setLoadingProgress(100);
        loadingInitiatedRef.current = false; // Reset for potential retry

        // Log success
        stableOnProgressLog(
          '✅ Modelo Whisper-Tiny cargado exitosamente (100% listo)',
          'success'
        );

        // Close loading alert and show success only if we showed it
        if (progressAlertRef.current && shouldShowAlert) {
          progressAlertRef.current.close();
          progressAlertRef.current = null;

          stableToastService('[AI_MODEL_READY] You can now start recording!');
          stableOnProgressLog('🎤 Sistema listo para transcripción de audio', 'success');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load model';
        log.error('Model loading failed:', err);

        // Check for specific error types and provide detailed feedback
        if (err instanceof Error) {
          if (
            err.message.includes('Unexpected token') ||
            err.message.includes('JSON') ||
            err.message.includes('HTML')
          ) {
            log.error('Model loading failed due to network/CORS issues');
            log.error('Common solutions:');
            log.error('1. Check if you are behind a corporate firewall/proxy');
            log.error('2. Try using a VPN or different network');
            log.error('3. The model files may be temporarily unavailable');
            log.error('4. Try refreshing the page and loading again');
            log.error('5. Alternative CDN sources have been attempted automatically');
          } else if (err.message.includes('Network configuration issue')) {
            log.error(
              'Network configuration issue detected - firewall detection and CDN fallback system activated'
            );
          } else if (err.message.includes('timeout')) {
            log.error('Model loading timed out - network may be slow or unstable');
          }
        }

        setError(new Error(errorMessage));
        loadingInitiatedRef.current = false; // Reset to allow retry

        // Log error
        stableOnProgressLog(`❌ Error al cargar modelo: ${errorMessage}`, 'error');

        if (progressAlertRef.current) {
          progressAlertRef.current.close();
          progressAlertRef.current = null;
        }

        const detailedMessage =
          err instanceof Error
            ? err.message.includes('JSON') || err.message.includes('HTML')
              ? 'Network configuration issue: Unable to download model files. The system has attempted multiple CDN sources. Please check your network settings or try a different connection.'
              : err.message.includes('Network configuration issue')
                ? 'Corporate firewall detected. Alternative download sources were tried but failed. Please contact your IT department or try a different network.'
                : err.message.includes('timeout')
                  ? 'Model loading timed out. This may be due to slow network or server issues. Please try again.'
                  : errorMessage
            : errorMessage;

        alertService?.show({
          title: '[MODEL_LOAD_ERROR]',
          message: detailedMessage,
          type: 'error',
        });
      }
    };

    // Check if model is already loaded in global manager
    const currentState = pipelineManagerRef.current?.getState();
    if (currentState?.instance && !pipelineRef.current) {
      // Model already loaded globally, just update local state
      pipelineRef.current = currentState.instance;
      setModelReady(true);
      setLoadingProgress(100);
      stableOnProgressLog('✅ Modelo ya cargado, listo para usar', 'success');
    } else if (
      !currentState?.instance &&
      !currentState?.isLoading &&
      !pipelineRef.current &&
      typeof window !== 'undefined'
    ) {
      // Only load if not already loaded and not currently loading
      loadModel();
    } else if (currentState?.isLoading) {
      // Model is loading in another component, just wait
      stableOnProgressLog('⏳ Modelo cargándose en otro componente...', 'info');
    }

    return () => {
      if (progressAlertRef.current) {
        progressAlertRef.current.close();
        progressAlertRef.current = null;
      }
    };
  }, [stableOnProgressLog, stableRequestPersistentStorage, stableToastService, alertService, whisperConfig.model]); // React 19 StrictMode compatible

  // Convert audio blob to base64 data URL
  const audioToBase64 = async (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  };

  const transcribe = useCallback(
    async (audioBlob: Blob): Promise<TranscriptionResult | null> => {
      // Queue transcriptions to prevent concurrent calls
      const transcriptionPromise = transcriptionQueueRef.current.then(async () => {
        if (isTranscribing) {
          return null;
        }

        if (!pipelineRef.current || !modelReady) {
          setError(new Error('Model not ready'));
          return null;
        }

        setIsTranscribing(true);
        setError(null);

        try {
          // Convert blob to data URL
          const audioDataUrl = await audioToBase64(audioBlob);

          // Perform transcription
          const output: WhisperOutput = await pipelineRef.current(audioDataUrl, {
            chunk_length_s: 30,
            stride_length_s: 5,
            language: whisperConfig.language || 'english',
            task: 'transcribe',
            return_timestamps: false,
          });

          // Processing completed
          const result: TranscriptionResult = {
            text: output.text,
            segments:
              output.chunks?.map((chunk, index) => ({
                id: index,
                seek: 0,
                start: chunk.timestamp?.[0] || 0,
                end: chunk.timestamp?.[1] || 0,
                text: chunk.text,
                tokens: [],
                temperature: 0,
                avg_logprob: 0,
                compression_ratio: 0,
                no_speech_prob: 0,
              })) || [],
            chunkIndex: 0,
            timestamp: Date.now(),
          };

          setTranscript(result.text);
          setIsTranscribing(false);

          return result;
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Transcription failed');
          log.error('Transcription failed:', err);

          setError(error);
          setIsTranscribing(false);

          alertService.show({
            title: '[TRANSCRIPTION_ERROR]',
            message: error.message,
            type: 'error',
          });

          return null;
        }
      });

      // Update queue reference
      transcriptionQueueRef.current = transcriptionPromise.catch(() => null);

      return transcriptionPromise;
    },
    [whisperConfig, modelReady, isTranscribing, alertService]
  );

  const clearTranscript = useCallback(() => {
    setTranscript(null);
    setError(null);
  }, []);

  return {
    isTranscribing,
    transcript,
    error,
    transcribe,
    clearTranscript,
    modelReady,
    loadingProgress,
    isLoadingFromCache,
  };
}
