/**
 * useVADAnalysis Hook
 * Voice Activity Detection analysis functionality
 * Extracted from useSusurro for single responsibility
 */

import { useCallback } from 'react';
import { getModernVAD } from '../lib/modern-vad';
import { loadMurmubaraProcessing } from '../lib/dynamic-loaders';
import { AUDIO_CONFIG, ERROR_MESSAGES } from '../lib/audio-constants';
import { handleAudioError } from '../lib/error-utils';
import type { VADAnalysisResult, VoiceSegment } from '../lib/types';

interface UseVADAnalysisReturn {
  analyzeVAD: (buffer: ArrayBuffer) => Promise<VADAnalysisResult>;
  getDuration: (buffer: ArrayBuffer) => Promise<number>;
}

export function useVADAnalysis(): UseVADAnalysisReturn {
  const analyzeVAD = useCallback(async (buffer: ArrayBuffer): Promise<VADAnalysisResult> => {
    try {
      // Primary: Use Modern Neural VAD (Silero) for superior accuracy
      const modernVAD = getModernVAD({
        positiveSpeechThreshold: AUDIO_CONFIG.VAD.POSITIVE_THRESHOLD,
        negativeSpeechThreshold: AUDIO_CONFIG.VAD.NEGATIVE_THRESHOLD,
        frameSamples: AUDIO_CONFIG.VAD.FRAME_SAMPLES,
      });

      const modernResult = await modernVAD.analyze(buffer);

      if (modernResult.averageVad > 0) {
        // Modern VAD successful
        return modernResult;
      }

      // Fallback: Use Murmuraba VAD if Modern VAD fails
      const { murmubaraVAD } = await loadMurmubaraProcessing();
      const result = await murmubaraVAD(buffer);

      // Process results to find voice segments
      const voiceSegments: VoiceSegment[] = [];
      const vadScores = result.scores || [];
      const metrics = result.metrics || [];

      // Find continuous voice segments above threshold
      let segmentStart = -1;
      const threshold = AUDIO_CONFIG.THRESHOLDS.MIN_AUDIO_LEVEL;

      vadScores.forEach((score: number, index: number) => {
        const isVoice = score > threshold;

        if (isVoice && segmentStart === -1) {
          segmentStart = index;
        } else if (!isVoice && segmentStart !== -1) {
          const duration = buffer.byteLength / AUDIO_CONFIG.SAMPLE_RATE / 2; // 16-bit samples
          const frameDuration = duration / vadScores.length;

          voiceSegments.push({
            startTime: segmentStart * frameDuration,
            endTime: index * frameDuration,
            vadScore:
              vadScores.slice(segmentStart, index).reduce((a: number, b: number) => a + b, 0) /
              (index - segmentStart),
            confidence: 0.8,
          });

          segmentStart = -1;
        }
      });

      // Handle segment that extends to end
      if (segmentStart !== -1) {
        const duration = buffer.byteLength / AUDIO_CONFIG.SAMPLE_RATE / 2;
        const frameDuration = duration / vadScores.length;

        voiceSegments.push({
          startTime: segmentStart * frameDuration,
          endTime: duration,
          vadScore:
            vadScores.slice(segmentStart).reduce((a: number, b: number) => a + b, 0) /
            (vadScores.length - segmentStart),
          confidence: 0.8,
        });
      }

      return {
        averageVad: result.average || 0,
        vadScores,
        metrics,
        voiceSegments,
      };
    } catch (error) {
      handleAudioError(error, 'vad-analysis', ERROR_MESSAGES.VAD_ANALYSIS_FAILED);
    }
  }, []);

  const getDuration = useCallback(async (buffer: ArrayBuffer): Promise<number> => {
    try {
      const { extractAudioMetadata } = await loadMurmubaraProcessing();
      const metadata = await extractAudioMetadata(buffer);
      return metadata.duration;
    } catch (error) {
      // Fallback to estimation if metadata extraction fails
      return buffer.byteLength / AUDIO_CONFIG.SAMPLE_RATE / 2; // 16-bit samples
    }
  }, []);

  return {
    analyzeVAD,
    getDuration,
  };
}
