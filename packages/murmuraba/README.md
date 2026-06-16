# 🎵 Murmuraba - Real-time Neural Noise Reduction with Chunked Streaming

[![npm version](https://img.shields.io/npm/v/murmuraba.svg)](https://www.npmjs.com/package/murmuraba)
[![React](https://img.shields.io/badge/React-19.1.1-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Professional-grade real-time audio streaming with neural noise reduction using RNNoise WASM. Process long recordings efficiently with automatic chunking - no need to wait for recording completion. Now with advanced Voice Activity Detection (VAD) capabilities!

## 🚀 Why Murmuraba?

Traditional audio recording libraries make you wait until the user stops recording to process the entire audio file. This approach fails for:
- Long recordings (podcasts, meetings, interviews)
- Real-time transcription needs
- Live streaming applications
- Memory-constrained environments

**Murmuraba solves this with automatic chunked streaming**: Audio is processed in real-time segments while recording continues, giving you instant access to processed chunks with neural noise reduction applied.

## 📦 Installation

```bash
npm install murmuraba
```

## 🎯 Core Concept: The Hook-First Approach

Murmuraba is built around the powerful `useMurmubaraEngine` hook that handles everything:

```typescript
import { useMurmubaraEngine } from 'murmuraba';

function YourAudioApp() {
  const {
    recordingState,      // Real-time state with chunks array
    startRecording,      // Start chunked recording
    stopRecording,       // Stop and cleanup
    // ... more controls
  } = useMurmubaraEngine();
  
  // Your custom UI here
}
```

## 🔄 The Chunked Streaming Flow

### How It Works

```
Microphone Input (Continuous Stream)
         ↓
    [8 seconds] → Chunk 1 → Process → Noise Reduced → Available Immediately
         ↓
    [8 seconds] → Chunk 2 → Process → Noise Reduced → Available Immediately
         ↓
    [8 seconds] → Chunk 3 → Process → Noise Reduced → Available Immediately
         ↓
    ... continues until stop
```

Each chunk is processed independently with:
- **Neural noise reduction** via RNNoise
- **Dual audio URLs** (original + processed) 
- **Real-time metrics** (VAD, noise levels)
- **Instant availability** for playback/export/upload

### Basic Implementation

```typescript
import { useMurmubaraEngine } from 'murmuraba';
import { useEffect } from 'react';

function StreamingRecorder() {
  const {
    recordingState,
    startRecording,
    stopRecording,
    exportChunkAsWav,
  } = useMurmubaraEngine({
    defaultChunkDuration: 8  // 8-second chunks
  });

  // Watch for new chunks in real-time
  useEffect(() => {
    const latestChunk = recordingState.chunks[recordingState.chunks.length - 1];
    
    if (latestChunk) {
      console.log('New chunk available!', {
        id: latestChunk.id,
        duration: latestChunk.duration,
        processedUrl: latestChunk.processedAudioUrl,  // Noise-reduced audio
        originalUrl: latestChunk.originalAudioUrl,    // Raw microphone input
        noiseReduction: latestChunk.noiseRemoved      // Percentage reduced
      });
      
      // You can immediately:
      // - Play it back
      // - Send to server
      // - Transcribe it
      // - Export it
      // No need to wait for recording to finish!
    }
  }, [recordingState.chunks.length]);

  return (
    <div>
      <button onClick={() => startRecording(10)}>
        Start Recording (10s chunks)
      </button>
      <button onClick={stopRecording}>Stop</button>
      
      {/* Real-time chunk list */}
      {recordingState.chunks.map(chunk => (
        <div key={chunk.id}>
          Chunk {chunk.index}: {chunk.duration}ms
          <audio src={chunk.processedAudioUrl} controls />
          <button onClick={() => exportChunkAsWav(chunk.id)}>
            Export WAV
          </button>
        </div>
      ))}
    </div>
  );
}
```

## 🧠 Neural Noise Reduction with RNNoise

Every audio chunk passes through RNNoise, a recurrent neural network trained on thousands of hours of speech data. This happens in real-time using WebAssembly for native performance.

### The Processing Pipeline

```typescript
// What happens inside each chunk:
Raw Audio → RNNoise Neural Network → Clean Audio
           ↓
    - Removes background noise
    - Preserves voice clarity  
    - Maintains natural sound
    - ~85% noise reduction
```

### Comparing Original vs Processed

```typescript
function NoiseComparison() {
  const { recordingState, toggleChunkPlayback } = useMurmubaraEngine();
  
  return (
    <div>
      {recordingState.chunks.map(chunk => (
        <div key={chunk.id}>
          {/* Play original (noisy) */}
          <button onClick={() => toggleChunkPlayback(chunk.id, 'original')}>
            Play Original
          </button>
          
          {/* Play processed (clean) */}
          <button onClick={() => toggleChunkPlayback(chunk.id, 'processed')}>
            Play Processed
          </button>
          
          <span>Noise Reduced: {chunk.noiseRemoved}%</span>
        </div>
      ))}
    </div>
  );
}
```

## 📊 Real-time Chunk Data Structure

Each chunk in `recordingState.chunks` contains:

```typescript
interface ProcessedChunk {
  // Identifiers
  id: string;                      // Unique chunk ID
  index: number;                   // Sequential index (0, 1, 2...)
  
  // Audio URLs (Blob URLs ready for immediate use)
  processedAudioUrl?: string;      // blob:http://... (noise-reduced)
  originalAudioUrl?: string;       // blob:http://... (raw input)
  
  // Timing
  duration: number;                // Duration in milliseconds
  startTime: number;               // Recording start timestamp
  endTime: number;                 // Recording end timestamp
  
  // Processing Metrics
  noiseRemoved: number;            // Noise reduction % (0-100)
  averageVad: number;              // Voice activity average (0-1)
  vadData: VadPoint[];             // Voice activity timeline
  
  // Quality Metrics
  metrics: {
    processingLatency: number;     // Processing time in ms
    frameCount: number;            // Audio frames processed
    inputLevel: number;            // Input volume (0-1)
    outputLevel: number;           // Output volume (0-1)
    noiseReductionLevel: number;  // Reduction applied (0-1)
  };
  
  // File Information
  originalSize: number;            // Original blob size in bytes
  processedSize: number;           // Processed blob size in bytes
  
  // State
  isPlaying: boolean;              // Currently playing
  isExpanded: boolean;             // UI expanded state
  isValid: boolean;                // Processing succeeded
  errorMessage?: string;           // Error details if failed
}
```

## 🎮 Complete Hook API

```typescript
const {
  // 📊 State
  recordingState: {
    isRecording: boolean,          // Currently recording
    isPaused: boolean,              // Recording paused
    chunks: ProcessedChunk[],       // All processed chunks
    recordingTime: number,          // Total recording duration
    currentChunkTime: number,       // Current chunk progress
    playingChunks: Set<string>,     // Currently playing chunk IDs
    expandedChunk: string | null,   // Expanded chunk ID
  },
  
  // 🎙️ Recording Controls
  startRecording: (chunkDuration?: number) => Promise<void>,
  stopRecording: () => void,
  pauseRecording: () => void,
  resumeRecording: () => void,
  clearRecordings: () => void,
  
  // 🔊 Playback Controls
  toggleChunkPlayback: (chunkId: string, type?: 'processed' | 'original') => Promise<void>,
  stopAllPlayback: () => void,
  
  // 💾 Export Functions
  exportChunkAsWav: (chunkId: string, type?: 'processed' | 'original') => Promise<void>,
  exportChunkAsMp3: (chunkId: string, type?: 'processed' | 'original') => Promise<void>,
  downloadChunk: (chunkId: string, format: 'wav' | 'mp3', type?: 'processed' | 'original') => Promise<void>,
  exportAllChunks: () => Promise<void>,
  
  // 🎚️ Audio Controls
  inputGain: number,                 // Current gain (0.5-3.0)
  setInputGain: (gain: number) => void,
  agcEnabled: boolean,               // Auto gain control
  setAgcEnabled: (enabled: boolean) => Promise<void>,
  
  // 🔧 Engine Management
  isInitialized: boolean,
  isLoading: boolean,
  error: string | null,
  initialize: () => Promise<void>,
  reinitialize: () => Promise<void>,
  metrics: ProcessingMetrics | null,
  diagnostics: EngineDiagnostics | null,
  
} = useMurmubaraEngine(options);
```

## 🚀 Advanced Usage Patterns

### Pattern 1: Auto-Upload Chunks to Server

```typescript
function AutoUploadRecorder() {
  const { recordingState, startRecording } = useMurmubaraEngine();
  const uploadedRef = useRef(new Set());
  
  useEffect(() => {
    recordingState.chunks.forEach(async chunk => {
      if (!uploadedRef.current.has(chunk.id)) {
        uploadedRef.current.add(chunk.id);
        
        // Convert blob URL to blob
        const response = await fetch(chunk.processedAudioUrl!);
        const blob = await response.blob();
        
        // Upload to your server
        const formData = new FormData();
        formData.append('audio', blob, `chunk-${chunk.id}.wav`);
        formData.append('metadata', JSON.stringify({
          duration: chunk.duration,
          noiseReduction: chunk.noiseRemoved,
          vad: chunk.averageVad
        }));
        
        await fetch('/api/upload-chunk', {
          method: 'POST',
          body: formData
        });
        
        console.log(`Uploaded chunk ${chunk.id}`);
      }
    });
  }, [recordingState.chunks]);
  
  return <button onClick={() => startRecording(5)}>Start 5s Chunks</button>;
}
```

### Pattern 2: Real-time Transcription

```typescript
function LiveTranscription() {
  const { recordingState } = useMurmubaraEngine();
  const [transcripts, setTranscripts] = useState<Record<string, string>>({});
  
  useEffect(() => {
    const latestChunk = recordingState.chunks[recordingState.chunks.length - 1];
    
    if (latestChunk && !transcripts[latestChunk.id]) {
      // Send to transcription service
      transcribeChunk(latestChunk).then(text => {
        setTranscripts(prev => ({
          ...prev,
          [latestChunk.id]: text
        }));
      });
    }
  }, [recordingState.chunks.length]);
  
  return (
    <div>
      {recordingState.chunks.map(chunk => (
        <p key={chunk.id}>
          [{chunk.index}]: {transcripts[chunk.id] || 'Transcribing...'}
        </p>
      ))}
    </div>
  );
}
```

### Pattern 3: Voice Activity Detection (VAD)

```typescript
function VoiceDetector() {
  const { recordingState, metrics } = useMurmubaraEngine();
  
  return (
    <div>
      {/* Real-time VAD */}
      {metrics && (
        <div>
          Voice Active: {metrics.vadLevel > 0.5 ? '🎤 Speaking' : '🔇 Silent'}
          Level: {(metrics.vadLevel * 100).toFixed(0)}%
        </div>
      )}
      
      {/* Historical VAD per chunk */}
      {recordingState.chunks.map(chunk => (
        <div key={chunk.id}>
          Chunk {chunk.index}: {(chunk.averageVad * 100).toFixed(0)}% voice activity
        </div>
      ))}
    </div>
  );
}
```

### Pattern 4: Advanced VAD Analysis (NEW in v3.0.3)

```typescript
import { murmubaraVAD, extractAudioMetadata } from 'murmuraba';

function AdvancedVADAnalysis() {
  const analyzeAudio = async (audioBuffer: ArrayBuffer) => {
    // Get accurate audio metadata
    const metadata = extractAudioMetadata(audioBuffer);
    console.log(`Duration: ${metadata.duration}s, Format: ${metadata.format}`);
    
    // Perform detailed VAD analysis
    const vadResult = await murmubaraVAD(audioBuffer);
    console.log(`Voice Activity: ${(vadResult.average * 100).toFixed(1)}%`);
    console.log(`Voice Segments: ${vadResult.voiceSegments?.length || 0}`);
    
    // Analyze voice segments
    vadResult.voiceSegments?.forEach((segment, i) => {
      console.log(`Segment ${i + 1}: ${segment.startTime}s - ${segment.endTime}s (confidence: ${segment.confidence})`);
    });
    
    return vadResult;
  };
  
  return (
    <div>
      {/* Use with recorded chunks */}
      <button onClick={async () => {
        const response = await fetch(chunk.processedAudioUrl!);
        const arrayBuffer = await response.arrayBuffer();
        const analysis = await analyzeAudio(arrayBuffer);
        // Display results...
      }}>
        Analyze VAD
      </button>
    </div>
  );
}
```

## 🎯 New in v3.0.3: Advanced Voice Activity Detection

Murmuraba now includes powerful VAD analysis functions for detailed audio inspection:

### `murmubaraVAD(buffer: ArrayBuffer): Promise<VADResult>`

Analyzes audio for voice activity using multiple algorithms:
- **Energy-based detection** with adaptive noise floor
- **Zero-crossing rate analysis** for voiced/unvoiced classification
- **RNNoise integration** when available
- **Temporal smoothing** for stable results

Returns:
```typescript
{
  average: number;              // Average VAD score (0.0-1.0)
  scores: number[];             // Frame-by-frame VAD scores
  metrics: VADMetric[];         // Detailed metrics per frame
  voiceSegments: VoiceSegment[]; // Detected voice segments
}
```

### `extractAudioMetadata(buffer: ArrayBuffer): AudioMetadata`

Extracts accurate metadata from audio files:
- Supports WAV, MP3, WebM/Opus formats
- Returns precise duration, sample rate, channels, bit depth
- No more guessing audio duration!

Example:
```typescript
const metadata = extractAudioMetadata(audioBuffer);
console.log(`Duration: ${metadata.duration}s`);
console.log(`Format: ${metadata.format}`);
console.log(`Sample Rate: ${metadata.sampleRate}Hz`);
```

## ⚙️ Configuration Options

```typescript
interface UseMurmubaraEngineOptions {
  // Chunking
  defaultChunkDuration?: number;    // Seconds per chunk (default: 8)
  
  // Audio Processing
  bufferSize?: number;              // Audio buffer size (default: 16384)
  sampleRate?: number;              // Sample rate Hz (default: 48000)
  denoiseStrength?: number;         // Noise reduction 0-1 (default: 0.85)
  
  // Gain Control
  inputGain?: number;               // Initial gain 0.5-3.0 (default: 1.0)
  enableAGC?: boolean;              // Auto gain control (default: true)
  
  // Voice Detection
  spectralFloorDb?: number;         // Noise floor dB (default: -80)
  noiseFloorDb?: number;            // VAD threshold dB (default: -60)
  
  // Performance
  enableMetrics?: boolean;          // Real-time metrics (default: true)
  metricsUpdateInterval?: number;   // Update interval ms (default: 100)
  
  // Initialization
  autoInitialize?: boolean;         // Auto-init on mount (default: false)
  allowDegraded?: boolean;          // Allow fallback mode (default: true)
  
  // Debugging
  logLevel?: 'none' | 'error' | 'warn' | 'info' | 'debug';
}
```

## 🔧 Memory Management

Murmuraba automatically manages blob URLs to prevent memory leaks:

```typescript
// URLs are automatically created and tracked
const processedUrl = URL.createObjectURL(processedBlob);  // ✅ Tracked

// URLs are automatically revoked when:
clearRecordings();  // All URLs revoked
// or on component unmount
```

## 📈 Performance Considerations

- **Chunk Duration**: 5-10 seconds optimal for most use cases
- **Buffer Size**: Larger = better quality, more latency
- **Sample Rate**: 48kHz for quality, 16kHz for size
- **Memory**: Each chunk ~100-500KB depending on duration

## 🎨 Building Custom UIs

Since you have full control via the hook, build any UI you want:

```typescript
function MinimalRecorder() {
  const { recordingState, startRecording, stopRecording } = useMurmubaraEngine();
  
  if (!recordingState.isRecording) {
    return <button onClick={() => startRecording()}>🎤 Record</button>;
  }
  
  return (
    <div>
      <button onClick={stopRecording}>⏹ Stop</button>
      <div>
        Recording: {recordingState.recordingTime}s
        Chunks: {recordingState.chunks.length}
      </div>
    </div>
  );
}
```

## 🚨 Error Handling

```typescript
function RobustRecorder() {
  const { 
    error, 
    isInitialized, 
    initialize, 
    startRecording 
  } = useMurmubaraEngine();
  
  const handleStart = async () => {
    try {
      if (!isInitialized) {
        await initialize();
      }
      await startRecording();
    } catch (err) {
      console.error('Recording failed:', err);
      // Handle specific errors
      if (err.message.includes('microphone')) {
        alert('Please allow microphone access');
      }
    }
  };
  
  if (error) {
    return <div>Error: {error}</div>;
  }
  
  return <button onClick={handleStart}>Start</button>;
}
```

## 🤝 Contributing

Contributions welcome! Please check our [GitHub repository](https://github.com/yourusername/murmuraba).

## 📄 License

MIT © Murmuraba Team

## 🔗 Links

- [NPM Package](https://www.npmjs.com/package/murmuraba)
- [GitHub Repository](https://github.com/yourusername/murmuraba)
- [Documentation](https://murmuraba.dev)
- [RNNoise Project](https://github.com/xiph/rnnoise)

---

Built with ❤️ for developers who need professional audio streaming with neural noise reduction.