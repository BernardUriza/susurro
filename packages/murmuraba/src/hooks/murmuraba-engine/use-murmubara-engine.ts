import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  initializeAudioEngine,
  destroyEngine,
  processStream,
  processStreamChunked,
  getEngineStatus,
  getDiagnostics,
  onMetricsUpdate,
  processFile,
  setInputGain,
  getInputGain,
  setAgcEnabled,
  isAgcEnabled,
} from '../../api';
import { getAudioConverter, AudioConverter, destroyAudioConverter } from '../../utils/audio-converter';

// Import types
import {
  UseMurmubaraEngineOptions,
  UseMurmubaraEngineReturn
} from './types';
import {
  EngineState,
  ProcessingMetrics,
  StreamController,
  DiagnosticInfo,
} from '../../types';

// Import managers
import { URLManager } from './url-manager';
import { ChunkManager } from './chunk-manager';
import { RecordingManager } from './recording-manager';
import { AudioExporter } from './audio-exporter';
import { PlaybackManager } from './playback-manager';
import { createRecordingFunctions } from './recording-functions';

// Import hooks
import { useRecordingState } from './use-recording-state';

// Import constants
import { RECORDING_UPDATE_INTERVAL, LOG_PREFIX } from './constants';

/**
 * Main Murmuraba hook with medical-grade recording functionality
 * Refactored for better maintainability
 */
