import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatTime,
  formatDurationWithLabel,
  createTimeFormatter,
  calculateDurationStats,
  convertTime,
  normalizeTime,
  isValidTime,
} from '../time-utils';

describe('time-utils', () => {
  describe('formatDuration', () => {
    it('should format milliseconds to MM:SS format', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(1000)).toBe('0:01');
      expect(formatDuration(60000)).toBe('1:00');
      expect(formatDuration(61000)).toBe('1:01');
      expect(formatDuration(125500)).toBe('2:05');
      expect(formatDuration(3661000)).toBe('61:01');
    });

    it('should handle edge cases', () => {
      expect(formatDuration(-1000)).toBe('0:00');
      expect(formatDuration(NaN)).toBe('0:00');
      expect(formatDuration(Infinity)).toBe('0:00');
    });

    it('should support different formats', () => {
      const ms = 125500; // 2 minutes 5.5 seconds
      
      expect(formatDuration(ms, { format: 'mm:ss' })).toBe('2:05');
      expect(formatDuration(ms, { format: 'hh:mm:ss' })).toBe('00:02:05');
      expect(formatDuration(ms, { format: 'compact' })).toBe('2m 5s');
      
      const hours = 3665000; // 1 hour 1 minute 5 seconds
      expect(formatDuration(hours, { format: 'hh:mm:ss' })).toBe('01:01:05');
      expect(formatDuration(hours, { format: 'compact' })).toBe('1h 1m');
    });

    it('should support precision options', () => {
      const ms = 125500; // 2 minutes 5.5 seconds
      expect(formatDuration(ms, { precision: 'milliseconds' })).toBe('2:05.5');
    });
  });

  describe('formatTime (legacy)', () => {
    it('should format seconds to MM:SS format', () => {
      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(1)).toBe('0:01');
      expect(formatTime(60)).toBe('1:00');
      expect(formatTime(125.5)).toBe('2:05');
    });
  });

  describe('formatDurationWithLabel', () => {
    it('should format with appropriate labels', () => {
      expect(formatDurationWithLabel(500)).toBe('500ms');
      expect(formatDurationWithLabel(1500)).toBe('1.5s');
      expect(formatDurationWithLabel(60000)).toBe('1:00');
      expect(formatDurationWithLabel(3600000)).toBe('01:00:00');
    });
  });

  describe('createTimeFormatter', () => {
    it('should create formatter with consistent options', () => {
      const formatter = createTimeFormatter({ format: 'compact' });
      expect(formatter(125500)).toBe('2m 5s');
    });
  });

  describe('calculateDurationStats', () => {
    it('should calculate statistics correctly', () => {
      const durations = [1000, 2000, 3000];
      const stats = calculateDurationStats(durations);
      
      expect(stats.total).toBe(6000);
      expect(stats.average).toBe(2000);
      expect(stats.min).toBe(1000);
      expect(stats.max).toBe(3000);
      expect(stats.totalFormatted).toBe('0:06');
      expect(stats.averageFormatted).toBe('0:02');
    });

    it('should handle empty array', () => {
      const stats = calculateDurationStats([]);
      expect(stats.total).toBe(0);
      expect(stats.totalFormatted).toBe('0:00');
    });
  });

  describe('convertTime', () => {
    it('should convert between units correctly', () => {
      expect(convertTime.msToSeconds(1000)).toBe(1);
      expect(convertTime.secondsToMs(1)).toBe(1000);
      expect(convertTime.msToMinutes(60000)).toBe(1);
      expect(convertTime.minutesToMs(1)).toBe(60000);
    });
  });

  describe('normalizeTime', () => {
    it('should normalize time values', () => {
      expect(normalizeTime(1000)).toBe(1000);
      expect(normalizeTime(-1000)).toBe(0);
      expect(normalizeTime(NaN)).toBe(0);
      expect(normalizeTime(Infinity)).toBe(0);
    });
  });

  describe('isValidTime', () => {
    it('should validate time values', () => {
      expect(isValidTime(1000)).toBe(true);
      expect(isValidTime(0)).toBe(true);
      expect(isValidTime(-1)).toBe(false);
      expect(isValidTime(NaN)).toBe(false);
      expect(isValidTime('1000')).toBe(false);
      expect(isValidTime(null)).toBe(false);
    });
  });
});