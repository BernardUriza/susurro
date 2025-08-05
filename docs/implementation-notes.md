# Implementation Notes

## Waveform Simplification

Replace 900 lines of custom waveform code with SimpleWaveformAnalyzer from Murmuraba:

```typescript
// Expose MediaStream in useSusurro.ts
export interface UseSusurroReturn {
  currentStream: MediaStream | null;
}

// audio-fragment-processor.tsx - Complete implementation
import { SimpleWaveformAnalyzer } from 'murmuraba';

const AudioFragmentProcessor: React.FC = () => {
  const { 
    startStreamingRecording, 
    stopStreamingRecording, 
    currentStream,
    isRecording 
  } = useSusurro({ chunkDurationMs: 8000 });

  return (
    <div>
      <button onClick={isRecording ? stopStreamingRecording : startStreamingRecording}>
        {isRecording ? 'STOP' : 'START'}
      </button>
      <SimpleWaveformAnalyzer 
        stream={currentStream}
        isActive={isRecording}
        width={800}
        height={200}
      />
    </div>
  );
};
```

## Middleware API

Built-in middleware: quality, sentiment, intent, translation
Enable: `middlewarePipeline.enable('sentiment')`
Custom: Implement ChunkMiddleware interface

```typescript
const customMiddleware: ChunkMiddleware = {
  name: 'keyword-detector',
  enabled: true,
  priority: 5,
  async process(chunk: SusurroChunk): Promise<SusurroChunk> {
    // Transform chunk
    return { ...chunk, metadata: { ...chunk.metadata, custom: true } };
  }
};
```