import { AudioResampler } from '../utils/audio-resampler'
import { EventEmitter } from './event-emitter';
import { StateManager } from './state-manager';
import { Logger } from './logger';
import { WorkerManager } from '../managers/worker-manager';
import { MetricsManager } from '../managers/metrics-manager';
import { ChunkProcessor } from '../managers/chunk-processor';
import { SimpleAGC } from '../utils/simple-agc';
import { AudioWorkletEngine } from '../engines/audio-worklet-engine';
import { SecureEventBridge } from './secure-event-bridge';
import { AudioLogger, ProcessingLogger } from '../utils/logger';
import { ErrorFactory, ErrorType, throwIf, throwIfNot } from '../utils/error-handler';
import {
  MurmubaraConfig,
  EngineEvents,
  StreamController,
  DiagnosticInfo,
  DiagnosticReport,
  MurmubaraError,
  ErrorCodes,
  ProcessingMetrics,
  ChunkConfig,
  EngineState,
} from '../types';

export class MurmubaraEngine extends EventEmitter<EngineEvents> {
  private config: Required<MurmubaraConfig>;
  private stateManager: StateManager;
  private logger: Logger;
  private workerManager: WorkerManager;
  private metricsManager: MetricsManager;
  private audioContext?: AudioContext;
  private activeStreams: Map<string, StreamController> = new Map();
  private wasmModule?: any;
  private rnnoiseState?: any;
  private inputPtr?: number;
  private outputPtr?: number;
  private initPromise?: Promise<void>;
  private cleanupTimer?: NodeJS.Timeout;
  private errorHistory: Array<{ timestamp: number; error: string }> = [];
  private agcEnabled = true;
  private agc?: SimpleAGC;
  private audioWorkletEngine?: AudioWorkletEngine;
  private useAudioWorklet = false;
  private inputGainNode?: GainNode;
  private inputGain: number = 1.0;
  private eventBridge: SecureEventBridge;
  private bridgeToken: string = '';
  
  constructor(config: MurmubaraConfig = {}) {
    super();
    
    this.config = {
      logLevel: config.logLevel || 'info',
      onLog: config.onLog || undefined,
      noiseReductionLevel: config.noiseReductionLevel || 'medium',
      bufferSize: config.bufferSize || 4096,
      algorithm: config.algorithm || 'rnnoise',
      autoCleanup: config.autoCleanup ?? true,
      cleanupDelay: config.cleanupDelay || 30000,
      useWorker: config.useWorker ?? false,
      workerPath: config.workerPath || '/murmuraba.worker.js',
      allowDegraded: config.allowDegraded ?? false,
      useAudioWorklet: config.useAudioWorklet ?? true,
      inputGain: config.inputGain ?? 1.0,
    } as Required<MurmubaraConfig>;
    
    // Validate and set input gain
    this.inputGain = Math.max(0.5, Math.min(3.0, this.config.inputGain));
    
    this.logger = new Logger('[Murmuraba]');
    this.logger.setLevel(this.config.logLevel);
    if (this.config.onLog) {
      this.logger.setLogHandler(this.config.onLog);
    }
    
    this.stateManager = new StateManager();
    this.workerManager = new WorkerManager(this.logger);
    this.metricsManager = new MetricsManager();
    this.eventBridge = SecureEventBridge.getInstance();
    this.bridgeToken = this.eventBridge.getAccessToken();
    
    this.setupEventForwarding();
    this.setupAutoCleanup();
  }
  
  private setupEventForwarding(): void {
    this.stateManager.on('state-change', (oldState, newState) => {
      this.logger.info(`State transition: ${oldState} -> ${newState}`);
      this.emit('state-change', oldState, newState);
    });
    
    this.metricsManager.on('metrics-update', (metrics) => {
      this.emit('metrics-update', metrics);
    });
  }
  
