/**
 * Time constants for consistent duration handling across the application
 */

export const TIME_UNITS = {
  MILLISECOND: 1,
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
} as const;

/**
 * Common durations in milliseconds for audio processing
 */
export const AUDIO_DURATIONS = {
  /** Common chunk size for real-time processing */
  CHUNK_DEFAULT: 5 * TIME_UNITS.SECOND,
  /** Minimum chunk size for meaningful processing */
  CHUNK_MIN: 1 * TIME_UNITS.SECOND,
  /** Maximum chunk size to prevent memory issues */
  CHUNK_MAX: 30 * TIME_UNITS.SECOND,
  /** Typical recording session length */
  SESSION_TYPICAL: 10 * TIME_UNITS.MINUTE,
  /** Maximum recording session length */
  SESSION_MAX: 60 * TIME_UNITS.MINUTE,
} as const;

/**
 * Format thresholds for automatic format selection
 */
export const FORMAT_THRESHOLDS = {
  /** Show milliseconds below this threshold */
  SHOW_MS: 1 * TIME_UNITS.SECOND,
  /** Show seconds only below this threshold */
  SHOW_SECONDS: 1 * TIME_UNITS.MINUTE,
  /** Show hours above this threshold */
  SHOW_HOURS: 1 * TIME_UNITS.HOUR,
} as const;

/**
 * Performance thresholds for audio processing
 */
export const PERFORMANCE_THRESHOLDS = {
  /** Acceptable processing latency in milliseconds */
  LATENCY_GOOD: 50,
  /** Warning threshold for processing latency */
  LATENCY_WARNING: 100,
  /** Critical threshold for processing latency */
  LATENCY_CRITICAL: 200,
  /** Real-time processing budget per chunk */
  REALTIME_BUDGET: 0.8, // 80% of chunk duration
} as const;

/**
 * Utility functions for working with time constants
 */
export const timeUtils = {
  /**
   * Convert human-readable time to milliseconds
   */
  toMs: (value: number, unit: keyof typeof TIME_UNITS): number => {
    return value * TIME_UNITS[unit];
  },

  /**
   * Convert milliseconds to human-readable time
   */
  fromMs: (ms: number, unit: keyof typeof TIME_UNITS): number => {
    return ms / TIME_UNITS[unit];
  },

  /**
   * Check if a duration is within acceptable limits for audio processing
   */
  isValidAudioDuration: (ms: number): boolean => {
    return ms >= AUDIO_DURATIONS.CHUNK_MIN && ms <= AUDIO_DURATIONS.SESSION_MAX;
  },

  /**
   * Get recommended chunk size based on total duration
   */
  getRecommendedChunkSize: (totalDurationMs: number): number => {
    if (totalDurationMs <= 30 * TIME_UNITS.SECOND) {
      return AUDIO_DURATIONS.CHUNK_MIN;
    }
    if (totalDurationMs <= 5 * TIME_UNITS.MINUTE) {
      return AUDIO_DURATIONS.CHUNK_DEFAULT;
    }
    return Math.min(
      AUDIO_DURATIONS.CHUNK_MAX,
      Math.floor(totalDurationMs / 10) // 10 chunks max
    );
  },

  /**
   * Categorize processing latency
   */
  categorizeLatency: (latencyMs: number): 'good' | 'warning' | 'critical' => {
    if (latencyMs <= PERFORMANCE_THRESHOLDS.LATENCY_GOOD) return 'good';
    if (latencyMs <= PERFORMANCE_THRESHOLDS.LATENCY_WARNING) return 'warning';
    return 'critical';
  },
} as const;