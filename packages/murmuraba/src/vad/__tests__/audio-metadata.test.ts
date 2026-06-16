/**
 * Tests for audio metadata extraction
 */

import { describe, it, expect } from 'vitest';
import { extractAudioMetadata } from '../audio-metadata';

describe('extractAudioMetadata', () => {
  describe('WAV format', () => {
    it('should parse valid WAV file metadata', () => {
      // Create a minimal WAV header
      const buffer = new ArrayBuffer(44 + 100); // Header + some data
      const view = new DataView(buffer);
      
      // RIFF header
      view.setUint8(0, 0x52); // 'R'
      view.setUint8(1, 0x49); // 'I'
      view.setUint8(2, 0x46); // 'F'
      view.setUint8(3, 0x46); // 'F'
      view.setUint32(4, buffer.byteLength - 8, true); // File size - 8
      
      // WAVE
      view.setUint8(8, 0x57);  // 'W'
      view.setUint8(9, 0x41);  // 'A'
      view.setUint8(10, 0x56); // 'V'
      view.setUint8(11, 0x45); // 'E'
      
      // fmt chunk
      view.setUint8(12, 0x66); // 'f'
      view.setUint8(13, 0x6D); // 'm'
      view.setUint8(14, 0x74); // 't'
      view.setUint8(15, 0x20); // ' '
      view.setUint32(16, 16, true); // fmt chunk size
      view.setUint16(20, 1, true); // Audio format (1 = PCM)
      view.setUint16(22, 2, true); // Channels (2 = stereo)
      view.setUint32(24, 44100, true); // Sample rate
      view.setUint32(28, 44100 * 2 * 2, true); // Byte rate
      view.setUint16(32, 4, true); // Block align
      view.setUint16(34, 16, true); // Bits per sample
      
      // data chunk
      view.setUint8(36, 0x64); // 'd'
      view.setUint8(37, 0x61); // 'a'
      view.setUint8(38, 0x74); // 't'
      view.setUint8(39, 0x61); // 'a'
      view.setUint32(40, 100, true); // Data size
      
      const metadata = extractAudioMetadata(buffer);
      
      expect(metadata.format).toBe('wav-pcm');
      expect(metadata.sampleRate).toBe(44100);
      expect(metadata.channels).toBe(2);
      expect(metadata.bitDepth).toBe(16);
      expect(metadata.duration).toBeCloseTo(100 / (44100 * 2 * 2), 2);
    });

    it('should handle WAV with IEEE float format', () => {
      const buffer = new ArrayBuffer(44);
      const view = new DataView(buffer);
      
      // Set up minimal WAV header with float format
      view.setUint8(0, 0x52); // 'R'
      view.setUint8(1, 0x49); // 'I'
      view.setUint8(2, 0x46); // 'F'
      view.setUint8(3, 0x46); // 'F'
      view.setUint32(4, 36, true);
      view.setUint8(8, 0x57);  // 'W'
      view.setUint8(9, 0x41);  // 'A'
      view.setUint8(10, 0x56); // 'V'
      view.setUint8(11, 0x45); // 'E'
      view.setUint8(12, 0x66); // 'f'
      view.setUint8(13, 0x6D); // 'm'
      view.setUint8(14, 0x74); // 't'
      view.setUint8(15, 0x20); // ' '
      view.setUint32(16, 16, true);
      view.setUint16(20, 3, true); // Audio format (3 = IEEE float)
      view.setUint16(22, 1, true); // Mono
      view.setUint32(24, 48000, true); // 48kHz
      view.setUint32(28, 48000 * 4, true); // Byte rate
      view.setUint16(32, 4, true);
      view.setUint16(34, 32, true); // 32-bit float
      view.setUint8(36, 0x64); // 'd'
      view.setUint8(37, 0x61); // 'a'
      view.setUint8(38, 0x74); // 't'
      view.setUint8(39, 0x61); // 'a'
      view.setUint32(40, 0, true);
      
      const metadata = extractAudioMetadata(buffer);
      
      expect(metadata.format).toBe('wav-float');
      expect(metadata.sampleRate).toBe(48000);
      expect(metadata.channels).toBe(1);
      expect(metadata.bitDepth).toBe(32);
    });
  });

  describe('MP3 format', () => {
    it('should detect MP3 format with ID3 tag', () => {
      const buffer = new ArrayBuffer(24);
      const view = new DataView(buffer);
      
      // ID3v2 header
      view.setUint8(0, 0x49); // 'I'
      view.setUint8(1, 0x44); // 'D'
      view.setUint8(2, 0x33); // '3'
      view.setUint8(3, 0x03); // Version
      view.setUint8(4, 0x00); // Revision
      view.setUint8(5, 0x00); // Flags
      // Size (synchsafe integer) - tag size is 10 bytes
      view.setUint8(6, 0x00);
      view.setUint8(7, 0x00);
      view.setUint8(8, 0x00);
      view.setUint8(9, 0x0A); // 10 bytes
      
      // ID3 tag data (10 bytes)
      for (let i = 10; i < 20; i++) {
        view.setUint8(i, 0x00);
      }
      
      // MP3 frame sync at position 20 (after ID3 header + tag)
      view.setUint8(20, 0xFF);
      view.setUint8(21, 0xFB); // MPEG1 Layer 3, 44.1kHz
      view.setUint8(22, 0x90); // 128kbps, stereo
      view.setUint8(23, 0x00);
      
      const metadata = extractAudioMetadata(buffer);
      
      expect(metadata.format).toBe('mp3');
      expect(metadata.channels).toBe(2);
      expect(metadata.bitDepth).toBe(16); // MP3 default
    });

    it('should detect MP3 format without ID3 tag', () => {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      
      // MP3 frame sync
      view.setUint8(0, 0xFF);
      view.setUint8(1, 0xFB);
      view.setUint8(2, 0x90);
      view.setUint8(3, 0x00);
      
      const metadata = extractAudioMetadata(buffer);
      
      expect(metadata.format).toBe('mp3');
    });
  });

  describe('WebM format', () => {
    it('should detect WebM format', () => {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      
      // EBML header
      view.setUint32(0, 0x1A45DFA3, false);
      
      const metadata = extractAudioMetadata(buffer);
      
      expect(metadata.format).toBe('webm-opus');
      expect(metadata.sampleRate).toBe(48000); // Opus default
      expect(metadata.channels).toBe(2);
    });
  });

  describe('Raw format fallback', () => {
    it('should fallback to raw format for unknown data', () => {
      const buffer = new ArrayBuffer(1000);
      
      const metadata = extractAudioMetadata(buffer);
      
      expect(metadata.format).toBe('raw');
      expect(metadata.sampleRate).toBe(44100);
      expect(metadata.channels).toBe(2);
      expect(metadata.bitDepth).toBe(16);
      expect(metadata.duration).toBeCloseTo(1000 / (44100 * 2 * 2), 2);
    });
  });

  describe('Duration calculation', () => {
    it('should calculate correct duration for 11-second WAV file', () => {
      // Create WAV with known duration
      const sampleRate = 44100;
      const channels = 2;
      const bitDepth = 16;
      const duration = 11; // seconds
      const dataSize = sampleRate * channels * (bitDepth / 8) * duration;
      
      const buffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(buffer);
      
      // RIFF header
      view.setUint8(0, 0x52); // 'R'
      view.setUint8(1, 0x49); // 'I'
      view.setUint8(2, 0x46); // 'F'
      view.setUint8(3, 0x46); // 'F'
      view.setUint32(4, buffer.byteLength - 8, true);
      view.setUint8(8, 0x57);  // 'W'
      view.setUint8(9, 0x41);  // 'A'
      view.setUint8(10, 0x56); // 'V'
      view.setUint8(11, 0x45); // 'E'
      
      // fmt chunk
      view.setUint8(12, 0x66); // 'f'
      view.setUint8(13, 0x6D); // 'm'
      view.setUint8(14, 0x74); // 't'
      view.setUint8(15, 0x20); // ' '
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, channels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * channels * (bitDepth / 8), true);
      view.setUint16(32, channels * (bitDepth / 8), true);
      view.setUint16(34, bitDepth, true);
      
      // data chunk
      view.setUint8(36, 0x64); // 'd'
      view.setUint8(37, 0x61); // 'a'
      view.setUint8(38, 0x74); // 't'
      view.setUint8(39, 0x61); // 'a'
      view.setUint32(40, dataSize, true);
      
      const metadata = extractAudioMetadata(buffer);
      
      expect(metadata.duration).toBeCloseTo(11, 1);
    });
  });
});