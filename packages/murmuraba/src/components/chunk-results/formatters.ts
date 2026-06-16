import { 
  formatDuration as formatDurationCore, 
  formatTime as formatTimeCore,
  calculateDurationStats 
} from '../../utils/time-utils';

/**
 * Format duration from milliseconds to MM:SS format
 * This is the primary duration formatter for the chunk results
 */
export const formatDuration = (milliseconds: number): string => {
  return formatDurationCore(milliseconds);
};

/**
 * Legacy formatter for seconds to MM:SS format
 * @deprecated Use formatDuration with milliseconds instead
 */
export const formatTime = (seconds: number): string => {
  return formatTimeCore(seconds);
};

export const formatPercentage = (value: number): string => {
  if (!isFinite(value)) return '0.0%';
  return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
};

export const formatFileSize = (bytes: number): string => {
  if (!isFinite(bytes) || bytes <= 0) return '0 KB';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

export const calculateChunkStats = (chunks: Array<{ duration: number; isValid?: boolean; metrics: { processingLatency: number } }>) => {
  if (chunks.length === 0) return null;
  
  const validChunks = chunks.filter(chunk => chunk.isValid !== false);
  const durations = chunks.map(chunk => chunk.duration);
  const durationStats = calculateDurationStats(durations);
  
  const averageLatency = validChunks.length > 0 
    ? validChunks.reduce((sum, chunk) => sum + chunk.metrics.processingLatency, 0) / validChunks.length 
    : 0;
  
  return {
    totalChunks: chunks.length,
    validChunks: validChunks.length,
    totalDuration: durationStats.total,
    averageLatency,
    durationStats,
  };
};