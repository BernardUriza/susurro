# Murmuraba VAD Implementation Requirement

## Overview
The current `useSusurro` hook contains placeholder implementations for Voice Activity Detection (VAD) and audio duration calculation that need to be replaced with real implementations from the Murmuraba engine.

## Current Issues

### 1. Placeholder VAD Implementation
**Location**: `/workspaces/susurro/packages/susurro/src/hooks/useSusurro.ts:212-257`

The current implementation:
```typescript
const analyzeVAD = useCallback(async (buffer: ArrayBuffer): Promise<VADAnalysisResult> => {
  // Note: Using placeholder implementation until murmubaraVAD is available
  const result = {
    average: 0.5,  // Always returns 50%
    scores: new Array(Math.floor(buffer.byteLength / 1024)).fill(0).map(() => Math.random()),
    metrics: []
  };
  // ...
});
```

**Problems**:
- Always returns 0.5 (50%) as the average VAD score regardless of actual voice content
- Generates random scores instead of real voice detection
- No actual voice segment detection
- Missing real metrics data

### 2. Incorrect Duration Calculation
**Location**: `/workspaces/susurro/packages/susurro/src/hooks/useSusurro.ts:267-273`

The current implementation:
```typescript
const calculateDuration = (buffer: ArrayBuffer): number => {
  // Simple estimation - should be replaced with proper audio parsing
  const bytes = buffer.byteLength;
  const estimatedDuration = bytes / (44100 * 2 * 2); // 44.1kHz, 2 channels, 16-bit
  return Math.max(0.1, estimatedDuration);
};
```

**Problems**:
- Assumes fixed sample rate (44.1kHz) and format (2 channels, 16-bit)
- Doesn't parse actual audio headers
- Results in incorrect duration (e.g., showing 2 seconds for an 11-second audio file)

## Required Implementation

### 1. Export `murmubaraVAD` Function
The Murmuraba package needs to export a `murmubaraVAD` function with the following signature:

```typescript
export async function murmubaraVAD(buffer: ArrayBuffer): Promise<{
  average: number;      // Real average VAD score (0.0 to 1.0)
  scores: number[];     // Frame-by-frame VAD scores
  metrics: Array<{      // Detailed metrics
    timestamp: number;
    vadScore: number;
    energy: number;
    zeroCrossingRate: number;
  }>;
}>
```

**Requirements**:
- Must analyze the actual audio buffer content
- Return accurate VAD scores based on voice detection algorithms
- Provide frame-by-frame analysis (e.g., 20ms frames)
- Include energy and zero-crossing rate metrics for each frame

### 2. Export Audio Metadata Extraction
Add functionality to extract real audio metadata from buffers:

```typescript
export function extractAudioMetadata(buffer: ArrayBuffer): {
  duration: number;      // Actual duration in seconds
  sampleRate: number;    // Real sample rate from audio header
  channels: number;      // Real channel count
  bitDepth: number;      // Bits per sample
  format: string;        // Audio format (wav, mp3, etc.)
}
```

**Requirements**:
- Parse audio file headers (WAV, MP3, etc.)
- Extract accurate duration from metadata
- Return real sample rate and channel information
- Handle multiple audio formats

### 3. Integration Points

The functions should be imported and used in `useSusurro.ts`:

```typescript
import { 
  murmubaraVAD, 
  extractAudioMetadata 
} from 'murmuraba';

// Replace line 216-220 with:
const result = await murmubaraVAD(buffer);

// Replace calculateDuration function with:
const calculateDuration = (buffer: ArrayBuffer): number => {
  const metadata = extractAudioMetadata(buffer);
  return metadata.duration;
};
```

## Implementation Details

### VAD Algorithm Requirements
1. **Energy-based detection**: Calculate RMS energy for each frame
2. **Zero-crossing rate**: Detect speech characteristics
3. **Spectral features**: Use frequency domain analysis for robustness
4. **Adaptive thresholding**: Adjust to noise levels
5. **Smoothing**: Apply temporal smoothing to reduce false positives

### Voice Segment Detection
The VAD should identify continuous voice segments with:
- Start and end timestamps
- Average confidence score per segment
- Minimum segment duration filtering (e.g., 100ms)

### Performance Requirements
- Process a 5-minute audio file in < 500ms
- Support real-time processing for streaming audio
- Memory efficient for large files

## Test Cases

### 1. VAD Accuracy Test
```typescript
// Test with known audio file
const testBuffer = await loadTestAudio('speech-with-silence.wav');
const result = await murmubaraVAD(testBuffer);

// Expected: ~70% VAD for file with 70% speech content
expect(result.average).toBeCloseTo(0.7, 1);
```

### 2. Duration Accuracy Test
```typescript
// Test with 11-second audio file
const testBuffer = await loadTestAudio('11-seconds.wav');
const metadata = extractAudioMetadata(testBuffer);

expect(metadata.duration).toBeCloseTo(11.0, 1);
```

### 3. Voice Segment Detection Test
```typescript
const result = await analyzeVAD(testBuffer);

// Should detect distinct voice segments
expect(result.voiceSegments.length).toBeGreaterThan(0);
expect(result.voiceSegments[0]).toHaveProperty('startTime');
expect(result.voiceSegments[0]).toHaveProperty('endTime');
expect(result.voiceSegments[0]).toHaveProperty('confidence');
```

## Acceptance Criteria

1. ✅ VAD returns accurate voice activity percentages (±5% tolerance)
2. ✅ Duration calculation is accurate to within 0.1 seconds
3. ✅ Voice segments are correctly identified with timestamps
4. ✅ Works with common audio formats (WAV, MP3, WebM)
5. ✅ Performance meets requirements for real-time processing
6. ✅ No regression in existing functionality

## Timeline
- Priority: HIGH
- Estimated effort: 3-5 days
- Dependencies: None

## Notes
- The current placeholder was added to unblock development
- Real implementation is critical for production use
- Consider using existing VAD libraries (e.g., WebRTC VAD) as a base