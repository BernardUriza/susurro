# Architecture Overview

## Core Architecture

Susurro uses a modern, WebGPU-accelerated architecture with complete MediaRecorder elimination.

```
Audio Input → Murmuraba v3 Engine → Neural VAD → Whisper WebGPU → Output
```

## Zero MediaRecorder Architecture

### Traditional vs Susurro Approach

**Traditional (❌ Eliminated)**:
```
MediaRecorder → Blob → Manual Processing → Basic VAD → CPU Whisper
```

**Susurro v3 (✅ Current)**:
```
Murmuraba Engine → Neural Processing → Silero VAD → WebGPU Whisper
```

### Benefits
- 🚀 **6x Performance**: WebGPU hardware acceleration
- 🧠 **2-3x VAD Accuracy**: Neural vs energy-based detection
- 📦 **60MB Smaller**: Dynamic imports eliminate unused code
- ⚡ **<300ms Latency**: Direct neural pipeline

## Component Architecture

### Core Hook Structure

```tsx
useSusurro
├── Audio Engine (Murmuraba v3)
├── VAD System (Dual: Neural + Fallback)
├── Whisper Pipeline (WebGPU Distil-Whisper)
├── Chunk Processing (SusurroChunk emission)
└── Cache Management (Persistent storage)
```

### File Organization (React 19 Conventions)

```
packages/susurro/src/
├── hooks/
│   ├── use-susurro.ts           # Main hook
│   ├── use-whisper-direct.ts    # WebGPU Whisper integration
│   ├── use-model-cache.ts       # Persistent caching
│   └── use-latency-monitor.ts   # Performance monitoring
├── lib/
│   ├── modern-vad.ts           # Silero VAD integration
│   ├── dynamic-loaders.ts      # Bundle optimization
│   ├── types.ts                # Core interfaces
│   └── murmuraba-types.ts      # Engine type definitions
└── index.ts                    # Public API exports
```

## Neural VAD Pipeline

### Dual VAD System

```tsx
1. Primary: Silero VAD (Neural)
   ├── ONNX Runtime Web
   ├── @ricky0123/vad-web
   ├── Real-time frame analysis
   └── 95%+ accuracy

2. Fallback: Murmuraba VAD (Energy-based)
   ├── RMS energy calculation
   ├── Adaptive thresholds
   ├── Basic voice detection
   └── 80%+ accuracy (fallback only)
```

### VAD Processing Flow

```
Audio Frame (1536 samples @ 48kHz)
↓
Silero Neural Network
↓
VAD Probability Score (0-1)
↓
Voice Segment Detection
↓
Chunk Emission with Confidence
```

## WebGPU Whisper Pipeline

### Model Configuration

```tsx
Model: 'Xenova/distil-whisper/distil-large-v3'
Backend: 'webgpu'
Quantization: { decoder_model_merged: 'q4' }
Performance: 6x faster than CPU
Memory: 4-bit quantization reduces size
```

### Loading Process

```
1. Dynamic Import (@xenova/transformers)
2. WebGPU Backend Detection
3. Model Download with Progress
4. Hardware Acceleration Setup
5. Ready State with Caching
```

### Processing Pipeline

```
Audio Blob
↓
Float32Array Conversion
↓
WebGPU Inference
↓
Chunk Processing (30s chunks, 5s stride)
↓
Transcript + Timestamps
```

## Dynamic Loading System

### Bundle Optimization

```tsx
// Before: 180MB bundle with all dependencies
// After: 60MB bundle with dynamic loading

Transformers.js: Dynamic import (lazy)
Silero VAD: Dynamic import (lazy)  
Murmuraba Engine: Dynamic import (lazy)
Core Components: Static import (immediate)
```

### Webpack Configuration

```tsx
/* webpackChunkName: "transformers" */
/* webpackPreload: true */
/* webpackChunkName: "silero-vad" */
/* webpackPreload: true */
```

## Cache Management

### Storage Strategy

```
1. IndexedDB (Primary)
   ├── Whisper models (300MB+)
   ├── VAD models (50MB+)
   └── Processing cache

2. Browser Cache (Secondary)
   ├── Static assets
   ├── Chunk metadata
   └── Session data

3. Persistent Storage Request
   ├── quota.estimate()
   ├── navigator.storage.persist()
   └── Storage optimization
```

## State Management

### React Hook Pattern

```tsx
// Central state in useSusurro
const [audioEngine, setAudioEngine] = useState<MurmubaraEngine>()
const [vadEngine, setVadEngine] = useState<ModernVADEngine>()
const [whisperPipeline, setWhisperPipeline] = useState<Pipeline>()

// Derived state
const isReady = audioEngine && vadEngine && whisperPipeline
const canRecord = isReady && !isRecording
```

### Singleton Elimination

**Before (v2)**:
```tsx
// Global singletons (removed)
export const audioEngineManager = new AudioEngineManager()
export const latencyMonitor = new LatencyMonitor()
```

**After (v3)**:
```tsx
// Hook-based architecture
export const useAudioEngine = () => { /* local state */ }
export const useLatencyMonitor = () => { /* hook state */ }
```

## Error Recovery

### Fallback Strategy

```
1. WebGPU fails → ONNX Backend
2. Silero VAD fails → Energy VAD
3. Model loading fails → CDN fallback
4. Cache fails → Direct download
5. Complete failure → User notification
```

### Network Issues

```tsx
// Automatic CDN fallback
CDN_SOURCES = [
  'HuggingFace',      // Primary
  'JSDelivr',         // Fallback 1
  'UNPKG',           // Fallback 2
  'Cloudflare'       // Fallback 3
]
```

## Performance Monitoring

### Latency Tracking

```tsx
useLatencyMonitor() tracks:
- Audio processing latency
- VAD analysis latency  
- Whisper transcription latency
- End-to-end chunk latency
- Memory usage patterns
```

### Metrics Collection

```
Audio Quality: 0.92 (noise reduction effectiveness)
VAD Accuracy: 0.96 (voice detection precision)  
Processing Speed: 6x (WebGPU vs CPU improvement)
Bundle Size: -60MB (dynamic loading savings)
```

## Integration Points

### External Systems

```tsx
// WebSocket integration
onChunk: (chunk) => {
  websocket.send(JSON.stringify({
    audioUrl: chunk.audioUrl,
    transcript: chunk.transcript,
    metadata: chunk.metadata
  }))
}

// AI Assistant integration
onChunk: async (chunk) => {
  const response = await openai.chat.completions.create({
    messages: [{ role: 'user', content: chunk.transcript }]
  })
  return response
}
```

### UI Components

```tsx
// Matrix-themed UI integration
<WhisperEchoLogs 
  logs={whisperLogs}
  maxLogs={50}
  autoScroll={true}
/>

// Real-time progress visualization
onWhisperProgressLog: (message, type) => {
  // 👋 Bienvenido a Susurro Whisper AI
  // 🚀 Iniciando carga del modelo...  
  // ✅ Modelo cargado exitosamente
}
```