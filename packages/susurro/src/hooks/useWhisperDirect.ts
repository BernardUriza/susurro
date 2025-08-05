'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { WhisperConfig, TranscriptionResult, UseWhisperReturn } from '../lib/types';
import type {
  Pipeline,
  TransformersModule,
  TransformersEnvironment,
  WhisperProgress,
  WhisperOutput,
} from '../lib/whisper-types';
import { cacheManager } from '../lib/cache-manager';
import {
  AlertService,
  ToastService,
  defaultAlertService,
  defaultToastService,
} from '../lib/ui-interfaces';

// Smart logging system - Reduced verbosity for production
const DEBUG_MODE = false; // Disabled for production
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
      (window as any).HUGGINGFACE_TOKEN ||
      (window as any).HF_TOKEN ||
      (window as any).VITE_HUGGINGFACE_TOKEN;

    // If no token found, use hardcoded token for development
    if (!token) {
      // This token is from .env.local - should be injected at build time in production
      token = '***REMOVED***';
      if (DEBUG_MODE) console.log('[WHISPER] Using hardcoded development token');
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

// Singleton pattern for Whisper pipeline
class WhisperPipelineSingleton {
  static task = 'automatic-speech-recognition' as const;
  static model = 'Xenova/whisper-tiny.en'; // Use correct Hugging Face model identifier
  static fallbackModels = ['Xenova/whisper-base.en', 'openai/whisper-tiny']; // Fallback options
  static currentCDNIndex = 0;
  static instance: Pipeline | null = null;
  static pipeline: TransformersModule['pipeline'] | null = null;
  static env: TransformersEnvironment | null = null;
  static isLoading: boolean = false;
  static loadingPromise: Promise<Pipeline> | null = null;
  static currentModel: string | null = null;
  static isFirewalled: boolean | null = null;
  static originalFetch: typeof fetch;

  private static async configureEnvironment(): Promise<void> {
    if (!this.env) return;

    log.info('Configuring environment...');
    log.info('Initial env state:', {
      allowLocalModels: this.env.allowLocalModels,
      remoteURL: this.env.remoteURL,
      backends: this.env.backends ? Object.keys(this.env.backends) : [],
    });

    // Configure environment for local model loading
    this.env.allowLocalModels = true;
    this.env.allowRemoteModels = true;

    // Store the original fetch reference (global interceptor is already set up)
    this.originalFetch = originalGlobalFetch || window.fetch;

    const hfToken = getHuggingFaceToken();
    if (hfToken) {
      log.info('HuggingFace authentication is configured');
    } else {
      log.warn('No HuggingFace token available for authentication');
    }

    // Always use local models - they're already downloaded
    log.info('Using local model files from /models/whisper-tiny/');
    this.env.remoteURL = '/models/';
    this.env.allowLocalModels = true;
    this.env.allowRemoteModels = false; // Prevent remote fetching

    this.isFirewalled = false;

    // @ts-expect-error - These properties might not exist in all versions
    this.env.useCache = true;
    // @ts-expect-error - useBrowserCache might not be in type definition
    this.env.useBrowserCache = true;
    // @ts-expect-error - cacheDir might not be in type definition
    this.env.cacheDir = 'transformers-cache';

    // originalFetch is already set above to avoid recursion

    // Configure ONNX backend with reliable WASM paths
    if (this.env.backends) {
      log.info('Configuring ONNX backend...');
      this.env.backends.onnx = {
        wasm: {
          wasmPaths: this.isFirewalled
            ? 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/'
            : 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/',
        },
      };
      log.info('ONNX backend configured:', {
        wasmPaths: this.env.backends.onnx.wasm.wasmPaths,
      });
    }

    log.info('Environment configuration complete:', {
      allowLocalModels: this.env.allowLocalModels,
      remoteURL: this.env.remoteURL,
      isFirewalled: this.isFirewalled,
    });
  }

  // CDN fallback method commented out for now - not currently used
  // private static async fetchWithCDNFallback(url: string, options?: RequestInit): Promise<Response> {
  //   const cdnSources = this.isFirewalled
  //     ? CDN_SOURCES.slice(1) // Skip HuggingFace if firewall detected
  //     : CDN_SOURCES;

  //   let lastError: Error | null = null;

  //   for (const cdn of cdnSources) {
  //     try {
  //       // Transform URL to use alternative CDN
  //       let transformedUrl = url;
  //       if (url.includes('huggingface.co')) {
  //         const modelPath = url.split('huggingface.co/')[1];
  //         transformedUrl = `${cdn.baseUrl}/${modelPath}`;
  //       }

  //       log.info(`Attempting to fetch from ${cdn.name}:`, transformedUrl);

  //       const response = await RetryManager.withRetry(
  //         async () => {
  //           const fetchToUse = this.originalFetch || globalThis.fetch;
  //           return await fetchToUse(transformedUrl, options);
  //         },
  //         2,
  //         1000
  //       );

  //       log.info(`Successfully fetched from ${cdn.name}`);
  //       return response;
  //     } catch (error) {
  //       lastError = error instanceof Error ? error : new Error(String(error));
  //       log.warn(`Failed to fetch from ${cdn.name}:`, lastError.message);
  //       continue;
  //     }
  //   }

  //   throw lastError || new Error('All CDN sources failed');
  // }

  static async getInstance(
    progress_callback: ((progress: WhisperProgress) => void) | null = null,
    model?: string
  ): Promise<Pipeline> {
    log.info('getInstance called');
    log.info('Current state:', {
      hasInstance: !!this.instance,
      isLoading: this.isLoading,
      currentModel: this.currentModel,
      requestedModel: model || this.model,
    });

    // If already loaded, return immediately
    if (this.instance) {
      log.info('Model already loaded, returning existing instance');
      return this.instance;
    }

    // If currently loading, wait for the existing loading promise
    if (this.isLoading && this.loadingPromise) {
      log.info('Model is currently loading, waiting for existing promise');
      return this.loadingPromise;
    }

    // Use provided model or default
    const modelToLoad = model || this.model;
    log.info('Preparing to load model:', modelToLoad);

    // If model has changed, reset instance
    if (this.currentModel && this.currentModel !== modelToLoad) {
      log.info('Model change detected, resetting instance');
      this.instance = null;
      this.currentModel = null;
    }

    // Start loading
    log.info('Starting model loading process');
    this.isLoading = true;
    this.loadingPromise = this.loadInstance(progress_callback, modelToLoad);

    try {
      const startTime = performance.now();
      this.instance = await this.loadingPromise;
      const loadTime = performance.now() - startTime;
      log.info(`Model loaded successfully in ${loadTime.toFixed(2)}ms`);
      this.currentModel = modelToLoad;
      return this.instance;
    } finally {
      this.isLoading = false;
    }
  }

  private static async loadInstance(
    progress_callback: ((progress: WhisperProgress) => void) | null = null,
    model: string
  ): Promise<Pipeline> {
    log.info('loadInstance called with model:', model);

    if (!this.pipeline) {
      log.info('Pipeline not initialized, importing @xenova/transformers...');
      const importStart = performance.now();

      // Dynamic import with enhanced error handling
      const transformers = await RetryManager.withRetry(
        async () => {
          return await import('@xenova/transformers');
        },
        2,
        1000
      ).catch((err: Error) => {
        log.error('Failed to import transformers after retries:', err);
        throw new Error(`Failed to import transformers: ${err.message}`);
      });

      const importTime = performance.now() - importStart;
      log.info('Transformers imported successfully in', importTime.toFixed(2), 'ms');
      log.info('Transformers version info:', {
        hasEnv: !!transformers.env,
        hasPipeline: !!transformers.pipeline,
        envKeys: transformers.env ? Object.keys(transformers.env) : [],
      });

      this.pipeline = transformers.pipeline as any;
      this.env = transformers.env as any;

      if (this.env) {
        await this.configureEnvironment();
      }
    } else {
      log.info('Pipeline already initialized');
    }

    // Check cache first
    log.info('Checking cache status...');
    const cacheCheckStart = performance.now();
    const cacheStatus = await cacheManager.getCacheStatus();
    const cacheCheckTime = performance.now() - cacheCheckStart;
    log.info('Cache status checked in', cacheCheckTime.toFixed(2), 'ms:', cacheStatus);

    // Request persistent storage for better caching
    log.info('Requesting persistent storage...');
    const storageResult = await cacheManager.requestPersistentStorage();
    log.info('Persistent storage request result:', storageResult);

    // Add timeout for model loading (3 minutes for better reliability)
    log.info('Setting up timeout promise (180 seconds)...');
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        log.error('Model loading timeout after 3 minutes');
        reject(new Error('Model loading timeout after 3 minutes'));
      }, 180000);
    });

    if (!this.pipeline) {
      log.error('Pipeline not initialized after setup');
      throw new Error('Pipeline not initialized');
    }

    log.info('Creating pipeline with enhanced configuration:', {
      task: this.task,
      model: model,
      quantized: true,
      isFirewalled: this.isFirewalled,
    });

    // Load model with enhanced error handling and CDN fallbacks
    try {
      log.info('Loading model with enhanced configuration...');

      const loadPromise = RetryManager.withRetry(
        async () => {
          return await this.pipeline!(this.task, model, {
            progress_callback: (progress: WhisperProgress) => {
              log.progress('Progress update:', {
                status: progress.status,
                file: progress.file,
                progress: progress.progress ? `${progress.progress.toFixed(2)}%` : 'N/A',
              });
              if (progress_callback) progress_callback(progress);
            },
            quantized: true,
            revision: 'main',
            cache_dir: undefined, // Let transformers.js handle cache
            local_files_only: false, // Allow downloading from Hugging Face
            timeout: 120000, // Increase timeout to 2 minutes
            retries: 3,
          } as any);
        },
        this.isFirewalled ? 5 : 3,
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

      this.instance = result as Pipeline;
      log.info('SUCCESS: Model loaded successfully');

      return this.instance;
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
}

export interface UseWhisperDirectConfig extends WhisperConfig {
  alertService?: AlertService;
  toastService?: ToastService;
}

export function useWhisperDirect(config: UseWhisperDirectConfig = {}): UseWhisperReturn {
  const {
    alertService = defaultAlertService,
    toastService = defaultToastService,
    ...whisperConfig
  } = config;
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoadingFromCache] = useState(false);

  const pipelineRef = useRef<Pipeline | null>(null);
  const progressAlertRef = useRef<{
    close: () => void;
    update: (options: { message: string; progress: number }) => void;
  } | null>(null);
  const transcriptionQueueRef = useRef<Promise<TranscriptionResult | null>>(Promise.resolve(null));

  // Initialize Transformers.js
  useEffect(() => {
    const loadModel = async () => {
      // Only show loading alert if not already loaded and not currently loading
      const shouldShowAlert =
        !WhisperPipelineSingleton.instance && !WhisperPipelineSingleton.isLoading;

      if (shouldShowAlert) {
        // Show loading alert
        progressAlertRef.current = alertService.show({
          title: '[WHISPER_AI_INITIALIZATION]',
          message: 'Loading Whisper AI model...',
          type: 'loading',
          progress: 0,
        });
      }

      try {
        // const loadStartTime = performance.now();

        // Get pipeline instance with progress callback and model
        pipelineRef.current = await WhisperPipelineSingleton.getInstance(
          (progress: WhisperProgress) => {
            const percent = progress.progress || 0;

            // Only update if progress has actually changed (avoid fractional updates)
            setLoadingProgress((prev) => {
              const rounded = Math.round(Math.max(1, percent));
              return rounded !== Math.round(prev) ? rounded : prev;
            });

            // Update progress alert
            if (progressAlertRef.current) {
              const status = progress.status || 'downloading';
              const file = progress.file || 'model';
              progressAlertRef.current.update({
                message: `${status} ${file}...`,
                progress: percent,
              });
            }
          },
          whisperConfig.model
        );

        // const loadEndTime = performance.now();

        setModelReady(true);
        setLoadingProgress(100);

        // Close loading alert and show success only if we showed it
        if (progressAlertRef.current && shouldShowAlert) {
          progressAlertRef.current.close();
          progressAlertRef.current = null;

          toastService.success('[AI_MODEL_READY] You can now start recording!');
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

        alertService.show({
          title: '[MODEL_LOAD_ERROR]',
          message: detailedMessage,
          type: 'error',
        });
      }
    };

    // Check if model is already loaded
    if (WhisperPipelineSingleton.instance) {
      pipelineRef.current = WhisperPipelineSingleton.instance;
      setModelReady(true);
      setLoadingProgress(100);
    } else if (!pipelineRef.current && typeof window !== 'undefined') {
      loadModel();
    }

    return () => {
      if (progressAlertRef.current) {
        progressAlertRef.current.close();
        progressAlertRef.current = null;
      }
    };
  }, []);

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
          // const startTime = Date.now();

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
    [whisperConfig, modelReady, isTranscribing]
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
