/**
 * Voice Segment Detection
 * Identifies continuous voice segments from VAD scores
 */

import { VoiceSegment } from '../types';

export class SegmentDetector {
  private minSegmentDuration: number;
  private hangoverTime: number;
  private mergeGap: number;

  constructor(
    minSegmentDuration: number = 0.1,  // 100ms
    hangoverTime: number = 0.3,        // 300ms
    mergeGap: number = 0.5             // 500ms
  ) {
    this.minSegmentDuration = minSegmentDuration;
    this.hangoverTime = hangoverTime;
    this.mergeGap = mergeGap;
  }

  /**
   * Detect voice segments from VAD scores
   */
  detectSegments(
    vadScores: number[], 
    frameTime: number,
    threshold: number = 0.5
  ): VoiceSegment[] {
    const segments: VoiceSegment[] = [];
    let currentSegment: VoiceSegment | null = null;
    let hangoverFrames = Math.ceil(this.hangoverTime / frameTime);
    let hangoverCount = 0;

    for (let i = 0; i < vadScores.length; i++) {
      const timestamp = i * frameTime;
      const vadScore = vadScores[i];
      const isVoice = vadScore > threshold;

      if (isVoice) {
        if (!currentSegment) {
          // Start new segment
          currentSegment = {
            startTime: timestamp,
            endTime: timestamp,
            confidence: vadScore
          };
        } else {
          // Extend current segment
          currentSegment.endTime = timestamp;
          currentSegment.confidence = 
            (currentSegment.confidence + vadScore) / 2;
        }
        hangoverCount = hangoverFrames;
      } else if (currentSegment && hangoverCount > 0) {
        // In hangover period
        currentSegment.endTime = timestamp;
        hangoverCount--;
      } else if (currentSegment) {
        // End segment
        const duration = currentSegment.endTime - currentSegment.startTime;
        if (duration >= this.minSegmentDuration) {
          segments.push(currentSegment);
        }
        currentSegment = null;
        hangoverCount = 0;
      }
    }

    // Handle last segment
    if (currentSegment) {
      const duration = currentSegment.endTime - currentSegment.startTime;
      if (duration >= this.minSegmentDuration) {
        segments.push(currentSegment);
      }
    }

    // Merge close segments
    return this.mergeSegments(segments);
  }

  /**
   * Merge segments that are close together
   */
  private mergeSegments(segments: VoiceSegment[]): VoiceSegment[] {
    if (segments.length < 2) return segments;

    const merged: VoiceSegment[] = [];
    let current = segments[0];

    for (let i = 1; i < segments.length; i++) {
      const next = segments[i];
      const gap = next.startTime - current.endTime;

      if (gap <= this.mergeGap) {
        // Merge segments
        current = {
          startTime: current.startTime,
          endTime: next.endTime,
          confidence: (current.confidence + next.confidence) / 2
        };
      } else {
        // Keep separate
        merged.push(current);
        current = next;
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * Apply median filter to smooth VAD scores
   */
  smoothScores(vadScores: number[], windowSize: number = 5): number[] {
    const smoothed: number[] = [];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < vadScores.length; i++) {
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(vadScores.length, i + halfWindow + 1);
      const window = vadScores.slice(start, end);
      
      // Calculate median
      window.sort((a, b) => a - b);
      const median = window[Math.floor(window.length / 2)];
      smoothed.push(median);
    }

    return smoothed;
  }
}