export function useMurmubaraEngine(
  options: UseMurmubaraEngineOptions = {}
): UseMurmubaraEngineReturn {
  const { 
    autoInitialize = false, 
    onInitError,
    ...config 
  } = options;

  
  // State management
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engineState, setEngineState] = useState<EngineState>('uninitialized');
  const [metrics, setMetrics] = useState<ProcessingMetrics | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo | null>(null);
  const [inputGain, setInputGainState] = useState<number>(1.0);
  const [agcEnabled, setAgcEnabledState] = useState<boolean>(true);
  
  // Use dedicated recording state hook
  const {
    recordingState,
    startRecording: recordingStateStart,
    stopRecording: recordingStateStop,
    pauseRecording: recordingStatePause,
    resumeRecording: recordingStateResume,
    addChunk,
    toggleChunkPlayback: recordingStateTogglePlayback,
    toggleChunkExpansion,
    clearRecordings: recordingStateClear,
    updateRecordingTime
  } = useRecordingState();
  
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const [originalStream, setOriginalStream] = useState<MediaStream | null>(null);
  const [streamController, setStreamController] = useState<StreamController | null>(null);
  
  // Initialize managers
  const urlManagerRef = useRef<URLManager | null>(null);
  const chunkManagerRef = useRef<ChunkManager | null>(null);
  const recordingManagerRef = useRef<RecordingManager | null>(null);
  const audioExporterRef = useRef<AudioExporter | null>(null);
  const playbackManagerRef = useRef<PlaybackManager | null>(null);
  
  // Lazy initialize managers
  if (!urlManagerRef.current) {
    urlManagerRef.current = new URLManager();
  }
  if (!chunkManagerRef.current) {
    chunkManagerRef.current = new ChunkManager(urlManagerRef.current);
  }
  if (!recordingManagerRef.current) {
    recordingManagerRef.current = new RecordingManager(urlManagerRef.current);
  }
  if (!audioExporterRef.current) {
    audioExporterRef.current = new AudioExporter();
  }
  if (!playbackManagerRef.current) {
    playbackManagerRef.current = new PlaybackManager();
  }
  
  // Other refs
  const metricsUnsubscribeRef = useRef<(() => void) | null>(null);
  const initializePromiseRef = useRef<Promise<void> | null>(null);
  const audioConverterRef = useRef<AudioConverter | null>(null);
  
  // Update diagnostics
  const updateDiagnostics = useCallback(() => {
    if (!isInitialized) {
      setDiagnostics(null);
      return null;
    }
    
    try {
      const diag = getDiagnostics();
      setDiagnostics(diag);
      return diag;
    } catch {
      return null;
    }
  }, [isInitialized]);

  // Fix race condition: Update diagnostics when isInitialized changes to true
  useEffect(() => {
    if (isInitialized && !diagnostics) {
      updateDiagnostics();
    }
  }, [isInitialized, diagnostics, updateDiagnostics]);
  
  // Initialize engine
  // CRITICAL FIX: Memoize config to prevent re-initialization loops
  // Only memoize based on properties that actually exist in the config type
  const memoizedConfig = useMemo(() => config, [
    config?.bufferSize,
    config?.algorithm,
    config?.noiseReductionLevel,
    config?.logLevel,
    config?.autoCleanup,
    config?.cleanupDelay,
    config?.useWorker,
    config?.allowDegraded
  ]);

  const initialize = useCallback(async () => {
    console.log(`🚀 ${LOG_PREFIX.LIFECYCLE} Initializing MurmubaraEngine...`);
    
    // Use refs to get current values without creating dependencies
    const currentConfig = memoizedConfig;
    const currentOnInitError = onInitError;
    
    if (initializePromiseRef.current) {
      console.log(`⏳ ${LOG_PREFIX.LIFECYCLE} Already initializing, returning existing promise`);
      return initializePromiseRef.current;
    }
    
    if (isInitialized) {
      console.log(`✅ ${LOG_PREFIX.LIFECYCLE} Already initialized, skipping`);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    initializePromiseRef.current = (async () => {
      try {
        console.log(`🔧 ${LOG_PREFIX.LIFECYCLE} Calling initializeAudioEngine with config:`, currentConfig);
        await initializeAudioEngine(currentConfig);
        
        // Set up metrics listener with throttling to prevent excessive re-renders
        // Throttle to 500ms (2 updates per second) instead of 100ms (10 updates per second)
        let lastUpdate = 0;
        let pendingMetrics: ProcessingMetrics | null = null;
        let timeoutId: NodeJS.Timeout | null = null;
        
        const throttledSetMetrics = (newMetrics: ProcessingMetrics) => {
          const now = Date.now();
          const timeSinceLastUpdate = now - lastUpdate;
          
          if (timeSinceLastUpdate >= 500) {
            // Enough time has passed, update immediately
            setMetrics(newMetrics);
            lastUpdate = now;
            pendingMetrics = null;
          } else {
            // Store the latest metrics and schedule an update
            pendingMetrics = newMetrics;
            if (!timeoutId) {
              timeoutId = setTimeout(() => {
                if (pendingMetrics) {
                  setMetrics(pendingMetrics);
                  lastUpdate = Date.now();
                  pendingMetrics = null;
                }
                timeoutId = null;
              }, 500 - timeSinceLastUpdate);
            }
          }
        };
        
        const unsubscribe = onMetricsUpdate(throttledSetMetrics);
        metricsUnsubscribeRef.current = () => {
          unsubscribe();
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        };
        
        // Initialize audio converter
        audioConverterRef.current = getAudioConverter();
        audioExporterRef.current!.setAudioConverter(audioConverterRef.current);
        
        setIsInitialized(true);
        setEngineState('ready');
        console.log(`🎉 ${LOG_PREFIX.LIFECYCLE} Engine initialized successfully!`);
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize audio engine';
        console.error(`❌ ${LOG_PREFIX.LIFECYCLE} Initialization failed:`, errorMessage);
        setError(errorMessage);
        setEngineState('error');
        
        if (currentOnInitError) {
          currentOnInitError(err instanceof Error ? err : new Error(errorMessage));
        }
        
        throw err;
      } finally {
        setIsLoading(false);
        initializePromiseRef.current = null;
      }
    })();
    
    return initializePromiseRef.current;
  }, []); // CRITICAL FIX: Empty dependency array - use refs for current values
  
  // Destroy engine
  const destroy = useCallback(async (force: boolean = false) => {
    console.log(`🔥 ${LOG_PREFIX.LIFECYCLE} Destroying engine...`, { force });
    if (!isInitialized) {
      console.log(`⚠️ ${LOG_PREFIX.LIFECYCLE} Engine not initialized, skipping destroy`);
      return;
    }
    
    try {
      // Stop any ongoing recording
      if (recordingState.isRecording) {
        console.log(`🛑 ${LOG_PREFIX.LIFECYCLE} Stopping ongoing recording before destroy`);
        recordingManagerRef.current?.stopRecording();
      }
      
      // Clean up event listeners
      if (metricsUnsubscribeRef.current) {
        metricsUnsubscribeRef.current();
        metricsUnsubscribeRef.current = null;
      }
      
      // CRITICAL: Destroy audio converter to prevent memory leaks
      destroyAudioConverter();
      
      // DON'T revoke URLs - keep chunks playable after engine destroy
      // urlManagerRef.current!.revokeAllUrls();
      
      await destroyEngine({ force });
      setIsInitialized(false);
      setEngineState('destroyed');
      setMetrics(null);
      setDiagnostics(null);
      console.log(`💀 ${LOG_PREFIX.LIFECYCLE} Engine destroyed successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      throw err;
    }
  }, [isInitialized, recordingState.isRecording]);
  
  // Export functions (delegated to AudioExporter)
  const exportChunkAsWav = useCallback(async (
    chunkId: string,
    audioType: 'processed' | 'original'
  ): Promise<Blob> => {
    const chunk = chunkManagerRef.current!.findChunk(recordingState.chunks, chunkId);
    if (!chunk) throw new Error(`Chunk not found: ${chunkId}`);
    
    return audioExporterRef.current!.exportChunkAsWav(chunk, audioType);
  }, [recordingState.chunks]);
  
  const exportChunkAsMp3 = useCallback(async (
    chunkId: string,
    audioType: 'processed' | 'original',
    bitrate?: number
  ): Promise<Blob> => {
    const chunk = chunkManagerRef.current!.findChunk(recordingState.chunks, chunkId);
    if (!chunk) throw new Error(`Chunk not found: ${chunkId}`);
    
    return audioExporterRef.current!.exportChunkAsMp3(chunk, audioType, bitrate);
  }, [recordingState.chunks]);
  
  const downloadChunk = useCallback(async (
    chunkId: string,
    format: 'webm' | 'wav' | 'mp3',
    audioType: 'processed' | 'original'
  ): Promise<void> => {
    const chunk = chunkManagerRef.current!.findChunk(recordingState.chunks, chunkId);
    if (!chunk) throw new Error(`Chunk not found: ${chunkId}`);
    
    return audioExporterRef.current!.downloadChunk(chunk, format, audioType);
  }, [recordingState.chunks]);

  const downloadAllChunksAsZip = useCallback(async (
    audioType: 'processed' | 'original' | 'both' = 'both'
  ): Promise<void> => {
    return audioExporterRef.current!.downloadAllChunksAsZip(recordingState.chunks, audioType);
  }, [recordingState.chunks]);
  
  // Utility functions
  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);
  
  /**
   * Set the input gain level
   */
  const updateInputGain = useCallback((gain: number) => {
    try {
      if (!isInitialized) {
        throw new Error('Engine not initialized');
      }
      setInputGain(gain);
      setInputGainState(gain);
      console.log(`[${LOG_PREFIX}] Input gain set to ${gain}x`);
    } catch (error) {
      console.error(`[${LOG_PREFIX}] Failed to set input gain:`, error);
      setError(error instanceof Error ? error.message : 'Failed to set input gain');
    }
  }, [isInitialized]);
  
  /**
   * Get the current input gain level
   */
  const getCurrentInputGain = useCallback(() => {
    try {
      if (!isInitialized) {
        return inputGain;
      }
      const gain = getInputGain();
      setInputGainState(gain);
      return gain;
    } catch (error) {
      console.error(`[${LOG_PREFIX}] Failed to get input gain:`, error);
      return inputGain;
    }
  }, [isInitialized, inputGain]);
  
  const updateAgcEnabled = useCallback(async (enabled: boolean) => {
    try {
      if (!isInitialized) {
        throw new Error('Engine not initialized');
      }
      setAgcEnabled(enabled);
      setAgcEnabledState(enabled);
      console.log(`[${LOG_PREFIX}] AGC ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error(`[${LOG_PREFIX}] Failed to set AGC enabled:`, error);
      setError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }, [isInitialized]);
  
  const getAgcEnabled = useCallback(() => {
    try {
      if (!isInitialized) {
        return agcEnabled;
      }
      const enabled = isAgcEnabled();
      setAgcEnabledState(enabled);
      return enabled;
    } catch (error) {
      console.error(`[${LOG_PREFIX}] Failed to get AGC enabled:`, error);
      return agcEnabled;
    }
  }, [isInitialized, agcEnabled]);
  
  const getAverageNoiseReduction = useCallback(() => {
    return chunkManagerRef.current!.getAverageNoiseReduction(recordingState.chunks);
  }, [recordingState.chunks]);
  
  // Reinitialize function for fresh start
  const reinitialize = useCallback(async () => {
    console.log(`♻️ ${LOG_PREFIX.LIFECYCLE} Reinitializing engine...`);
    if (isInitialized) {
      await destroy(true);
    }
    await initialize();
  }, [isInitialized, destroy, initialize]);
  
  // Create recording functions
  const recordingFunctions = createRecordingFunctions({
    isInitialized,
    recordingState,
    recordingStateHook: {
      recordingState,
      startRecording: recordingStateStart,
      stopRecording: recordingStateStop,
      pauseRecording: recordingStatePause,
      resumeRecording: recordingStateResume,
      addChunk,
      toggleChunkPlayback: recordingStateTogglePlayback,
      toggleChunkExpansion,
      clearRecordings: recordingStateClear,
      updateRecordingTime
    },
    currentStream,
    originalStream,
    setCurrentStream,
    setOriginalStream,
    setStreamController,
    setError,
    chunkManager: chunkManagerRef.current,
    recordingManager: recordingManagerRef.current,
    initialize
  });
  
  // Playback functions
  const toggleChunkPlayback = useCallback(async (
    chunkId: string,
    audioType: 'processed' | 'original'
  ): Promise<void> => {
    const chunk = chunkManagerRef.current!.findChunk(recordingState.chunks, chunkId);
    if (!chunk) return;
    
    await playbackManagerRef.current!.toggleChunkPlayback(
      chunk,
      audioType,
      (id, isPlaying) => {
        recordingStateTogglePlayback(id, isPlaying, audioType);
      }
    );
  }, [recordingState.chunks, recordingStateTogglePlayback]);
  
  // Effects
  
  // Auto-initialize
  useEffect(() => {
    if (autoInitialize && !isInitialized && !isLoading) {
      console.log(`🤖 ${LOG_PREFIX.LIFECYCLE} Auto-initializing engine...`);
      initialize();
    }
  }, [autoInitialize, isInitialized, isLoading, initialize]);
  
  // Update recording time
  useEffect(() => {
    if (recordingState.isRecording && !recordingState.isPaused) {
      const startTime = Date.now() - recordingState.recordingTime * 1000;
      const interval = setInterval(() => {
        updateRecordingTime(Math.floor((Date.now() - startTime) / 1000));
      }, RECORDING_UPDATE_INTERVAL);
      
      return () => clearInterval(interval);
    }
  }, [recordingState.isRecording, recordingState.isPaused, recordingState.recordingTime, updateRecordingTime]);
  
  // Update engine state periodically
  useEffect(() => {
    if (!isInitialized) return;
    
    const interval = setInterval(() => {
      try {
        const status = getEngineStatus();
        setEngineState(status as EngineState);
      } catch {
        // Engine might be destroyed
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isInitialized]);
  
  // Cleanup on unmount
  useEffect(() => {
    console.log(`🌟 ${LOG_PREFIX.LIFECYCLE} Component mounted, setting up cleanup handler`);
    
    // Capture refs for cleanup
    const urlManager = urlManagerRef.current;
    const playbackManager = playbackManagerRef.current;
    const recordingManager = recordingManagerRef.current;
    
    return () => {
      console.log(`👋 ${LOG_PREFIX.LIFECYCLE} Component unmounting, cleaning up...`);
      
      // CRITICAL: Destroy audio converter to prevent memory leaks
      destroyAudioConverter();
      
      // Clean up recording manager
      recordingManager?.cleanup();
      
      // Clean up all URLs
      urlManager?.revokeAllUrls();
      
      // Clean up audio elements
      playbackManager?.cleanup();
    };
  }, []);
  
  return {
    // State
    isInitialized,
    isLoading,
    error,
    engineState,
    metrics,
    diagnostics,
    inputGain,
    
    // Recording State
    recordingState,
    currentStream,
    streamController,
    
    // Actions
    initialize,
    reinitialize,
    destroy,
    processStream,
    processStreamChunked,
    processFile,
    
    // Recording Actions
    startRecording: recordingFunctions.startRecording,
    stopRecording: recordingFunctions.stopRecording,
    pauseRecording: recordingFunctions.pauseRecording,
    resumeRecording: recordingFunctions.resumeRecording,
    clearRecordings: recordingFunctions.clearRecordings,
    
    // Audio Playback Actions
    toggleChunkPlayback,
    toggleChunkExpansion,
    
    // Export Actions
    exportChunkAsWav,
    exportChunkAsMp3,
    downloadChunk,
    downloadAllChunksAsZip,
    
    // Gain Control
    setInputGain: updateInputGain,
    getInputGain: getCurrentInputGain,
    
    // AGC Control
    agcEnabled,
    setAgcEnabled: updateAgcEnabled,
    getAgcEnabled,
    
    // Utility
    getDiagnostics: updateDiagnostics,
    resetError: () => setError(null),
    formatTime,
    getAverageNoiseReduction,
  };
}