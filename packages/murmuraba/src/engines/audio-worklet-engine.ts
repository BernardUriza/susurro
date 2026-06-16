import { AudioEngine } from './types';

export interface AudioWorkletEngineConfig {
  enableRNNoise?: boolean;
  rnnoiseWasmUrl?: string;
}

export class AudioWorkletEngine implements AudioEngine {
  name = 'AudioWorklet';
  description = 'High-performance audio processing using AudioWorklet API';
  isInitialized = false;
  
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private config: AudioWorkletEngineConfig;
  private performanceCallback?: (metrics: any) => void;
  
  constructor(config: AudioWorkletEngineConfig = {}) {
    this.config = {
      enableRNNoise: config.enableRNNoise ?? true,
      rnnoiseWasmUrl: config.rnnoiseWasmUrl
    };
  }
  
  isAudioWorkletSupported(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    
    try {
      // Check if AudioContext exists
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        return false;
      }
      
      // Check if AudioWorklet class exists
      if (!(window as any).AudioWorklet) {
        return false;
      }
      
      // Create a test context to check for audioWorklet property
      const testContext = new AudioContextClass();
      const supported = 'audioWorklet' in testContext;
      
      // Clean up test context if it has close method
      if (testContext.close) {
        testContext.close();
      }
      
      return supported;
    } catch (error) {
      return false;
    }
  }
  
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    if (!this.isAudioWorkletSupported()) {
      throw new Error('AudioWorklet is not supported in this browser');
    }
    
    // Create AudioContext
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    
    // Load the AudioWorklet processor
    const processorCode = this.getProcessorCode();
    const blob = new Blob([processorCode], { type: 'application/javascript' });
    const processorUrl = URL.createObjectURL(blob);
    
    try {
      await this.audioContext!.audioWorklet.addModule(processorUrl);
      this.isInitialized = true;
    } finally {
      // Clean up the blob URL
      URL.revokeObjectURL(processorUrl);
    }
  }
  
  private getProcessorCode(): string {
    // This will be the inline AudioWorkletProcessor code
    return `
      class RNNoiseProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.isActive = true;
          this.frameSize = 480; // RNNoise frame size
          this.inputBuffer = new Float32Array(this.frameSize);
          this.bufferIndex = 0;
          this.isRNNoiseReady = false;
          this.rnnoiseModule = null;
          this.rnnoiseState = null;
          this.inputPtr = null;
          this.outputPtr = null;
          
          // Performance metrics
          this.framesProcessed = 0;
          this.processingTimeSum = 0;
          this.bufferUnderruns = 0;
          
          // Setup message handling
          this.port.onmessage = (event) => {
            this.handleMessage(event.data);
          };
        }
        
        handleMessage(message) {
          switch (message.type) {
            case 'initialize':
              if (message.data.enableRNNoise) {
                // Use wasmData if available, otherwise try wasmUrl (will warn)
                this.initializeRNNoise(message.data.wasmData || message.data.wasmUrl);
              }
              break;
            case 'updateSettings':
              // Handle settings updates
              break;
            case 'loadWASM':
              // Expects wasmData to be ArrayBuffer, not URL
              this.initializeRNNoise(message.data.wasmData || message.data.wasmUrl);
              break;
          }
        }
        
        async initializeRNNoise(wasmData) {
          try {
            // wasmData should be an ArrayBuffer passed from main thread
            // since fetch is not available in AudioWorklet context
            if (wasmData && wasmData instanceof ArrayBuffer) {
              // This is where we would instantiate the WASM module
              // For now, we just mark it as ready
              console.log('RNNoise WASM data received in AudioWorklet:', wasmData.byteLength, 'bytes');
              
              // Mark as ready (in real implementation, after WASM is instantiated)
              this.isRNNoiseReady = true;
            } else if (typeof wasmData === 'string') {
              // Legacy path - warn that fetch is not available
              console.warn('AudioWorklet: Cannot use fetch() to load WASM. Pass ArrayBuffer from main thread instead.');
              this.isRNNoiseReady = false;
            }
          } catch (error) {
            console.error('Failed to initialize RNNoise in AudioWorklet:', error);
            this.isRNNoiseReady = false;
          }
        }
        
        processFrame(frame) {
          // This is where RNNoise processing would happen
          // For now, apply simple gain reduction to simulate noise suppression
          const processed = new Float32Array(frame.length);
          for (let i = 0; i < frame.length; i++) {
            processed[i] = frame[i] * 0.8; // Simulated noise reduction
          }
          return processed;
        }
        
        process(inputs, outputs, parameters) {
          const startTime = currentFrame; // Use currentFrame instead of currentTime
          const input = inputs[0];
          const output = outputs[0];
          
          if (!input || !input[0] || !output || !output[0]) {
            this.bufferUnderruns++;
            // Still fill output with silence
            if (output && output[0]) {
              output[0].fill(0);
            }
            return this.isActive;
          }
          
          const inputChannel = input[0];
          const outputChannel = output[0];
          const frameLength = inputChannel.length;
          
          // Calculate input RMS for VAD and metrics
          let inputRMS = 0;
          for (let i = 0; i < frameLength; i++) {
            inputRMS += inputChannel[i] * inputChannel[i];
          }
          inputRMS = Math.sqrt(inputRMS / frameLength);
          
          // Direct processing for better real-time performance
          if (this.isRNNoiseReady) {
            // Process in 480-sample chunks for RNNoise
            let outputIndex = 0;
            
            for (let i = 0; i < frameLength; i++) {
              this.inputBuffer[this.bufferIndex++] = inputChannel[i];
              
              if (this.bufferIndex === this.frameSize) {
                // Process the frame
                const processedFrame = this.processFrame(this.inputBuffer);
                
                // Copy processed frame to output
                for (let j = 0; j < this.frameSize && outputIndex < frameLength; j++) {
                  outputChannel[outputIndex++] = processedFrame[j];
                }
                
                this.bufferIndex = 0;
                this.framesProcessed++;
              }
            }
            
            // Handle remaining samples in buffer by copying to output
            const remainingSamples = frameLength - outputIndex;
            for (let i = 0; i < remainingSamples && i < this.bufferIndex; i++) {
              outputChannel[outputIndex + i] = this.inputBuffer[i];
            }
          } else {
            // Pass-through mode when RNNoise is not ready
            for (let i = 0; i < frameLength; i++) {
              outputChannel[i] = inputChannel[i] * 0.8; // Apply slight attenuation
            }
          }
          
          // Calculate output RMS
          let outputRMS = 0;
          for (let i = 0; i < frameLength; i++) {
            outputRMS += outputChannel[i] * outputChannel[i];
          }
          outputRMS = Math.sqrt(outputRMS / frameLength);
          
          // Track performance
          const endTime = currentFrame;
          const processingTime = endTime - startTime;
          this.processingTimeSum += processingTime;
          
          // Send real-time metrics more frequently and with more detail
          if (this.framesProcessed % 10 === 0) { // Send every 10 audio callback frames
            this.port.postMessage({
              type: 'performance',
              metrics: {
                processingTime: this.processingTimeSum / 10,
                bufferUnderruns: this.bufferUnderruns,
                framesProcessed: this.framesProcessed,
                inputLevel: inputRMS,
                outputLevel: outputRMS,
                noiseReduction: inputRMS > 0 ? (1 - outputRMS / inputRMS) * 100 : 0,
                vadLevel: inputRMS > 0.01 ? Math.min(inputRMS * 10, 1) : 0,
                isVoiceActive: inputRMS > 0.03,
                timestamp: Date.now()
              }
            });
            this.processingTimeSum = 0;
            this.bufferUnderruns = 0;
          }
          
          return this.isActive;
        }
      }
      
      registerProcessor('rnnoise-processor', RNNoiseProcessor);
    `;
  }
  
  process(inputBuffer: Float32Array): Float32Array {
    if (!this.isInitialized) {
      throw new Error('AudioWorkletEngine not initialized');
    }
    
    // For now, return the input as-is
    // This will be replaced with actual AudioWorklet processing
    return inputBuffer;
  }
  
  async createWorkletNode(): Promise<AudioWorkletNode> {
    if (!this.isInitialized || !this.audioContext) {
      throw new Error('AudioWorkletEngine not initialized');
    }
    
    // Create the AudioWorkletNode
    this.workletNode = new AudioWorkletNode(
      this.audioContext,
      'rnnoise-processor',
      {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: {
          sampleRate: this.audioContext.sampleRate
        }
      }
    );
    
    // Set up message handler for performance metrics
    this.workletNode.port.onmessage = (event) => {
      if (event.data.type === 'performance' && this.performanceCallback) {
        this.performanceCallback(event.data.metrics);
      }
    };
    
    // Load WASM data in main thread if URL is provided
    let wasmData = null;
    if (this.config.enableRNNoise && this.config.rnnoiseWasmUrl) {
      try {
        const response = await fetch(this.config.rnnoiseWasmUrl);
        if (response.ok) {
          wasmData = await response.arrayBuffer();
          console.log('Loaded RNNoise WASM in main thread:', wasmData.byteLength, 'bytes');
        }
      } catch (error) {
        console.warn('Failed to load RNNoise WASM in main thread:', error);
      }
    }
    
    // Send initialization message with ArrayBuffer instead of URL
    this.workletNode.port.postMessage({
      type: 'initialize',
      data: {
        enableRNNoise: this.config.enableRNNoise,
        wasmData: wasmData // Send ArrayBuffer, not URL
      }
    });
    
    return this.workletNode;
  }
  
  async processWithWorklet(inputBuffer: Float32Array): Promise<Float32Array> {
    if (!this.isInitialized || !this.audioContext) {
      throw new Error('AudioWorkletEngine not initialized');
    }
    
    // Create offline context for processing
    const offlineContext = new OfflineAudioContext(
      1, // mono
      inputBuffer.length,
      this.audioContext.sampleRate
    );
    
    // Create buffer source
    const audioBuffer = offlineContext.createBuffer(1, inputBuffer.length, offlineContext.sampleRate);
    audioBuffer.copyToChannel(inputBuffer as Float32Array<ArrayBuffer>, 0);
    
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    
    // Load worklet in offline context
    const processorCode = this.getProcessorCode();
    const blob = new Blob([processorCode], { type: 'application/javascript' });
    const processorUrl = URL.createObjectURL(blob);
    
    try {
      await offlineContext.audioWorklet.addModule(processorUrl);
      
      // Create worklet node in offline context
      const workletNode = new AudioWorkletNode(
        offlineContext,
        'rnnoise-processor',
        {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1]
        }
      );
      
      // Connect nodes
      source.connect(workletNode);
      workletNode.connect(offlineContext.destination);
      
      // Start and render
      source.start();
      const renderedBuffer = await offlineContext.startRendering();
      
      // Extract the processed audio
      const outputBuffer = new Float32Array(inputBuffer.length);
      renderedBuffer.copyFromChannel(outputBuffer, 0);
      
      return outputBuffer;
    } finally {
      URL.revokeObjectURL(processorUrl);
    }
  }
  
  async createStreamProcessor(stream: MediaStream): Promise<MediaStreamAudioSourceNode> {
    if (!this.isInitialized || !this.audioContext) {
      throw new Error('AudioWorkletEngine not initialized');
    }
    
    if (!this.workletNode) {
      await this.createWorkletNode(); // Now properly await the async function
    }
    
    // Create media stream source
    const source = this.audioContext.createMediaStreamSource(stream);
    
    // Connect to worklet
    source.connect(this.workletNode!);
    
    // Connect to destination (for monitoring)
    this.workletNode!.connect(this.audioContext.destination);
    
    return source;
  }
  
  sendToWorklet(message: any): void {
    if (!this.workletNode) {
      throw new Error('Worklet node not created');
    }
    
    this.workletNode.port.postMessage(message);
  }
  
  onPerformanceMetrics(callback: (metrics: any) => void): void {
    this.performanceCallback = callback;
  }
  
  async createProcessingPipeline(constraints: any = {}): Promise<{
    input: MediaStreamAudioSourceNode;
    output: MediaStream;
    workletNode: AudioWorkletNode;
  }> {
    if (!this.isInitialized || !this.audioContext) {
      throw new Error('AudioWorkletEngine not initialized');
    }
    
    // Get user media
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: constraints.echoCancellation ?? true,
        noiseSuppression: false, // We use RNNoise instead
        autoGainControl: constraints.autoGainControl ?? true,
        ...constraints
      }
    });
    
    // Create nodes
    const input = this.audioContext.createMediaStreamSource(stream);
    const destination = this.audioContext.createMediaStreamDestination();
    
    if (!this.workletNode) {
      await this.createWorkletNode(); // Now properly await the async function
    }
    
    // Connect pipeline
    input.connect(this.workletNode!);
    this.workletNode!.connect(destination);
    
    return {
      input,
      output: destination.stream,
      workletNode: this.workletNode!
    };
  }
  
  getSupportedFeatures(): Record<string, boolean> {
    return {
      audioWorklet: this.isAudioWorkletSupported(),
      offlineProcessing: typeof OfflineAudioContext !== 'undefined',
      realtimeProcessing: true,
      performanceMetrics: true,
      wasmSupport: typeof WebAssembly !== 'undefined'
    };
  }
  
  cleanup(): void {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.isInitialized = false;
  }
}