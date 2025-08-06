# API Reference

## useSusurro Hook

The main hook providing neural audio processing and Whisper transcription.

```tsx
import { useSusurro } from 'susurro'

const {
  // Recording Controls
  startRecording,
  stopRecording,
  isRecording,
  
  // Transcription State
  transcriptions,
  isProcessing,
  
  // Model Status
  whisperReady,
  whisperProgress,
  whisperError,
  
  // VAD Metrics
  averageVad,
  vadAnalysis,
  
  // Modern Features
  conversationalChunks
} = useSusurro(options)
```

### Options Interface

```tsx
interface UseSusurroOptions {
  // Audio Configuration
  chunkDurationMs?: number; // Default: 6000
  enableVAD?: boolean; // Default: true
  
  // Whisper Configuration
  whisperConfig?: {
    language?: string; // Default: 'english'
    model?: string; // Default: 'Xenova/distil-whisper/distil-large-v3'
  };
  
  // Progress Logging
  onWhisperProgressLog?: (
    message: string, 
    type?: 'info' | 'warning' | 'error' | 'success'
  ) => void;
  
  // Conversational Mode
  conversational?: {
    onChunk?: (chunk: SusurroChunk) => void;
    enableInstantTranscription?: boolean;
    chunkTimeout?: number;
  };
}
```

## Dual VAD System API

### Modern Neural VAD (Primary)

```tsx
import { getModernVAD, destroyModernVAD } from 'susurro'

const vadEngine = getModernVAD({
  frameSamples: 1536, // 32ms at 48kHz
  positiveSpeechThreshold: 0.5,
  negativeSpeechThreshold: 0.35,
  preSpeechPadFrames: 1,
  postSpeechPadFrames: 1
})

// Initialize neural VAD
await vadEngine.initialize()

// Analyze audio
const analysis = await vadEngine.analyze(audioBuffer)

// Cleanup
destroyModernVAD()
```

### Murmuraba VAD (Available)

```tsx
import type { MurmurabaInstance } from 'susurro'

// Murmuraba VAD is available through the MurmurabaInstance
const murmubaraInstance: MurmurabaInstance = /* get your instance */

// Analyze VAD with Murmuraba
const vadResult = await murmubaraInstance.analyzeVAD?.(audioBuffer)

console.log('Murmuraba VAD metrics:', vadResult?.metrics)
console.log('Average VAD score:', vadResult?.averageVad)
```

### VAD Analysis Result

```tsx
interface VADAnalysisResult {
  averageVad: number; // 0-1 voice activity score
  vadScores: number[]; // Per-frame VAD scores
  metrics: Array<{ name: string; value: number }>;
  voiceSegments: VoiceSegment[];
}

interface VoiceSegment {
  startTime: number;
  endTime: number;
  vadScore: number;
  confidence: number;
}
```

## SusurroChunk Interface

```tsx
interface SusurroChunk {
  id: string;
  audioUrl: string; // Neural-processed audio Blob URL
  transcript: string; // Whisper transcription
  startTime: number;
  endTime: number;
  vadScore: number; // 0-1 voice confidence
  isComplete: boolean;
  processingLatency?: number;
  metadata?: {
    audioQuality?: number;
    noiseLevel?: number;
    enhancement?: string[];
    [key: string]: any;
  };
}
```

## Whisper Integration

### Direct Whisper Access

```tsx
const { transcribeWithWhisper } = useSusurro()

const result = await transcribeWithWhisper(audioBlob, {
  language: 'english',
  chunk_length_s: 30,
  stride_length_s: 5
})
```

### Model Loading Events

```tsx
useSusurro({
  onWhisperProgressLog: (message, type) => {
    // Progress messages in Spanish with emojis
    // 🚀 Iniciando carga del modelo...
    // 📥 Descargando modelo... 45%
    // ✅ Modelo cargado exitosamente
  }
})
```

## Dynamic Imports

```tsx
import { 
  loadTransformers, 
  loadMurmubaraEngine,
  preloadCriticalDependencies 
} from 'susurro/lib/dynamic-loaders'

// Manual loading
const transformers = await loadTransformers()
const murmuraba = await loadMurmubaraEngine()

// Background preloading
await preloadCriticalDependencies()
```

## Latency Monitoring

```tsx
import { useLatencyMonitor } from 'susurro'

const { 
  processingLatency,
  vadLatency,
  transcriptionLatency,
  totalLatency 
} = useLatencyMonitor()
```

## Cache Management

```tsx
import { useModelCache } from 'susurro'

const { 
  cacheStatus,
  requestPersistentStorage,
  clearCache 
} = useModelCache()

// Request persistent storage
await requestPersistentStorage()

// Check cache status
console.log(cacheStatus.hasCache) // boolean
console.log(cacheStatus.size) // bytes
```

## Error Handling

```tsx
const { whisperError } = useSusurro()

useEffect(() => {
  if (whisperError) {
    console.error('Whisper error:', whisperError.message)
    // Common errors:
    // - "Model not ready"
    // - "Network configuration issue"
    // - "Model loading timeout"
  }
}, [whisperError])
```

## Types Export

```tsx
import type {
  UseSusurroOptions,
  UseSusurroReturn,
  SusurroChunk,
  VADAnalysisResult,
  VoiceSegment,
  ModernVADConfig,
  TranscriptionResult,
  WhisperConfig,
  // Murmuraba VAD Types
  MurmurabaInstance,
  MurmurabaConfig,
  MurmurabaMetrics,
  MurmurabaResult
} from 'susurro'
```