  private setupAutoCleanup(): void {
    if (!this.config.autoCleanup) return;
    
    const resetCleanupTimer = () => {
      if (this.cleanupTimer) {
        clearTimeout(this.cleanupTimer);
      }
      
      if (this.activeStreams.size === 0 && this.stateManager.isInState('ready')) {
        this.cleanupTimer = setTimeout(() => {
          this.logger.info('Auto-cleanup triggered due to inactivity');
          this.destroy();
        }, this.config.cleanupDelay);
      }
    };
    
    this.on('processing-start', () => {
      if (this.cleanupTimer) {
        clearTimeout(this.cleanupTimer);
        this.cleanupTimer = undefined;
      }
    });
    
    this.on('processing-end', resetCleanupTimer);
  }
  
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }
    
    if (!this.stateManager.canTransitionTo('initializing')) {
      throw new MurmubaraError(
        ErrorCodes.ALREADY_INITIALIZED,
        'Engine is already initialized or in an invalid state'
      );
    }
    
    this.initPromise = this.performInitialization();
    return this.initPromise;
  }
  
  private async performInitialization(): Promise<void> {
    this.stateManager.transitionTo('initializing');
    
    try {
      this.logger.info('Initializing Murmuraba engine...');
      
      // Check environment support first
      if (!this.checkEnvironmentSupport()) {
        const missing = this.getMissingFeatures();
        throw ErrorFactory.browserNotSupported(missing);
      }
      
      // Create audio context with fallbacks
      this.stateManager.transitionTo('creating-context');
      await this.initializeAudioContext();
      
      // Initialize AudioWorklet engine if enabled and supported
      await this.initializeAudioWorkletEngine();
      
      // Load WASM module with timeout
      this.stateManager.transitionTo('loading-wasm');
      await this.loadWasmModuleWithTimeout(5000);
      
      // Initialize metrics
      this.metricsManager.startAutoUpdate(100);
      
      this.stateManager.transitionTo('ready');
      this.emit('initialized');
      this.logger.info('Murmuraba engine initialized successfully');
      
    } catch (error) {
      this.stateManager.transitionTo('error');
      this.recordError(error);
      
      const murmubaraError = new MurmubaraError(
        ErrorCodes.INITIALIZATION_FAILED,
        `Initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
      this.emit('error', murmubaraError);
      
      // Try degraded mode if configured
      if (this.config.allowDegraded) {
        this.logger.warn('Attempting degraded mode initialization...');
        await this.initializeDegraded();
      } else {
        throw murmubaraError;
      }
    }
  }
  
  private checkEnvironmentSupport(): boolean {
    // Check for required APIs
    const hasAudioContext = !!(
      window.AudioContext || 
      (window as any).webkitAudioContext
    );
    const hasWebAssembly = !!window.WebAssembly;
    
    if (!hasAudioContext) {
      this.logger.error('AudioContext API not supported');
    }
    if (!hasWebAssembly) {
      this.logger.error('WebAssembly not supported');
    }
    
    return hasAudioContext && hasWebAssembly;
  }
  
  private getMissingFeatures(): string[] {
    const missing: string[] = [];
    
    if (!(window.AudioContext || (window as any).webkitAudioContext)) {
      missing.push('AudioContext');
    }
    if (!window.WebAssembly) {
      missing.push('WebAssembly');
    }
    
    return missing;
  }
  
  private async initializeAudioContext(): Promise<void> {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: 48000 });
      
      // NOTE: Don't try to resume here - browser requires user gesture
      // The context will be resumed later when user initiates recording or processing
      this.logger.info(`AudioContext created with state: ${this.audioContext.state}`);
      
      if (this.audioContext.state === 'suspended') {
        this.logger.info('AudioContext is suspended - will need user gesture to resume');
        // Emit event to notify UI that user interaction is needed
        this.emit('user-gesture-required');
      }
    } catch (error) {
      throw ErrorFactory.audioContextCreationFailed(error as Error);
    }
  }

  private async initializeAudioWorkletEngine(): Promise<void> {
    if (!this.config.useAudioWorklet) {
      this.logger.info('AudioWorklet disabled in configuration');
      return;
    }

    try {
      this.audioWorkletEngine = new AudioWorkletEngine({
        enableRNNoise: true,
        rnnoiseWasmUrl: '/rnnoise.wasm'
      });
      
      if (this.audioWorkletEngine.isAudioWorkletSupported()) {
        await this.audioWorkletEngine.initialize();
        this.useAudioWorklet = true;
        this.logger.info('AudioWorklet engine initialized successfully');
        
        // Set up performance metrics callback with error handling
        this.audioWorkletEngine.onPerformanceMetrics((metrics) => {
          try {
            this.emit('metrics-update', {
              noiseReductionLevel: metrics.noiseReduction || 0,
              processingLatency: metrics.processingTime || 0,
              inputLevel: metrics.inputLevel || 0,
              outputLevel: metrics.outputLevel || 0,
              timestamp: metrics.timestamp || Date.now(),
              frameCount: metrics.framesProcessed || 0,
              droppedFrames: metrics.bufferUnderruns || 0,
              vadLevel: metrics.vadLevel || 0,
              isVoiceActive: metrics.isVoiceActive || false
            });
          } catch (error) {
            this.logger.warn('Error emitting AudioWorklet metrics:', error);
          }
        });
      } else {
        this.logger.warn('AudioWorklet not supported by browser, falling back to ScriptProcessorNode');
        this.audioWorkletEngine = undefined;
        this.useAudioWorklet = false;
      }
    } catch (error) {
      this.logger.warn('Failed to initialize AudioWorklet engine, falling back to ScriptProcessorNode:', error);
      this.audioWorkletEngine = undefined;
      this.useAudioWorklet = false;
      
      // Record the error but don't fail initialization
      this.recordError(error);
    }
  }
  
  private async loadWasmModuleWithTimeout(timeoutMs: number): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`WASM loading timeout after ${timeoutMs}ms`)), timeoutMs);
    });
    
    try {
      await Promise.race([
        this.loadWasmModule(),
        timeoutPromise
      ]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        this.logger.error('WASM module loading timed out');
      }
      throw error;
    }
  }
  
  private recordError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.errorHistory.push({
      timestamp: Date.now(),
      error: errorMessage
    });
    
    // Keep only last 10 errors
    if (this.errorHistory.length > 10) {
      this.errorHistory.shift();
    }
  }
  
  private async initializeDegraded(): Promise<void> {
    this.logger.info('Initializing in degraded mode...');
    this.stateManager.transitionTo('degraded');
    
    // Create minimal audio context
    if (!this.audioContext) {
      try {
        await this.initializeAudioContext();
      } catch {
        this.logger.error('Failed to create audio context even in degraded mode');
        return;
      }
    }
    
    // Engine will work but without noise reduction
    this.emit('degraded-mode');
    this.logger.warn('Engine running in degraded mode - noise reduction disabled');
  }
  
  private async loadWasmModule(): Promise<void> {
    this.logger.debug('Loading WASM module...');
    
    // Check WebAssembly support
    throwIfNot(
      typeof WebAssembly !== 'undefined',
      () => ErrorFactory.featureNotSupported('WebAssembly')
    );
    
    try {
      // Dynamic import the RNNoise loader
      const { loadRNNoiseModule } = await import('../utils/rnnoise-loader');
      
      try {
        this.wasmModule = await loadRNNoiseModule();
      } catch (wasmError: any) {
        const errorMsg = wasmError?.message || String(wasmError);
        
        // Check for the specific WASM loading error
        if (errorMsg.includes('Aborted') && errorMsg.includes('wasm')) {
          throw ErrorFactory.wasmModuleLoadFailed(wasmError, {
            suggestion: 'Ensure rnnoise.wasm file exists in public/dist/ and server serves .wasm files correctly',
            expectedPath: '/dist/rnnoise.wasm',
            mimeType: 'application/wasm'
          });
        }
        
        throw ErrorFactory.wasmModuleLoadFailed(wasmError);
      }
      
      // Create RNNoise state
      this.rnnoiseState = this.wasmModule._rnnoise_create(0);
      throwIfNot(
        !!this.rnnoiseState,
        () => ErrorFactory.wasmProcessingFailed(new Error('RNNoise state creation returned null'))
      );
    } catch (error) {
      // Re-throw with proper context
      if (error instanceof Error) {
        throw error;
      }
      throw ErrorFactory.wrapError(new Error(String(error)), ErrorType.WASM_MODULE, 'Unexpected error loading WASM');
    }
    
    // Allocate memory
    this.inputPtr = this.wasmModule._malloc(480 * 4);
    this.outputPtr = this.wasmModule._malloc(480 * 4);
    
    // Warm up the model
    await this.warmupModel();
    
    this.logger.debug('WASM module loaded successfully');
  }
  
  private async warmupModel(): Promise<void> {
    this.logger.debug('Warming up noise reduction model...');
    const silentFrame = new Float32Array(480);
    
    try {
      for (let i = 0; i < 10; i++) {
        const { vad } = this.processFrame(silentFrame);
        // Silent frame should have VAD close to 0
        if (i === 9) {
          this.logger.debug(`Warmup complete. Silent frame VAD: ${vad.toFixed(3)}`);
        }
      }
    } catch (error) {
      this.logger.warn('Failed to warm up model, continuing in degraded mode');
    }
  }
  
  private processFrame(frame: Float32Array): { output: Float32Array; vad: number } {
    // REGLA 1: Verificar 480 samples exactos
    throwIf(
      frame.length !== 480,
      () => ErrorFactory.invalidAudioFormat('480 samples', `${frame.length} samples`)
    );
    
    // Check if we're in degraded mode (no WASM)
    if (!this.wasmModule || !this.rnnoiseState) {
      // In degraded mode, just pass through the audio with basic processing
      const output = new Float32Array(frame.length);
      
      // Simple noise gate as fallback
      const threshold = 0.01;
      let voiceActivity = 0;
      
      for (let i = 0; i < frame.length; i++) {
        const sample = frame[i];
        if (Math.abs(sample) < threshold) {
          output[i] = sample * 0.1; // Reduce quiet sounds
        } else {
          output[i] = sample;
          voiceActivity += Math.abs(sample);
        }
      }
      
      // Fake VAD for degraded mode
      const vad = Math.min(1.0, voiceActivity / frame.length / 0.1);
      return { output, vad };
    }
    
    // Normal WASM processing
    throwIfNot(
      !!(this.inputPtr && this.outputPtr),
      () => ErrorFactory.wasmModuleNotLoaded({ inputPtr: !!this.inputPtr, outputPtr: !!this.outputPtr })
    );
    
    // REGLA 15: Verificar datos válidos (no NaN, no undefined)
    for (let i = 0; i < frame.length; i++) {
      throwIf(
        isNaN(frame[i]) || frame[i] === undefined,
        () => ErrorFactory.invalidParameter('frame sample', 'number', frame[i], { index: i })
      );
    }
    
    // REGLA 6: ESCALAR CORRECTAMENTE - Entrada: valor * 32768
    const scaledInput = new Float32Array(480);
    for (let i = 0; i < 480; i++) {
      scaledInput[i] = frame[i] * 32768.0;
    }
    
    // REGLA 7: Escribir en HEAPF32
    const heap = this.wasmModule!.HEAPF32!;
    heap.set(scaledInput, this.inputPtr! >> 2);
    
    // REGLA 11: CAPTURAR EL VAD! Process with RNNoise
    // REGLA 13: Procesar in-place (usar mismo puntero para entrada y salida)
    const vad = this.wasmModule!._rnnoise_process_frame(
      this.rnnoiseState,
      this.inputPtr!,  // In-place: output = input
      this.inputPtr!   // In-place: usar mismo buffer
    );
    
    // Get output from the same buffer (in-place processing)
    const scaledOutput = new Float32Array(480);
    const outputHeap = this.wasmModule!.HEAPF32!;
    for (let i = 0; i < 480; i++) {
      scaledOutput[i] = outputHeap[(this.inputPtr! >> 2) + i];
    }
    
    // REGLA 6: ESCALAR CORRECTAMENTE - Salida: valor / 32768
    const output = new Float32Array(480);
    for (let i = 0; i < 480; i++) {
      output[i] = scaledOutput[i] / 32768.0;
    }
    
    // Log VAD for debugging
    if (vad > 0.5) {
      this.logger.debug(`🎤 VOICE DETECTED: VAD=${vad.toFixed(3)}`);
    }
    
    return { output, vad };
  }
  
  async processStream(
    stream: MediaStream,
    chunkConfig?: ChunkConfig
  ): Promise<StreamController> {
    this.stateManager.requireState('ready', 'processing');
    
    const streamId = this.generateStreamId();
    this.logger.info(`Processing stream ${streamId}`);
    
    try {
      const controller = await this.createStreamController(stream, streamId, chunkConfig);
      this.activeStreams.set(streamId, controller);
      
      if (this.activeStreams.size === 1) {
        this.stateManager.transitionTo('processing');
        this.emit('processing-start');
      }
      
      return controller;
      
    } catch (error) {
      const murmubaraError = new MurmubaraError(
        ErrorCodes.PROCESSING_FAILED,
        `Failed to process stream: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
      this.emit('error', murmubaraError);
      throw murmubaraError;
    }
  }
  
  private async createStreamController(
    stream: MediaStream,
    streamId: string,
    chunkConfig?: ChunkConfig
  ): Promise<StreamController> {
    throwIfNot(
      !!this.audioContext,
      () => ErrorFactory.initializationFailed('AudioContext', new Error('Audio context not initialized'))
    );
    
    // Try to use AudioWorklet if available and enabled
    if (this.audioWorkletEngine && this.useAudioWorklet) {
      return this.createAudioWorkletStreamController(stream, streamId, chunkConfig);
    } else {
      this.logger.info('Using ScriptProcessorNode for audio processing');
      return this.createScriptProcessorStreamController(stream, streamId, chunkConfig);
    }
  }

  private async createAudioWorkletStreamController(
    stream: MediaStream,
    streamId: string,
    chunkConfig?: ChunkConfig
  ): Promise<StreamController> {
    if (!this.audioContext || !this.audioWorkletEngine) {
      throw new Error('AudioWorklet engine not available');
    }

    this.logger.info('Creating AudioWorklet-based stream controller');

    try {
      const pipeline = await this.audioWorkletEngine.createProcessingPipeline({
        echoCancellation: true,
        noiseSuppression: false, // We use RNNoise instead
        autoGainControl: true
      });

      // Setup chunk processor if configured
      let chunkProcessor: ChunkProcessor | undefined;
      if (chunkConfig) {
        chunkProcessor = new ChunkProcessor(
          this.audioContext.sampleRate,
          chunkConfig,
          this.logger,
          this.metricsManager
        );
        
        // Forward chunk events
        chunkProcessor.on('chunk-processed', (metrics) => {
          this.logger.debug('Chunk processed:', metrics);
          this.metricsManager.recordChunk(metrics);
        });
        
        // TDD Integration: Forward period-complete events for RecordingManager integration
        chunkProcessor.on('period-complete', (aggregatedMetrics) => {
          this.logger.info(`🎯 [TDD-INTEGRATION] Period complete: ${aggregatedMetrics.totalFrames} frames, ${aggregatedMetrics.averageNoiseReduction.toFixed(1)}% avg reduction`);
          
          // Convert aggregated metrics to ProcessingMetrics format
          const processingMetrics: ProcessingMetrics = {
            noiseReductionLevel: aggregatedMetrics.averageNoiseReduction,
            processingLatency: aggregatedMetrics.averageLatency,
            inputLevel: 0.5, // Default value
            outputLevel: 0.5, // Default value
            frameCount: aggregatedMetrics.totalFrames,
            droppedFrames: 0, // Default value
            timestamp: aggregatedMetrics.endTime,
            vadLevel: 0.5, // Default value
            isVoiceActive: false // Default value
          };
          
          // Pass metrics through secure event bridge
          this.eventBridge.notifyMetrics(processingMetrics, this.bridgeToken);
        });
        
        // Register chunk processor with secure event bridge
        this.eventBridge.registerChunkProcessor(chunkProcessor, this.bridgeToken);
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let isPaused = false;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let isStopped = false;

      const controller: StreamController = {
        stream: pipeline.output,
        processor: {
          id: streamId,
          state: 'processing',
          inputNode: pipeline.input,
          outputNode: pipeline.workletNode,
        },
        stop: () => {
          isStopped = true;
          
          // Flush any remaining chunks
          if (chunkProcessor) {
            chunkProcessor.flush();
          }
          
          // CRITICAL: Stop all tracks in the stream to release the microphone
          stream.getTracks().forEach(track => {
            track.stop();
            this.logger.info(`🔇 Stopped stream track: ${track.kind} (${track.label})`);
          });
          
          // Disconnect audio nodes
          pipeline.workletNode.disconnect();
          pipeline.input.disconnect();
          this.activeStreams.delete(streamId);
          this.logger.info(`AudioWorklet stream ${streamId} stopped and microphone released`);
          
          if (this.activeStreams.size === 0) {
            this.stateManager.transitionTo('ready');
            this.emit('processing-end');
          }
        },
        pause: () => {
          isPaused = true;
          controller.processor.state = 'paused';
          this.logger.info(`AudioWorklet stream ${streamId} paused`);
        },
        resume: () => {
          isPaused = false;
          controller.processor.state = 'processing';
          this.logger.info(`AudioWorklet stream ${streamId} resumed`);
        },
        getState: () => controller.processor.state
      };

      return controller;

    } catch (error) {
      this.logger.error('Failed to create AudioWorklet stream controller, falling back to ScriptProcessor:', error);
      return this.createScriptProcessorStreamController(stream, streamId, chunkConfig);
    }
  }

  private async createScriptProcessorStreamController(
    stream: MediaStream,
    streamId: string,
    chunkConfig?: ChunkConfig
  ): Promise<StreamController> {
    throwIfNot(
      !!this.audioContext,
      () => ErrorFactory.initializationFailed('AudioContext', new Error('Audio context not initialized'))
    );
    
    const source = this.audioContext!.createMediaStreamSource(stream);
    const destination = this.audioContext!.createMediaStreamDestination();
    const processor = this.audioContext!.createScriptProcessor(this.config.bufferSize, 1, 1);
    
    // Create input gain node for volume control
    this.inputGainNode = this.audioContext!.createGain();
    this.inputGainNode.gain.value = this.inputGain;
    this.logger.info(`Input gain set to ${this.inputGain}x`);
    
    // Create pre-filters for medical equipment noise
    const notchFilter1 = this.audioContext!.createBiquadFilter();
    notchFilter1.type = 'notch';
    notchFilter1.frequency.value = 1000; // Common medical equipment beep frequency
    notchFilter1.Q.value = 30; // Narrow notch
    
    const notchFilter2 = this.audioContext!.createBiquadFilter();
    notchFilter2.type = 'notch';
    notchFilter2.frequency.value = 2000; // Harmonics of beeps
    notchFilter2.Q.value = 30;
    
    const highPassFilter = this.audioContext!.createBiquadFilter();
    highPassFilter.type = 'highpass';
    highPassFilter.frequency.value = 80; // Remove low-frequency rumble from machines
    highPassFilter.Q.value = 0.7;
    
    const lowShelfFilter = this.audioContext!.createBiquadFilter();
    lowShelfFilter.type = 'lowshelf';
    lowShelfFilter.frequency.value = 200; // Reduce echo/room resonance
    lowShelfFilter.gain.value = -3; // Gentle reduction
    
    // Create AGC if enabled
    let agc: SimpleAGC | undefined;
    if (this.agcEnabled) {
      agc = new SimpleAGC(this.audioContext!, 0.3);
      this.agc = agc;
    }
    
    let isPaused = false;
    let isStopped = false;
    const inputBuffer: number[] = [];
    const outputBuffer: number[] = [];
    
    // Setup chunk processor if configured
    let chunkProcessor: ChunkProcessor | undefined;
    if (chunkConfig) {
      chunkProcessor = new ChunkProcessor(
        this.audioContext!.sampleRate,
        chunkConfig,
        this.logger,
        this.metricsManager
      );
      
      // Forward chunk events
      chunkProcessor.on('chunk-processed', (metrics) => {
        this.logger.debug('Chunk processed:', metrics);
        this.metricsManager.recordChunk(metrics);
      });

    }
    
    let debugLogCount = 0;
    processor.onaudioprocess = (event) => {
      if (isStopped || isPaused) {
        event.outputBuffer.getChannelData(0).fill(0);
        return;
      }
      
      const input = event.inputBuffer.getChannelData(0);
      const output = event.outputBuffer.getChannelData(0);
      
      // Debug: Log primeros frames para verificar audio
      if (debugLogCount < 5) {
        const maxInput = Math.max(...input.map(Math.abs));
        AudioLogger.debug('Audio frame received', {
          frameNumber: debugLogCount,
          inputLength: input.length,
          maxInputLevel: maxInput.toFixed(6),
          hasAudio: maxInput > 0.0001,
          streamId: streamId
        });
        debugLogCount++;
      }
      
      // Update metrics
      // const inputLevel = this.metricsManager.calculateRMS(input);  // Reserved for future metrics
      const inputPeak = this.metricsManager.calculatePeak(input);
      this.metricsManager.updateInputLevel(inputPeak);
      
      // Update AGC if enabled
      if (agc && !isPaused && !isStopped) {
        agc.updateGain();
      }
      
      // Add to buffer
      for (let i = 0; i < input.length; i++) {
        inputBuffer.push(input[i]);
      }
      
      // If using chunk processing, add samples to chunk processor with VAD data
      if (chunkProcessor && !isPaused && !isStopped) {
        chunkProcessor.addSamples(input);
        
        // TDD Integration: Also process frame for real-time metrics accumulation
        // This feeds data to our TDD integration system
        const timestamp = Date.now();
        // Pass VAD data to chunk processor
        const vadData = this.metricsManager.getMetrics().vadLevel || 0;
        chunkProcessor.processFrame(input, timestamp, output, vadData).catch(err => {
          this.logger.debug('TDD frame processing error:', err);
        });
      }
      
      // Process frames
      let totalInputRMS = 0;
      let totalOutputRMS = 0;
      let framesProcessed = 0;
      let currentFrameVAD = 0;
      
      while (inputBuffer.length >= 480) {
        const frame = new Float32Array(inputBuffer.splice(0, 480));
        const frameInputRMS = this.metricsManager.calculateRMS(frame);
        
        const { output: processed, vad } = this.processFrame(frame);
        const frameOutputRMS = this.metricsManager.calculateRMS(processed);
        
        // Store current VAD for immediate use
        currentFrameVAD = vad;
        
        // Update VAD metrics
        this.metricsManager.updateVAD(vad);
        
        // Log significant VAD activity for debugging
        if (vad > 0.01) {
          this.logger.debug(`📊 VAD Update: current=${vad.toFixed(3)}, avg=${this.metricsManager.getAverageVAD().toFixed(3)}, active=${vad > 0.3}`);          
        }
        
        // Emit real-time metrics update for immediate UI reactivity
        if (framesProcessed % 5 === 0 || vad > 0.1) { // Emit every 5 frames OR when voice detected
          const currentMetrics = this.metricsManager.getMetrics();
          // Ensure VAD is included in emitted metrics
          currentMetrics.vadLevel = currentFrameVAD;
          currentMetrics.isVoiceActive = currentFrameVAD > 0.3;
          this.emit('metrics-update', currentMetrics);
        }
        
        // Apply noise reduction level adjustment
        const reductionFactor = this.getReductionFactor();
        for (let i = 0; i < processed.length; i++) {
          processed[i] *= reductionFactor;
          outputBuffer.push(processed[i]);
        }
        
        // Accumulate RMS values for accurate noise reduction calculation
        totalInputRMS += frameInputRMS;
        totalOutputRMS += frameOutputRMS * reductionFactor; // Account for reduction factor
        framesProcessed++;
        
        this.metricsManager.recordFrame();
      }
      
      // Output processed audio
      let outputFramesWritten = 0;
      for (let i = 0; i < output.length; i++) {
        if (outputBuffer.length > 0) {
          output[i] = outputBuffer.shift()!;
          if (Math.abs(output[i]) > 0.001) outputFramesWritten++;
        } else {
          output[i] = 0;
        }
      }
      
      // Debug: Log output frames con audio
      if (debugLogCount < 5 && outputFramesWritten > 0) {
        const maxOutput = Math.max(...output.map(Math.abs));
        ProcessingLogger.debug('Audio frame processed', {
          frameNumber: debugLogCount,
          outputLength: output.length,
          framesWithAudio: outputFramesWritten,
          maxOutputLevel: maxOutput.toFixed(6),
          outputBufferSize: outputBuffer.length
        });
      }
      
      // Update output metrics
      // const outputLevel = this.metricsManager.calculateRMS(output);  // Reserved for future metrics
      const outputPeak = this.metricsManager.calculatePeak(output);
      this.metricsManager.updateOutputLevel(outputPeak);
      
      // Track AGC gain for metrics if enabled
      if (agc) {
        const currentGain = agc.getCurrentGain();
        // This gain info will be used for diagnostics
        this.logger.debug(`AGC gain: ${currentGain.toFixed(2)}x`);
      }
      
      // Calculate noise reduction based on actual processed frames
      if (framesProcessed > 0) {
        const avgInputRMS = totalInputRMS / framesProcessed;
        const avgOutputRMS = totalOutputRMS / framesProcessed;
        const reduction = avgInputRMS > 0 ? Math.max(0, (1 - avgOutputRMS / avgInputRMS) * 100) : 0;
        this.metricsManager.updateNoiseReduction(reduction);
      }
    };
    
    // Connect filters in chain: source -> gain -> filters -> (AGC) -> processor -> destination
    source.connect(this.inputGainNode!);
    this.inputGainNode!.connect(highPassFilter);
    highPassFilter.connect(notchFilter1);
    notchFilter1.connect(notchFilter2);
    notchFilter2.connect(lowShelfFilter);
    
    if (agc) {
      // With AGC: lowShelfFilter -> AGC -> processor
      agc.connect(lowShelfFilter, processor);
    } else {
      // Without AGC: lowShelfFilter -> processor
      lowShelfFilter.connect(processor);
    }
    
    processor.connect(destination);
    
    // Debug: Verificar el stream de destino
    AudioLogger.debug('Destination stream created', {
      streamId: destination.stream.id,
      audioTracks: destination.stream.getAudioTracks().map(t => ({
        id: t.id,
        label: t.label,
        enabled: t.enabled,
        readyState: t.readyState,
        muted: t.muted
      }))
    });
    
    const controller: StreamController = {
      stream: destination.stream,
      processor: {
        id: streamId,
        state: 'processing',
        inputNode: source,
        outputNode: destination,
      },
      stop: () => {
        isStopped = true;
        
        // Flush any remaining chunks
        if (chunkProcessor) {
          chunkProcessor.flush();
        }
        
        // CRITICAL: Stop all tracks in the stream to release the microphone
        stream.getTracks().forEach(track => {
          track.stop();
          this.logger.info(`🔇 Stopped stream track: ${track.kind} (${track.label})`);
        });
        
        // Also stop the destination stream tracks if any
        if (destination.stream) {
          destination.stream.getTracks().forEach(track => {
            track.stop();
            this.logger.debug(`🔇 Stopped destination track: ${track.kind}`);
          });
        }
        
        // Disconnect audio nodes
        processor.disconnect();
        source.disconnect();
        this.activeStreams.delete(streamId);
        this.logger.info(`Stream ${streamId} stopped and microphone released`);
        
        if (this.activeStreams.size === 0) {
          this.stateManager.transitionTo('ready');
          this.emit('processing-end');
        }
      },
      pause: () => {
        isPaused = true;
        controller.processor.state = 'paused';
        this.logger.debug(`Stream ${streamId} paused`);
      },
      resume: () => {
        isPaused = false;
        controller.processor.state = 'processing';
        this.logger.debug(`Stream ${streamId} resumed`);
      },
      getState: () => controller.processor.state as EngineState,
    };
    
    return controller;
  }
  
  
  // AGC Methods for TDD
  isAGCEnabled(): boolean {
    return this.agcEnabled;
  }
  
  setAGCEnabled(enabled: boolean): void {
    this.agcEnabled = enabled;
  }
  
  getAGCConfig(): { targetLevel: number; maxGain: number; enabled: boolean } {
    return {
      targetLevel: 0.5,  // Balanced target for clear louder output
      maxGain: 3.5,      // 3.5x maximum gain for safe amplification
      enabled: this.agcEnabled
    };
  }
  
  // Public method to get reduction factor for testing
  getReductionFactor(level?: string): number {
    const targetLevel = level || this.config.noiseReductionLevel;
    // Adjusted factors to preserve volume when using AGC
    switch (targetLevel) {
      case 'low': return 1.0;
      case 'medium': return 0.9;
      case 'high': return 0.8;
      case 'auto': return 0.9;
      default: return 0.9;
    }
  }
  
  private generateStreamId(): string {
    return `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getState(): EngineState {
    return this.stateManager.getState();
  }

  isUsingAudioWorklet(): boolean {
    return this.useAudioWorklet;
  }
  
  async destroy(force: boolean = false): Promise<void> {
    if (!this.stateManager.canTransitionTo('destroying')) {
      if (force) {
        this.logger.warn('Force destroying engine');
      } else {
        throw new MurmubaraError(
          ErrorCodes.CLEANUP_FAILED,
          'Cannot destroy engine in current state'
        );
      }
    }
    
    this.stateManager.transitionTo('destroying');
    this.logger.info('Destroying Murmuraba engine...');
    
    try {
      // Stop all active streams
      for (const [id, controller] of this.activeStreams) {
        try {
          if (controller && typeof controller.stop === 'function') {
            controller.stop();
          }
        } catch (error) {
          this.logger.warn(`Failed to stop stream ${id}:`, error);
        }
      }
      this.activeStreams.clear();
      
      // Stop metrics
      this.metricsManager.stopAutoUpdate();
      
      // Terminate workers
      this.workerManager.terminateAll();
      
      // Clean up AudioWorklet engine
      if (this.audioWorkletEngine) {
        this.audioWorkletEngine.cleanup();
        this.audioWorkletEngine = undefined;
      }
      
      // Clean up WASM
      if (this.wasmModule) {
        if (this.inputPtr) this.wasmModule._free(this.inputPtr);
        if (this.outputPtr) this.wasmModule._free(this.outputPtr);
        if (this.rnnoiseState) this.wasmModule._rnnoise_destroy(this.rnnoiseState);
      }
      
      // Close audio context
      if (this.audioContext && this.audioContext.state !== 'closed') {
        try {
          await this.audioContext.close();
        } catch (error) {
          this.logger.warn('Failed to close audio context:', error);
          // Re-throw to maintain expected error behavior for tests
          throw error;
        }
      }
      
      // Clear timers
      if (this.cleanupTimer) {
        clearTimeout(this.cleanupTimer);
      }
      
      // Remove all event listeners
      this.removeAllListeners();
      
      this.stateManager.transitionTo('destroyed');
      this.emit('destroyed');
      this.logger.info('Murmuraba engine destroyed successfully');
      
    } catch (error) {
      this.stateManager.transitionTo('error');
      const murmubaraError = new MurmubaraError(
        ErrorCodes.CLEANUP_FAILED,
        `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
      this.emit('error', murmubaraError);
      throw murmubaraError;
    }
  }
  
  getMetrics(): ProcessingMetrics {
    return this.metricsManager.getMetrics();
  }
  
  onMetricsUpdate(callback: (metrics: ProcessingMetrics) => void): void {
    this.on('metrics-update', callback);
  }
  
  isActive(): boolean {
    return this.activeStreams.size > 0;
  }
  
  /**
   * Set the input gain level dynamically
   * @param gain - Gain value between 0.5 and 3.0
   */
  setInputGain(gain: number): void {
    const validatedGain = Math.max(0.5, Math.min(3.0, gain));
    this.inputGain = validatedGain;
    
    if (this.inputGainNode) {
      this.inputGainNode.gain.value = validatedGain;
      this.logger.info(`Input gain updated to ${validatedGain}x`);
    }
  }
  
  /**
   * Get the current input gain level
   */
  getInputGain(): number {
    return this.inputGain;
  }
  
  getDiagnostics(): DiagnosticInfo {
    const reactVersion = (window as any).React?.version || 'unknown';
    const capabilities = {
      hasWASM: !!window.WebAssembly,
      hasAudioContext: !!(window.AudioContext || (window as any).webkitAudioContext),
      hasWorklet: !!(window.AudioWorkletNode),
      maxChannels: this.audioContext?.destination.maxChannelCount || 0,
    };
    
    const browserInfo = {
      name: this.getBrowserName(),
      version: this.getBrowserVersion(),
      audioAPIsSupported: this.getAudioAPIsSupported(),
    };
    
    return {
      version: '1.4.0',
      engineVersion: '1.4.0',
      reactVersion,
      browserInfo,
      wasmLoaded: !!this.wasmModule,
      activeProcessors: this.activeStreams.size,
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
      processingTime: this.metricsManager.getMetrics().processingLatency,
      engineState: this.stateManager.getState(),
      capabilities,
      errors: this.errorHistory,
      initializationLog: [], // TODO: Implement log history tracking
      performanceMetrics: {
        wasmLoadTime: 0, // TODO: Track actual load times
        contextCreationTime: 0,
        totalInitTime: 0,
      },
      systemInfo: {
        memory: (performance as any).memory?.usedJSHeapSize,
      },
    };
  }
  
  private getBrowserName(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }
  
  private getBrowserVersion(): string {
    const userAgent = navigator.userAgent;
    const match = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/([\d.]+)/);
    return match ? match[2] : 'unknown';
  }
  
  private getAudioAPIsSupported(): string[] {
    const apis: string[] = [];
    if (window.AudioContext || (window as any).webkitAudioContext) apis.push('AudioContext');
    if (window.AudioWorkletNode) apis.push('AudioWorklet');
    if ((window as any).webkitAudioContext) apis.push('webkitAudioContext');
    if (window.MediaStream) apis.push('MediaStream');
    if (window.MediaRecorder) apis.push('MediaRecorder');
    return apis;
  }
  
  async runDiagnosticTests(): Promise<DiagnosticReport> {
    const report: DiagnosticReport = {
      timestamp: Date.now(),
      tests: [],
      passed: 0,
      failed: 0,
      warnings: 0,
    };
    
    // Test 1: Environment Support
    const envTest = {
      name: 'Environment Support',
      passed: false,
      message: '',
      duration: 0,
    };
    const startEnv = Date.now();
    if (this.checkEnvironmentSupport()) {
      envTest.passed = true;
      envTest.message = 'All required APIs are supported';
    } else {
      envTest.message = 'Missing required APIs';
    }
    envTest.duration = Date.now() - startEnv;
    report.tests.push(envTest);
    
    // Test 2: Audio Context Creation
    const audioTest = {
      name: 'Audio Context Creation',
      passed: false,
      message: '',
      duration: 0,
    };
    const startAudio = Date.now();
    try {
      if (!this.audioContext) {
        await this.initializeAudioContext();
      }
      audioTest.passed = true;
      audioTest.message = `Audio context created (state: ${this.audioContext?.state})`;
    } catch (error) {
      audioTest.message = `Failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    audioTest.duration = Date.now() - startAudio;
    report.tests.push(audioTest);
    
    // Test 3: WASM Module Loading
    const wasmTest = {
      name: 'WASM Module Loading',
      passed: false,
      message: '',
      duration: 0,
    };
    const startWasm = Date.now();
    if (this.wasmModule) {
      wasmTest.passed = true;
      wasmTest.message = 'WASM module already loaded';
    } else {
      wasmTest.message = 'WASM module not loaded (run initialize first)';
    }
    wasmTest.duration = Date.now() - startWasm;
    report.tests.push(wasmTest);
    
    // Test 4: Frame Processing
    const frameTest = {
      name: 'Frame Processing',
      passed: false,
      message: '',
      duration: 0,
    };
    const startFrame = Date.now();
    try {
      if (this.wasmModule && this.rnnoiseState) {
        const testFrame = new Float32Array(480);
        const { output } = this.processFrame(testFrame);
        frameTest.passed = output.length === 480;
        frameTest.message = frameTest.passed ? 'Frame processing successful' : 'Invalid output size';
      } else {
        frameTest.message = 'Engine not initialized';
      }
    } catch (error) {
      frameTest.message = `Failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    frameTest.duration = Date.now() - startFrame;
    report.tests.push(frameTest);
    
    // Calculate totals
    report.passed = report.tests.filter((t: any) => t.passed).length;
    report.failed = report.tests.filter((t: any) => !t.passed).length;
    
    return report;
  }

  /**
   * Process a WAV file with RNNoise
   * @param arrayBuffer WAV file as ArrayBuffer
   * @returns Processed WAV file as ArrayBuffer
   */
  async processFile(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    this.stateManager.requireState('ready', 'processing');
    
    this.logger.info('Processing WAV file...');
    const startTime = Date.now();
    
    // Parse WAV header
    const dataView = new DataView(arrayBuffer);
    
    // Verify RIFF header
    const riff = String.fromCharCode(
      dataView.getUint8(0),
      dataView.getUint8(1),
      dataView.getUint8(2),
      dataView.getUint8(3)
    );
    if (riff !== 'RIFF') {
      throw new Error('Not a valid WAV file: missing RIFF header');
    }
    
    // Verify WAVE format
    const wave = String.fromCharCode(
      dataView.getUint8(8),
      dataView.getUint8(9),
      dataView.getUint8(10),
      dataView.getUint8(11)
    );
    if (wave !== 'WAVE') {
      throw new Error('Not a valid WAV file: missing WAVE format');
    }
    
    // Find fmt chunk
    let fmtOffset = 12;
    let fmtFound = false;
    while (fmtOffset < dataView.byteLength - 8) {
      const chunkId = String.fromCharCode(
        dataView.getUint8(fmtOffset),
        dataView.getUint8(fmtOffset + 1),
        dataView.getUint8(fmtOffset + 2),
        dataView.getUint8(fmtOffset + 3)
      );
      const chunkSize = dataView.getUint32(fmtOffset + 4, true);
      
      if (chunkId === 'fmt ') {
        fmtFound = true;
        break;
      }
      fmtOffset += 8 + chunkSize;
    }
    
    if (!fmtFound) {
      throw new Error('Invalid WAV file: fmt chunk not found');
    }
    
    // Parse fmt chunk
    const audioFormat = dataView.getUint16(fmtOffset + 8, true);
    const numChannels = dataView.getUint16(fmtOffset + 10, true);
    const sampleRate = dataView.getUint32(fmtOffset + 12, true);
    const bitsPerSample = dataView.getUint16(fmtOffset + 22, true);
    
    // Verify format
    if (audioFormat !== 1) {
      throw new Error(`Unsupported audio format: ${audioFormat}. Only PCM (format 1) is supported`);
    }
    if (numChannels !== 1) {
      throw new Error(`Unsupported channel count: ${numChannels}. Only mono (1 channel) is supported`);
    }
    
    if (bitsPerSample !== 16) {
      throw new Error(`Unsupported bit depth: ${bitsPerSample}. Only 16-bit is supported`);
    }
    
    this.logger.info(`WAV format verified: PCM 16-bit mono ${sampleRate}Hz`);
    
    // Find data chunk
    let dataOffset = fmtOffset + 8 + dataView.getUint32(fmtOffset + 4, true);
    let dataFound = false;
    let dataSize = 0;
    
    while (dataOffset < dataView.byteLength - 8) {
      const chunkId = String.fromCharCode(
        dataView.getUint8(dataOffset),
        dataView.getUint8(dataOffset + 1),
        dataView.getUint8(dataOffset + 2),
        dataView.getUint8(dataOffset + 3)
      );
      dataSize = dataView.getUint32(dataOffset + 4, true);
      
      if (chunkId === 'data') {
        dataFound = true;
        dataOffset += 8; // Skip chunk header
        break;
      }
      dataOffset += 8 + dataSize;
    }
    
    if (!dataFound) {
      throw new Error('Invalid WAV file: data chunk not found');
    }
    
    // Extract PCM data
    let pcmData: Int16Array<ArrayBufferLike> = new Int16Array(arrayBuffer, dataOffset, dataSize / 2);
    let workingSampleRate = sampleRate;
    
    // Resample to 48kHz if needed (RNNoise requires 48kHz)
    const resamplingResult = AudioResampler.resampleToRNNoiseRate(pcmData, sampleRate, this.logger);
    pcmData = resamplingResult.resampledData;
    workingSampleRate = resamplingResult.outputSampleRate;
    
    const numSamples = pcmData.length;
    const numFrames = Math.floor(numSamples / 480);
    
    this.logger.info(`Processing ${numSamples} samples (${numFrames} frames of 480 samples) at ${workingSampleRate}Hz`);
    
    // Process audio in 480-sample frames
    const processedSamples = new Float32Array(numFrames * 480);
    let totalVAD = 0;
    let voiceFrames = 0;
    
    for (let frameIndex = 0; frameIndex < numFrames; frameIndex++) {
      const frameStart = frameIndex * 480;
      const frame = new Float32Array(480);
      
      // Convert PCM16 to Float32
      for (let i = 0; i < 480; i++) {
        frame[i] = pcmData[frameStart + i] / 32768.0;
      }
      
      // Calculate input RMS
      const inputRMS = this.metricsManager.calculateRMS(frame);
      
      // Process frame with RNNoise
      const { output, vad } = this.processFrame(frame);
      
      // Calculate output RMS
      const outputRMS = this.metricsManager.calculateRMS(output);
      const noiseReduction = inputRMS > 0 ? Math.max(0, (1 - outputRMS / inputRMS) * 100) : 0;
      
      // Log frame metrics
      this.logger.debug(
        `Frame ${frameIndex + 1}/${numFrames}: VAD=${vad.toFixed(3)}, ` +
        `InputRMS=${inputRMS.toFixed(4)}, OutputRMS=${outputRMS.toFixed(4)}, ` +
        `NoiseReduction=${noiseReduction.toFixed(1)}%`
      );
      
      // Track voice activity
      totalVAD += vad;
      if (vad > 0.5) voiceFrames++;
      
      // Apply noise reduction level adjustment
      const reductionFactor = this.getReductionFactor();
      
      // Store processed samples
      for (let i = 0; i < 480; i++) {
        processedSamples[frameStart + i] = output[i] * reductionFactor;
      }
    }
    
    // Convert Float32 back to PCM16
    const processedPCM = new Int16Array(processedSamples.length);
    for (let i = 0; i < processedSamples.length; i++) {
      // Clamp to [-1, 1] range
      const clamped = Math.max(-1, Math.min(1, processedSamples[i]));
      processedPCM[i] = Math.round(clamped * 32767);
    }
    
    // Create output WAV buffer
    const outputSize = 44 + processedPCM.length * 2; // WAV header + PCM data
    const outputBuffer = new ArrayBuffer(outputSize);
    const outputView = new DataView(outputBuffer);
    
    // Write WAV header
    // RIFF chunk
    outputView.setUint8(0, 0x52); // 'R'
    outputView.setUint8(1, 0x49); // 'I'
    outputView.setUint8(2, 0x46); // 'F'
    outputView.setUint8(3, 0x46); // 'F'
    outputView.setUint32(4, outputSize - 8, true); // File size - 8
    outputView.setUint8(8, 0x57);  // 'W'
    outputView.setUint8(9, 0x41);  // 'A'
    outputView.setUint8(10, 0x56); // 'V'
    outputView.setUint8(11, 0x45); // 'E'
    
    // fmt chunk
    outputView.setUint8(12, 0x66); // 'f'
    outputView.setUint8(13, 0x6D); // 'm'
    outputView.setUint8(14, 0x74); // 't'
    outputView.setUint8(15, 0x20); // ' '
    outputView.setUint32(16, 16, true); // fmt chunk size
    outputView.setUint16(20, 1, true); // PCM format
    outputView.setUint16(22, 1, true); // Mono
    outputView.setUint32(24, 48000, true); // Sample rate
    outputView.setUint32(28, 48000 * 2, true); // Byte rate
    outputView.setUint16(32, 2, true); // Block align
    outputView.setUint16(34, 16, true); // Bits per sample
    
    // data chunk
    outputView.setUint8(36, 0x64); // 'd'
    outputView.setUint8(37, 0x61); // 'a'
    outputView.setUint8(38, 0x74); // 't'
    outputView.setUint8(39, 0x61); // 'a'
    outputView.setUint32(40, processedPCM.length * 2, true); // Data size
    
    // Write PCM data
    const outputPCMView = new Int16Array(outputBuffer, 44);
    outputPCMView.set(processedPCM);
    
    // Log summary
    const averageVAD = totalVAD / numFrames;
    const voicePercentage = (voiceFrames / numFrames) * 100;
    const processingTime = Date.now() - startTime;
    
    this.logger.info(
      `File processing complete: ${numFrames} frames processed in ${processingTime}ms. ` +
      `Average VAD: ${averageVAD.toFixed(3)}, Voice frames: ${voicePercentage.toFixed(1)}%`
    );
    
    return outputBuffer;
  }
}