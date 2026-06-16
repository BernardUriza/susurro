/**
 * Unified time formatting utilities for consistent duration handling across the application.
 * All durations are stored internally as milliseconds for precision.
 */

export type TimeUnit = 'milliseconds' | 'seconds';
export type TimeFormat = 'mm:ss' | 'hh:mm:ss' | 'compact';

export interface TimeFormatOptions {
  format?: TimeFormat;
  showHours?: boolean;
  precision?: 'seconds' | 'milliseconds';
}

/**
 * Convert time between different units
 */
export const convertTime = {
  msToSeconds: (ms: number): number => ms / 1000,
  secondsToMs: (seconds: number): number => seconds * 1000,
  msToMinutes: (ms: number): number => ms / (1000 * 60),
  minutesToMs: (minutes: number): number => minutes * 1000 * 60,
};

/**
 * Validate and normalize time values
 */
export const normalizeTime = (time: number): number => {
  if (!isFinite(time) || time < 0) return 0;
  return time;
};

/**
 * Core time formatting function that accepts milliseconds
 * This is the single source of truth for time formatting
 */
export const formatDuration = (
  milliseconds: number,
  options: TimeFormatOptions = {}
): string => {
  const { format = 'mm:ss', showHours = false, precision = 'seconds' } = options;
  
  const normalizedMs = normalizeTime(milliseconds);
  
  if (normalizedMs === 0) return format === 'compact' ? '0s' : '0:00';
  
  const totalSeconds = precision === 'milliseconds' 
    ? normalizedMs / 1000 
    : Math.floor(normalizedMs / 1000);
    
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const ms = Math.floor(normalizedMs % 1000);
  
  switch (format) {
    case 'compact':
      if (hours > 0) return `${hours}h ${minutes}m`;
      if (minutes > 0) return `${minutes}m ${seconds}s`;
      return `${seconds}s`;
      
    case 'hh:mm:ss':
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
    case 'mm:ss':
    default: {
      if (showHours && hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      
      const totalMinutes = Math.floor(totalSeconds / 60);
      const remainingSeconds = Math.floor(totalSeconds % 60);
      
      if (precision === 'milliseconds' && ms > 0) {
        return `${totalMinutes}:${remainingSeconds.toString().padStart(2, '0')}.${Math.floor(ms / 100)}`;
      }
      
      return `${totalMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }
};

/**
 * Legacy compatibility - formats seconds to mm:ss
 * @deprecated Use formatDuration with convertTime.secondsToMs() instead
 */
export const formatTime = (seconds: number): string => {
  return formatDuration(convertTime.secondsToMs(seconds));
};

/**
 * Format duration with automatic unit detection and user-friendly labels
 */
export const formatDurationWithLabel = (milliseconds: number): string => {
  const ms = normalizeTime(milliseconds);
  
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return formatDuration(ms, { format: 'mm:ss' });
  
  return formatDuration(ms, { format: 'hh:mm:ss' });
};

/**
 * Create a time formatter with consistent options
 */
export const createTimeFormatter = (options: TimeFormatOptions = {}) => {
  return (milliseconds: number): string => formatDuration(milliseconds, options);
};

/**
 * Utility for chunk duration statistics
 */
export const calculateDurationStats = (durations: number[]) => {
  if (durations.length === 0) {
    return {
      total: 0,
      average: 0,
      min: 0,
      max: 0,
      totalFormatted: '0:00',
      averageFormatted: '0:00',
    };
  }
  
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  const average = total / durations.length;
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  
  return {
    total,
    average,
    min,
    max,
    totalFormatted: formatDuration(total),
    averageFormatted: formatDuration(average),
    minFormatted: formatDuration(min),
    maxFormatted: formatDuration(max),
  };
};

/**
 * Type guard for time values
 */
export const isValidTime = (value: unknown): value is number => {
  return typeof value === 'number' && isFinite(value) && value >= 0;
};