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

// Singleton pattern for Whisper pipeline
class WhisperPipelineSingleton {
  static task = 'automatic-speech-recognition' as const;
  static model = 'Xenova/whisper-tiny'; // Changed to tiny for faster loading
  static modelUrl = 'https://cdn.jsdelivr.net/gh/xenova/transformers.js@2.17.2/examples/whisper-tiny/'; // Fallback URL
  static modelId = 'Xenova/whisper-tiny';
  static instance: Pipeline | null = null;
  static pipeline: TransformersModule['pipeline'] | null = null;
  static env: TransformersEnvironment | null = null;
  static isLoading: boolean = false;
  static loadingPromise: Promise<Pipeline> | null = null;
  static currentModel: string | null = null;

  static async getInstance(
    progress_callback: ((progress: WhisperProgress) => void) | null = null,
    model?: string
  ): Promise<Pipeline> {
    console.log('[WHISPER] getInstance called');
    console.log('[WHISPER] Current state:', {
      hasInstance: !!this.instance,
      isLoading: this.isLoading,
      currentModel: this.currentModel,
      requestedModel: model || this.model
    });

    // If already loaded, return immediately
    if (this.instance) {
      console.log('[WHISPER] Model already loaded, returning existing instance');
      console.log('[WHISPER] Instance details:', {
        model: this.currentModel,
        pipelineType: this.task,
        instanceType: typeof this.instance
      });
      return this.instance;
    }

    // If currently loading, wait for the existing loading promise
    if (this.isLoading && this.loadingPromise) {
      console.log('[WHISPER] Model is currently loading, waiting for existing promise');
      return this.loadingPromise;
    }

    // Use provided model or default
    const modelToLoad = model || this.model;
    console.log('[WHISPER] Preparing to load model:', modelToLoad);
    
    // If model has changed, reset instance
    if (this.currentModel && this.currentModel !== modelToLoad) {
      console.log('[WHISPER] Model change detected, resetting instance');
      console.log('[WHISPER] Previous model:', this.currentModel);
      console.log('[WHISPER] New model:', modelToLoad);
      this.instance = null;
      this.currentModel = null;
    }

    // Start loading
    console.log('[WHISPER] Starting model loading process');
    this.isLoading = true;
    this.loadingPromise = this.loadInstance(progress_callback, modelToLoad);

    try {
      console.log('[WHISPER] Awaiting model load...');
      const startTime = performance.now();
      this.instance = await this.loadingPromise;
      const loadTime = performance.now() - startTime;
      console.log('[WHISPER] Model loaded successfully in', loadTime.toFixed(2), 'ms');
      this.currentModel = modelToLoad;
      console.log('[WHISPER] Model loading complete:', {
        model: this.currentModel,
        loadTime: `${loadTime.toFixed(2)}ms`,
        memoryUsage: typeof window !== 'undefined' && 'memory' in performance 
          ? `${((performance as any).memory.usedJSHeapSize / 1048576).toFixed(2)} MB`
          : 'N/A'
      });
      return this.instance;
    } finally {
      this.isLoading = false;
      console.log('[WHISPER] Loading flag reset');
    }
  }

