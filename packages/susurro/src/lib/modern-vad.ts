// Modern Neural VAD Integration
// Dual VAD System: Neural Silero VAD (primary) + Murmuraba VAD (available)

/**
 * Modern VAD Implementation using Silero VAD via ONNX Runtime Web
 * This is the industry standard replacing RNNoise and other deprecated VAD solutions
 *
 * DUAL VAD SYSTEM AVAILABLE:
 * 1. Neural VAD (this file): Silero VAD via @ricky0123/vad-web
 * 2. Murmuraba VAD: Available via MurmurabaInstance.analyzeVAD() - see murmuraba-types.ts
 */

import type { VADAnalysisResult, VoiceSegment } from './types';

// Dynamic loader for @ricky0123/vad-web (Silero VAD)
const loadSileroVAD = async () => {
  console.log('🧠 Loading Silero VAD (neural voice activity detection)...');
  const startTime = performance.now();

  try {
    const { MicVAD } = await import(
      /* webpackChunkName: "silero-vad" */
      /* webpackPreload: true */
      '@ricky0123/vad-web'
    );

    const loadTime = performance.now() - startTime;
    console.log(`✅ Silero VAD loaded in ${loadTime.toFixed(2)}ms`);

    return MicVAD;
  } catch (error) {
    console.warn('⚠️ Silero VAD not available, falling back to basic VAD');
    return null;
  }
};

// Modern VAD configuration optimized for real-time transcription
export interface ModernVADConfig {
  modelURL?: string;
  workletURL?: string;
  frameSamples?: number;
  positiveSpeechThreshold?: number;
  negativeSpeechThreshold?: number;
  preSpeechPadFrames?: number;
  postSpeechPadFrames?: number;
}

export class ModernVADEngine {
  private vad: any = null;
  private isInitialized = false;

  constructor(private config: ModernVADConfig = {}) {
    this.config = {
      // Optimized settings for real-time transcription
      frameSamples: 1536, // 32ms at 48kHz
      positiveSpeechThreshold: 0.5,
      negativeSpeechThreshold: 0.35,
      preSpeechPadFrames: 1,
      postSpeechPadFrames: 1,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const MicVAD = await loadSileroVAD();

      if (MicVAD) {
        console.log('🚀 Initializing Silero VAD with optimal settings...');

        this.vad = await MicVAD.new({
          ...this.config,
          onSpeechStart: () => {
            console.log('🎙️ Speech detected - VAD activated');
          },
          onSpeechEnd: (audio: Float32Array) => {
            console.log(`🔇 Speech ended - processed ${audio.length} samples`);
          },
        });

        this.isInitialized = true;
        console.log('✅ Modern neural VAD initialized successfully');
      } else {
        throw new Error('Silero VAD not available');
      }
    } catch (error) {
      console.warn('⚠️ Failed to initialize Silero VAD, using fallback:', error);
      this.isInitialized = false;
    }
  }

  async analyze(audioBuffer: ArrayBuffer): Promise<VADAnalysisResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Convert ArrayBuffer to Float32Array for VAD analysis
      const audioData = this.arrayBufferToFloat32Array(audioBuffer);

