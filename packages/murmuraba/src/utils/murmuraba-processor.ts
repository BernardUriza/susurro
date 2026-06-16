import { AudioEngine, ProcessingMetrics } from '../engines/types';

export class MurmurabaProcessor {
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private engine: AudioEngine | null = null;
  private inputBuffer: number[] = [];
  private outputBuffer: number[] = [];
  private metrics: ProcessingMetrics = {
    inputSamples: 0,
    outputSamples: 0,
    silenceFrames: 0,
    activeFrames: 0,
    totalInputEnergy: 0,
    totalOutputEnergy: 0,
    peakInput: 0,
    peakOutput: 0,
    startTime: Date.now(),
    totalFrames: 0
  };

  constructor(private frameSize: number = 480) {}

  async initialize(engine: AudioEngine, sampleRate: number = 48000): Promise<void> {
    if (!engine.isInitialized) {
      await engine.initialize();
    }
    
    this.engine = engine;
    this.audioContext = new AudioContext({ sampleRate });
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => this.processAudio(e);
  }

  private processAudio(e: AudioProcessingEvent): void {
    if (!this.engine) return;

    const input = e.inputBuffer.getChannelData(0);
    const output = e.outputBuffer.getChannelData(0);
    
    // Add to input buffer
    for (let i = 0; i < input.length; i++) {
      this.inputBuffer.push(input[i]);
      this.metrics.inputSamples++;
      this.metrics.peakInput = Math.max(this.metrics.peakInput, Math.abs(input[i]));
    }
    
    // Process frames
    while (this.inputBuffer.length >= this.frameSize) {
      const frame = new Float32Array(this.inputBuffer.splice(0, this.frameSize));
      const processedFrame = this.engine.process(frame);
      
      // Update metrics
      this.metrics.totalFrames++;
      const inputEnergy = this.calculateRMS(frame);
      const outputEnergy = this.calculateRMS(processedFrame);
      this.metrics.totalInputEnergy += inputEnergy;
      this.metrics.totalOutputEnergy += outputEnergy;
      
      if (outputEnergy < 0.001) {
        this.metrics.silenceFrames++;
      } else {
        this.metrics.activeFrames++;
      }
      
      // Add to output buffer
      for (let i = 0; i < processedFrame.length; i++) {
        this.outputBuffer.push(processedFrame[i]);
      }
    }
    
    // Output
    for (let i = 0; i < output.length; i++) {
      if (this.outputBuffer.length > 0) {
        const sample = this.outputBuffer.shift()!;
        output[i] = sample;
        this.metrics.outputSamples++;
        this.metrics.peakOutput = Math.max(this.metrics.peakOutput, Math.abs(sample));
      } else {
        output[i] = 0;
      }
    }
  }

  private calculateRMS(frame: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < frame.length; i++) {
      sum += frame[i] * frame[i];
    }
    return Math.sqrt(sum / frame.length);
  }

  connectStream(stream: MediaStream): MediaStreamAudioDestinationNode {
    if (!this.audioContext || !this.processor) {
      throw new Error('Processor not initialized');
    }
    
    const source = this.audioContext.createMediaStreamSource(stream);
    const destination = this.audioContext.createMediaStreamDestination();
    
    source.connect(this.processor);
    this.processor.connect(destination);
    
    return destination;
  }

  getMetrics(): ProcessingMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      inputSamples: 0,
      outputSamples: 0,
      silenceFrames: 0,
      activeFrames: 0,
      totalInputEnergy: 0,
      totalOutputEnergy: 0,
      peakInput: 0,
      peakOutput: 0,
      startTime: Date.now(),
      totalFrames: 0
    };
  }

  cleanup(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.engine) {
      this.engine.cleanup();
      this.engine = null;
    }
  }
}