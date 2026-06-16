# Murmuraba Package Architecture

## Current State (1.5.2)

### ✅ What's Inside the Package (Good)
- **Core Engine**: MurmubaraEngine class with full audio processing pipeline
- **Hooks**: useMurmubaraEngine with complete recording/chunking logic
- **Managers**: WorkerManager, MetricsManager, ChunkProcessor
- **Audio Utils**: AudioConverter (WAV/MP3), AudioStreamManager
- **Recording System**: RecordingManager with concatenated streaming
- **Types**: Full TypeScript types exported

### ❌ What's Outside (Needs Fix)
- **RNNoise WASM**: Currently loaded from hardcoded paths
- **Dependencies**: @jitsi/rnnoise-wasm is in root package.json

## To Make it Fully Standalone

1. **Move RNNoise dependency**:
```json
// packages/murmuraba/package.json
"dependencies": {
  "@jitsi/rnnoise-wasm": "^0.2.1",
  "lamejs": "^1.2.1"
}
```

2. **Fix RNNoiseEngine paths**:
```typescript
// Make paths configurable
interface RNNoiseConfig {
  wasmPath?: string;
  scriptPath?: string;
}

// Default to node_modules paths
const defaultConfig = {
  wasmPath: 'node_modules/@jitsi/rnnoise-wasm/dist/',
  scriptPath: 'node_modules/@jitsi/rnnoise-wasm/dist/rnnoise.js'
};
```

3. **Bundle WASM assets**:
```javascript
// rollup.config.js - add copy plugin
copy({
  targets: [
    { 
      src: 'node_modules/@jitsi/rnnoise-wasm/dist/*', 
      dest: 'dist/wasm' 
    }
  ]
})
```

## Package Exports

```typescript
import { useMurmubaraEngine } from 'murmuraba';

// Everything you need is in the hook return
const {
  // State
  isInitialized,
  isLoading,
  error,
  engineState,
  metrics,
  diagnostics,
  recordingState,
  currentStream,
  
  // Actions
  initialize,
  destroy,
  startRecording,
  stopRecording,
  pauseRecording,
  resumeRecording,
  clearRecordings,
  
  // Playback
  toggleChunkPlayback,
  toggleChunkExpansion,
  
  // Export
  exportChunkAsWav,
  exportChunkAsMp3,
  downloadChunk,
  
  // Utils
  resetError,
  formatTime,
  getAverageNoiseReduction
} = useMurmubaraEngine(options);
```

## Zero External Dependencies Usage

```bash
npm install murmuraba
```

```tsx
import { useMurmubaraEngine } from 'murmuraba';

function MyApp() {
  const { 
    startRecording, 
    stopRecording, 
    recordingState 
  } = useMurmubaraEngine({
    autoInitialize: true,
    defaultChunkDuration: 10
  });
  
  // That's it! Full noise reduction suite
}
```

## What Makes it "Full Suite"
1. **Real-time noise reduction** via RNNoise neural network
2. **Chunked recording** with automatic segmentation
3. **Dual stream processing** (original + processed)
4. **Export formats**: WebM, WAV, MP3
5. **Metrics & diagnostics** built-in
6. **React hooks** for easy integration
7. **TypeScript** full type safety
8. **Worker support** for performance
9. **Configurable** noise reduction levels
10. **Memory management** with blob cleanup