      if (this.vad && this.isInitialized) {
        // Use Silero VAD for advanced neural analysis
        return this.analyzeSileroVAD(audioData);
      } else {
        // Fallback to basic energy-based VAD
        return this.analyzeBasicVAD(audioData);
      }
    } catch (error) {
      console.error('VAD analysis failed:', error);

      // Return minimal result on error
      return {
        averageVad: 0,
        vadScores: [],
        metrics: [],
        voiceSegments: [],
      };
    }
  }

  private async analyzeSileroVAD(audioData: Float32Array): Promise<VADAnalysisResult> {
    const frameSize = this.config.frameSamples || 1536;
    const vadScores: number[] = [];
    const voiceSegments: VoiceSegment[] = [];

    // Process audio in frames for neural VAD
    for (let i = 0; i < audioData.length; i += frameSize) {
      const frame = audioData.slice(i, i + frameSize);

      if (frame.length === frameSize) {
        // Get VAD probability from Silero model
        const vadProb = await (this.vad as any).process(frame);
        vadScores.push(vadProb);

        // Detect voice segments based on threshold
        const isVoice = vadProb > (this.config.positiveSpeechThreshold || 0.5);

        if (isVoice) {
          const startTime = (i / audioData.length) * (audioData.length / 44100);
          const endTime = ((i + frameSize) / audioData.length) * (audioData.length / 44100);

          voiceSegments.push({
            startTime,
            endTime,
            vadScore: vadProb,
            confidence: vadProb,
          });
        }
      }
    }

    const averageVad = vadScores.reduce((a, b) => a + b, 0) / vadScores.length || 0;

    return {
      averageVad,
      vadScores,
      metrics: [
        { vad: averageVad, timestamp: Date.now() },
        { energy: voiceSegments.length, timestamp: Date.now() },
        { pitch: voiceSegments.length / vadScores.length, timestamp: Date.now() },
      ],
      voiceSegments,
    };
  }

  private analyzeBasicVAD(audioData: Float32Array): VADAnalysisResult {
    // Fallback energy-based VAD when neural VAD is not available
    // NOTE: For full Murmuraba VAD integration, use MurmurabaInstance.analyzeVAD()
    console.log(
      '📊 Using fallback energy-based VAD (for full Murmuraba VAD, use MurmurabaInstance)'
    );

    const frameSize = 1024;
    const vadScores: number[] = [];
    const threshold = 0.01; // Energy threshold

    for (let i = 0; i < audioData.length; i += frameSize) {
      const frame = audioData.slice(i, i + frameSize);

      // Calculate RMS energy
      const energy = Math.sqrt(
        frame.reduce((sum, sample) => sum + sample * sample, 0) / frame.length
      );

      vadScores.push(Math.min(1, energy / threshold));
    }

    const averageVad = vadScores.reduce((a, b) => a + b, 0) / vadScores.length || 0;

    // Simple voice segment detection
    const voiceSegments: VoiceSegment[] = [];
    let segmentStart = -1;

    vadScores.forEach((score, i) => {
      const isVoice = score > 0.3;

      if (isVoice && segmentStart === -1) {
        segmentStart = i;
      } else if (!isVoice && segmentStart !== -1) {
        const startTime = (segmentStart * frameSize) / 44100;
        const endTime = (i * frameSize) / 44100;

        voiceSegments.push({
          startTime,
          endTime,
          vadScore:
            vadScores.slice(segmentStart, i).reduce((a, b) => a + b, 0) / (i - segmentStart),
          confidence: 0.7, // Lower confidence for basic VAD
        });

        segmentStart = -1;
      }
    });

    return {
      averageVad,
      vadScores,
      metrics: [
        { vad: averageVad, timestamp: Date.now() },
        { energy: voiceSegments.length, timestamp: Date.now() },
      ],
      voiceSegments,
    };
  }

  private arrayBufferToFloat32Array(buffer: ArrayBuffer): Float32Array {
    // Convert ArrayBuffer to Float32Array for audio processing
    const view = new DataView(buffer);
    const samples = new Float32Array(buffer.byteLength / 2);

    for (let i = 0; i < samples.length; i++) {
      // Convert 16-bit PCM to float32 (-1 to 1 range)
      samples[i] = view.getInt16(i * 2, true) / 32768;
    }

    return samples;
  }

  destroy(): void {
    if (this.vad && (this.vad as any).destroy) {
      (this.vad as any).destroy();
    }
    this.vad = null;
    this.isInitialized = false;
    console.log('🧹 Modern VAD engine destroyed');
  }
}

// Singleton instance for optimal performance
let modernVADInstance: ModernVADEngine | null = null;

export const getModernVAD = (config?: ModernVADConfig): ModernVADEngine => {
  if (!modernVADInstance) {
    modernVADInstance = new ModernVADEngine(config);
  }
  return modernVADInstance;
};

export const destroyModernVAD = (): void => {
  if (modernVADInstance) {
    modernVADInstance.destroy();
    modernVADInstance = null;
  }
};