  private static async loadInstance(
    progress_callback: ((progress: WhisperProgress) => void) | null = null,
    model: string
  ): Promise<Pipeline> {
    console.log('[WHISPER] loadInstance called with model:', model);
    
    if (!this.pipeline) {
      console.log('[WHISPER] Pipeline not initialized, importing @xenova/transformers...');
      const importStart = performance.now();
      
      // Dynamic import with error handling
      const transformers = await import('@xenova/transformers').catch((err: Error) => {
        console.error('[WHISPER] Failed to import transformers:', err);
        throw new Error(`Failed to import transformers: ${err.message}`);
      });

      const importTime = performance.now() - importStart;
      console.log('[WHISPER] Transformers imported successfully in', importTime.toFixed(2), 'ms');
      console.log('[WHISPER] Transformers version info:', {
        hasEnv: !!transformers.env,
        hasPipeline: !!transformers.pipeline,
        envKeys: transformers.env ? Object.keys(transformers.env) : []
      });

      this.pipeline = transformers.pipeline as any;
      this.env = { ...transformers.env, remoteURL: '' } as TransformersEnvironment;

      if (this.env) {
        console.log('[WHISPER] Configuring environment...');
        console.log('[WHISPER] Initial env state:', {
          allowLocalModels: this.env.allowLocalModels,
          remoteURL: this.env.remoteURL,
          backends: this.env.backends ? Object.keys(this.env.backends) : []
        });
        
        // Configure environment with correct settings for browser
        this.env.allowLocalModels = false;
        this.env.allowRemoteModels = true;
        // Use the Hugging Face CDN which properly handles CORS
        this.env.remoteURL = 'https://huggingface.co/';
        // Note: These properties might not exist in all versions of transformers.js
        // @ts-ignore - useCache might not be in type definition
        this.env.useCache = true;
        // @ts-ignore - useBrowserCache might not be in type definition
        this.env.useBrowserCache = true;
        // @ts-ignore - cacheDir might not be in type definition
        this.env.cacheDir = 'transformers-cache';
        
        // Set custom fetch with better error handling
        // @ts-ignore - fetchFunc might not be in type definition
        const originalFetch = this.env.backends?.onnx?.fetchFunc || fetch;
        if (this.env.backends?.onnx) {
          // @ts-ignore - fetchFunc might not be in type definition
          this.env.backends.onnx.fetchFunc = async (url: string, options?: RequestInit) => {
            console.log('[WHISPER] Fetching URL:', url);
            try {
              const response = await originalFetch(url, {
                ...options,
                mode: 'cors',
                credentials: 'omit'
              });
              if (!response.ok) {
                console.error('[WHISPER] Fetch failed:', response.status, response.statusText, 'for URL:', url);
              }
              return response;
            } catch (error) {
              console.error('[WHISPER] Fetch error for URL:', url, error);
              throw error;
            }
          };
        }
        
        console.log('[WHISPER] Environment settings configured:', {
          allowLocalModels: this.env.allowLocalModels,
          allowRemoteModels: this.env.allowRemoteModels,
          remoteURL: this.env.remoteURL,
          // @ts-ignore
          useCache: this.env.useCache,
          // @ts-ignore
          useBrowserCache: this.env.useBrowserCache,
          // @ts-ignore
          cacheDir: this.env.cacheDir
        });

        // Configure backends safely
        if (this.env.backends) {
          console.log('[WHISPER] Configuring ONNX backend...');
          this.env.backends.onnx = {
            wasm: {
              wasmPaths: 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/',
            },
          };
          console.log('[WHISPER] ONNX backend configured:', {
            wasmPaths: this.env.backends.onnx.wasm.wasmPaths
          });
        } else {
          console.warn('[WHISPER] No backends object found in environment');
        }
        
        console.log('[WHISPER] Environment configuration complete:', {
          allowLocalModels: this.env.allowLocalModels,
          remoteURL: this.env.remoteURL
        });
      }
    } else {
      console.log('[WHISPER] Pipeline already initialized');
    }

    // Check cache first
    console.log('[WHISPER] Checking cache status...');
    const cacheCheckStart = performance.now();
    const cacheStatus = await cacheManager.getCacheStatus();
    const cacheCheckTime = performance.now() - cacheCheckStart;
    console.log('[WHISPER] Cache status checked in', cacheCheckTime.toFixed(2), 'ms:', cacheStatus);

    // Request persistent storage for better caching
    console.log('[WHISPER] Requesting persistent storage...');
    const storageResult = await cacheManager.requestPersistentStorage();
    console.log('[WHISPER] Persistent storage request result:', storageResult);

    // Add timeout for model loading (2 minutes)
    console.log('[WHISPER] Setting up timeout promise (120 seconds)...');
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        console.error('[WHISPER] Model loading timeout after 2 minutes');
        reject(new Error('Model loading timeout after 2 minutes'));
      }, 120000);
    });

    if (!this.pipeline) {
      console.error('[WHISPER] Pipeline not initialized after setup');
      throw new Error('Pipeline not initialized');
    }

    console.log('[WHISPER] Creating pipeline with configuration:', {
      task: this.task,
      model: model,
      quantized: true
    });

    // Try to load the model with better error handling
    let loadPromise;
    try {
      console.log('[WHISPER] Attempting to create pipeline with model:', model);
      loadPromise = this.pipeline(this.task, model, {
        progress_callback: (progress: WhisperProgress) => {
          console.log('[WHISPER] Progress update:', {
            status: progress.status,
            file: progress.file,
            progress: progress.progress ? `${progress.progress.toFixed(2)}%` : 'N/A',
            loaded: progress.loaded,
            total: progress.total,
            name: progress.name
          });
          if (progress_callback) progress_callback(progress);
        },
        quantized: true,
        // @ts-ignore - revision might not be in type definition
        revision: 'main',
        // @ts-ignore - cache_dir might not be in type definition
        cache_dir: '.transformers-cache',
        // @ts-ignore - local_files_only might not be in type definition
        local_files_only: false
      });
    } catch (immediateError) {
      console.error('[WHISPER] Immediate error creating pipeline:', immediateError);
      throw immediateError;
    }

    console.log('[WHISPER] Starting model download/initialization race...');
    const raceStart = performance.now();
    
    const result = await Promise.race([loadPromise, timeoutPromise]);
    
    const raceTime = performance.now() - raceStart;
    console.log('[WHISPER] Model loading race completed in', raceTime.toFixed(2), 'ms');
    
    if (result instanceof Error) {
      console.error('[WHISPER] Model loading failed with error:', result);
      throw result;
    }
    
    console.log('[WHISPER] Model loaded successfully, validating instance...');
    console.log('[WHISPER] Instance type:', typeof result);
    console.log('[WHISPER] Instance properties:', result ? Object.keys(result) : 'null');
    
    this.instance = result as Pipeline;
    console.log('[WHISPER] Instance stored in singleton');
    
    return this.instance;
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
  const progressAlertRef = useRef<{ close: () => void; update: (options: { message: string; progress: number }) => void } | null>(null);
  const transcriptionQueueRef = useRef<Promise<TranscriptionResult | null>>(Promise.resolve(null));

  // Initialize Transformers.js
  useEffect(() => {
    console.log('[WHISPER HOOK] useEffect triggered for model initialization');
    console.log('[WHISPER HOOK] Initial state:', {
      hasInstance: !!WhisperPipelineSingleton.instance,
      isLoading: WhisperPipelineSingleton.isLoading,
      currentModel: WhisperPipelineSingleton.currentModel,
      pipelineRef: !!pipelineRef.current,
      windowDefined: typeof window !== 'undefined'
    });

    const loadModel = async () => {
      console.log('[WHISPER HOOK] loadModel function called');
      
      // Only show loading alert if not already loaded and not currently loading
      const shouldShowAlert =
        !WhisperPipelineSingleton.instance && !WhisperPipelineSingleton.isLoading;

      console.log('[WHISPER HOOK] Should show alert:', shouldShowAlert);

      if (shouldShowAlert) {
        console.log('[WHISPER HOOK] Showing loading alert');
        // Show loading alert
        progressAlertRef.current = alertService.show({
          title: '[WHISPER_AI_INITIALIZATION]',
          message: 'Loading Whisper AI model...',
          type: 'loading',
          progress: 0,
        });
      }

      try {
        console.log('[WHISPER HOOK] Starting model load with config:', {
          model: whisperConfig.model || 'default',
          language: whisperConfig.language || 'default'
        });
        
        const loadStartTime = performance.now();
        
        // Get pipeline instance with progress callback and model
        pipelineRef.current = await WhisperPipelineSingleton.getInstance(
          (progress: WhisperProgress) => {
            const percent = progress.progress || 0;
            console.log('[WHISPER HOOK] Progress callback:', {
              percent: `${percent.toFixed(2)}%`,
              status: progress.status,
              file: progress.file
            });
            
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

        const loadEndTime = performance.now();
        console.log('[WHISPER HOOK] Model loaded successfully in', (loadEndTime - loadStartTime).toFixed(2), 'ms');
        console.log('[WHISPER HOOK] Pipeline reference set:', !!pipelineRef.current);

        setModelReady(true);
        setLoadingProgress(100);

        // Close loading alert and show success only if we showed it
        if (progressAlertRef.current && shouldShowAlert) {
          console.log('[WHISPER HOOK] Closing loading alert and showing success');
          progressAlertRef.current.close();
          progressAlertRef.current = null;

          toastService.success('[AI_MODEL_READY] You can now start recording!');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load model';
        console.error('[WHISPER HOOK] Model loading failed:', err);
        console.error('[WHISPER HOOK] Error details:', {
          message: errorMessage,
          stack: err instanceof Error ? err.stack : 'No stack trace',
          type: err instanceof Error ? err.constructor.name : typeof err
        });
        
        // Check for specific error types
        if (err instanceof Error && (err.message.includes('Unexpected token') || err.message.includes('JSON'))) {
          console.error('[WHISPER HOOK] Model loading failed due to network/CORS issues');
          console.error('[WHISPER HOOK] Common solutions:');
          console.error('[WHISPER HOOK] 1. Check if you are behind a corporate firewall/proxy');
          console.error('[WHISPER HOOK] 2. Try using a VPN or different network');
          console.error('[WHISPER HOOK] 3. The model files may be temporarily unavailable');
          console.error('[WHISPER HOOK] 4. Try refreshing the page and loading again');
        }
        
        setError(new Error(errorMessage));

        if (progressAlertRef.current) {
          progressAlertRef.current.close();
          progressAlertRef.current = null;
        }

        const detailedMessage = err instanceof Error && err.message.includes('JSON') 
          ? 'Network error: Unable to download model files. Please check your internet connection and try again.'
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
      console.log('[WHISPER HOOK] Model already loaded, reusing instance');
      pipelineRef.current = WhisperPipelineSingleton.instance;
      setModelReady(true);
      setLoadingProgress(100);
    } else if (!pipelineRef.current && typeof window !== 'undefined') {
      console.log('[WHISPER HOOK] No instance found, initiating model load');
      loadModel();
    } else {
      console.log('[WHISPER HOOK] Skipping load:', {
        hasPipelineRef: !!pipelineRef.current,
        isWindowDefined: typeof window !== 'undefined'
      });
    }

    return () => {
      console.log('[WHISPER HOOK] Cleanup function called');
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
      console.log('[WHISPER TRANSCRIBE] Transcribe called with blob:', {
        size: audioBlob.size,
        type: audioBlob.type
      });

      // Queue transcriptions to prevent concurrent calls
      const transcriptionPromise = transcriptionQueueRef.current.then(async () => {
        console.log('[WHISPER TRANSCRIBE] Starting transcription process');
        console.log('[WHISPER TRANSCRIBE] Current state:', {
          isTranscribing,
          modelReady,
          hasPipeline: !!pipelineRef.current
        });

        if (isTranscribing) {
          console.warn('[WHISPER TRANSCRIBE] Already transcribing, skipping');
          return null;
        }

        if (!pipelineRef.current || !modelReady) {
          console.error('[WHISPER TRANSCRIBE] Model not ready:', {
            pipeline: !!pipelineRef.current,
            modelReady
          });
          setError(new Error('Model not ready'));
          return null;
        }

        setIsTranscribing(true);
        setError(null);

        try {
          console.log('[WHISPER TRANSCRIBE] Converting blob to data URL...');
          const conversionStart = performance.now();
          
          // Convert blob to data URL
          const audioDataUrl = await audioToBase64(audioBlob);
          
          const conversionTime = performance.now() - conversionStart;
          console.log('[WHISPER TRANSCRIBE] Blob converted in', conversionTime.toFixed(2), 'ms');
          console.log('[WHISPER TRANSCRIBE] Data URL length:', audioDataUrl.length);

          // Perform transcription
          const startTime = Date.now();
          const transcriptionStart = performance.now();

          console.log('[WHISPER TRANSCRIBE] Starting pipeline transcription with config:', {
            chunk_length_s: 30,
            stride_length_s: 5,
            language: whisperConfig.language || 'english',
            task: 'transcribe',
            return_timestamps: false
          });

          const output: WhisperOutput = await pipelineRef.current(audioDataUrl, {
            chunk_length_s: 30,
            stride_length_s: 5,
            language: whisperConfig.language || 'english',
            task: 'transcribe',
            return_timestamps: false,
          });

          const transcriptionTime = performance.now() - transcriptionStart;
          console.log('[WHISPER TRANSCRIBE] Transcription completed in', transcriptionTime.toFixed(2), 'ms');
          console.log('[WHISPER TRANSCRIBE] Output:', {
            hasText: !!output.text,
            textLength: output.text?.length || 0,
            textPreview: output.text?.substring(0, 50) + (output.text?.length > 50 ? '...' : ''),
            hasChunks: !!output.chunks,
            chunksCount: output.chunks?.length || 0
          });

          // Processing completed
          const result: TranscriptionResult = {
            text: output.text,
            segments: output.chunks?.map((chunk, index) => ({
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

          console.log('[WHISPER TRANSCRIBE] Result formatted:', {
            text: result.text.substring(0, 50) + (result.text.length > 50 ? '...' : ''),
            segmentsCount: result.segments?.length || 0,
            timestamp: result.timestamp
          });

          setTranscript(result.text);
          setIsTranscribing(false);
          
          console.log('[WHISPER TRANSCRIBE] Transcription successful, total time:', 
            (Date.now() - startTime), 'ms');
          
          return result;
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Transcription failed');
          console.error('[WHISPER TRANSCRIBE] Transcription failed:', err);
          console.error('[WHISPER TRANSCRIBE] Error details:', {
            message: error.message,
            stack: error.stack
          });
          
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
