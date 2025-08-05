# Waveform Simplification: Kill the Bloat

## Quick Win
**SimpleWaveformAnalyzer from Murmuraba v3 = 900 lines → 80 lines**

We are NOT building anything. We are REMOVING everything and using what already exists.

## Death List - Eliminate Immediately

- ALL mock data generation (lines 228-248, 290-307)
- 3 separate canvases → Use 1 SimpleWaveformAnalyzer
- 15+ state variables → Keep only 4 essentials
- setInterval @ 20 FPS → Already handled by SimpleWaveformAnalyzer
- Custom waveform rendering code → DELETED

## The Only Implementation Needed

### 1. Expose MediaStream from useMurmubaraEngine

```typescript
// useSusurro.ts - Add this return
export interface UseSusurroReturn {
  // ... existing
  currentStream: MediaStream | null; // From useMurmubaraEngine
}

return {
  // ... existing
  currentStream, // Direct passthrough
};
```

### 2. Replace Everything with SimpleWaveformAnalyzer

```typescript
// audio-fragment-processor.tsx - THIS IS THE ENTIRE COMPONENT
import { SimpleWaveformAnalyzer } from 'murmuraba';

const AudioFragmentProcessor: React.FC = () => {
  const { 
    startStreamingRecording, 
    stopStreamingRecording, 
    currentStream, // MediaStream from useMurmubaraEngine
    isRecording 
  } = useSusurro({ chunkDurationMs: 8000 }); // 8-second chunks

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

That's it. Done.

## Configuration Changes

### useSusurro Hook Updates
- Change chunk duration: 2s → 8s
- Expose `currentStream` from `useMurmubaraEngine`
- Remove all mock data processing

### Chunk Duration Adjustment
```typescript
const config = {
  chunkDuration: 8, // Changed from 2 to 8 seconds
  // ... rest unchanged
};
```

## Implementation Checklist

### ELIMINATE
- [ ] Delete all mock data generators
- [ ] Remove 3 canvas implementations
- [ ] Delete custom waveform rendering
- [ ] Remove 11+ unnecessary state variables
- [ ] Kill setInterval waveform updates

### REPLACE
- [ ] Import SimpleWaveformAnalyzer from 'murmuraba'
- [ ] Expose currentStream in useSusurro return
- [ ] Set chunkDurationMs to 8000
- [ ] Use SimpleWaveformAnalyzer with currentStream

### VERIFY
- [ ] Component renders with real MediaStream
- [ ] 8-second chunks processing correctly
- [ ] No mock data anywhere in codebase
- [ ] Memory stable (no MediaStream leaks)

## Before vs After

### Before (Dead Code)
- 3 canvases with custom rendering
- Mock waveform/frequency generation
- 15+ state variables for simple operations
- ~900 lines of unnecessary complexity
- setInterval performance issues

### After (Living Code)
- 1 SimpleWaveformAnalyzer (already optimized)
- Real MediaStream from useMurmubaraEngine
- 4 state variables maximum
- ~80 lines total
- requestAnimationFrame @ 60fps (built-in)

## Risk Mitigation
SimpleWaveformAnalyzer already handles:
- AudioContext management
- Canvas optimization
- Stream lifecycle
- Error handling
- Browser compatibility

If it breaks, the entire Murmuraba ecosystem breaks. It won't.

## Success Metrics
- Code reduction: 900 → 80 lines
- State variables: 15+ → 4
- Canvases: 3 → 1
- Mock data: ALL → ZERO
- Performance: 20fps → 60fps
- Memory: Growing → Stable

The component exists. The MediaStream exists. Just connect them.