import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioExporter } from '../../../hooks/murmuraba-engine/audio-exporter';
import { AudioConverter } from '../../../utils/audio-converter';
import { ProcessedChunk } from '../../../hooks/murmuraba-engine/types';

// Mock the AudioConverter
vi.mock('../../../utils/audio-converter', () => ({
  AudioConverter: {
    webmToWav: vi.fn(),
    webmToMp3: vi.fn()
  }
}));

// Mock fetch
global.fetch = vi.fn();

// Mock document methods
const mockCreateElement = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockClick = vi.fn();

describe('AudioExporter', () => {
  let audioExporter: AudioExporter;
  let mockBlob: Blob;
  let mockProcessedChunk: ProcessedChunk;
  let originalDocument: Document;

  beforeEach(() => {
    audioExporter = new AudioExporter();
    mockBlob = new Blob(['mock audio data'], { type: 'audio/webm' });

    // Setup mock chunk
    mockProcessedChunk = {
      id: 'chunk-1',
      startTime: 1000,
      endTime: 2000,
      processedAudioUrl: 'blob:processed-audio-url',
      originalAudioUrl: 'blob:original-audio-url',
      vad: { isSpeech: true, averageScore: 0.8 },
      metrics: {
        inputLevel: 0.5,
        outputLevel: 0.4,
        noiseReduction: 0.3
      }
    };

    // Setup fetch mock
    (global.fetch as any).mockResolvedValue({
      blob: vi.fn().mockResolvedValue(mockBlob)
    });

    // Setup document mocks
    originalDocument = global.document;
    const mockLink = {
      href: '',
      download: '',
      click: mockClick
    };

    mockCreateElement.mockReturnValue(mockLink);
    
    global.document = {
      ...originalDocument,
      createElement: mockCreateElement,
      body: {
        appendChild: mockAppendChild,
        removeChild: mockRemoveChild
      }
    } as any;

    // Setup URL mocks
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.document = originalDocument;
  });

  describe('setAudioConverter', () => {
    it('should set the audio converter', () => {
      const mockConverter = {} as AudioConverter;
      audioExporter.setAudioConverter(mockConverter);
      // This method doesn't have a return value, but we can test it doesn't throw
      expect(() => audioExporter.setAudioConverter(mockConverter)).not.toThrow();
    });
  });

  describe('exportChunkAsWav', () => {
    beforeEach(() => {
      audioExporter.setAudioConverter({} as AudioConverter);
      (AudioConverter.webmToWav as any).mockResolvedValue(new Blob(['wav data'], { type: 'audio/wav' }));
    });

    it('should export processed audio as WAV', async () => {
      const result = await audioExporter.exportChunkAsWav(mockProcessedChunk, 'processed');
      
      expect(fetch).toHaveBeenCalledWith('blob:processed-audio-url');
      expect(AudioConverter.webmToWav).toHaveBeenCalledWith(mockBlob);
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('audio/wav');
    });

    it('should export original audio as WAV', async () => {
      const result = await audioExporter.exportChunkAsWav(mockProcessedChunk, 'original');
      
      expect(fetch).toHaveBeenCalledWith('blob:original-audio-url');
      expect(AudioConverter.webmToWav).toHaveBeenCalledWith(mockBlob);
      expect(result).toBeInstanceOf(Blob);
    });

    it('should throw error if no audio URL is available', async () => {
      const chunkWithoutUrl = { ...mockProcessedChunk, processedAudioUrl: undefined };
      
      await expect(audioExporter.exportChunkAsWav(chunkWithoutUrl, 'processed'))
        .rejects.toThrow('No processed audio URL available for chunk chunk-1');
    });

    it('should throw error if audio converter is not initialized', async () => {
      const newExporter = new AudioExporter();
      
      await expect(newExporter.exportChunkAsWav(mockProcessedChunk, 'processed'))
        .rejects.toThrow('Audio converter not initialized');
    });
  });

  describe('exportChunkAsMp3', () => {
    beforeEach(() => {
      audioExporter.setAudioConverter({} as AudioConverter);
      (AudioConverter.webmToMp3 as any).mockResolvedValue(new Blob(['mp3 data'], { type: 'audio/mp3' }));
    });

    it('should export processed audio as MP3 with default bitrate', async () => {
      const result = await audioExporter.exportChunkAsMp3(mockProcessedChunk, 'processed');
      
      expect(fetch).toHaveBeenCalledWith('blob:processed-audio-url');
      expect(AudioConverter.webmToMp3).toHaveBeenCalledWith(mockBlob, 128);
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('audio/mp3');
    });

    it('should export with custom bitrate', async () => {
      await audioExporter.exportChunkAsMp3(mockProcessedChunk, 'processed', 192);
      
      expect(AudioConverter.webmToMp3).toHaveBeenCalledWith(mockBlob, 192);
    });

    it('should export original audio as MP3', async () => {
      const result = await audioExporter.exportChunkAsMp3(mockProcessedChunk, 'original');
      
      expect(fetch).toHaveBeenCalledWith('blob:original-audio-url');
      expect(result).toBeInstanceOf(Blob);
    });

    it('should throw error if no audio URL is available', async () => {
      const chunkWithoutUrl = { ...mockProcessedChunk, originalAudioUrl: undefined };
      
      await expect(audioExporter.exportChunkAsMp3(chunkWithoutUrl, 'original'))
        .rejects.toThrow('No original audio URL available for chunk chunk-1');
    });
  });

  describe('downloadChunk', () => {
    beforeEach(() => {
      audioExporter.setAudioConverter({} as AudioConverter);
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should download chunk as WebM', async () => {
      await audioExporter.downloadChunk(mockProcessedChunk, 'webm', 'processed');
      
      expect(fetch).toHaveBeenCalledWith('blob:processed-audio-url');
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
      
      // Check filename format
      const link = mockCreateElement.mock.results[0].value;
      expect(link.download).toMatch(/^enhanced_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.webm$/);
    });

    it('should download original audio as WebM', async () => {
      await audioExporter.downloadChunk(mockProcessedChunk, 'webm', 'original');
      
      expect(fetch).toHaveBeenCalledWith('blob:original-audio-url');
      const link = mockCreateElement.mock.results[0].value;
      expect(link.download).toMatch(/^original_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.webm$/);
    });

    it('should download chunk as WAV', async () => {
      (AudioConverter.webmToWav as any).mockResolvedValue(new Blob(['wav data'], { type: 'audio/wav' }));
      
      await audioExporter.downloadChunk(mockProcessedChunk, 'wav', 'processed');
      
      expect(AudioConverter.webmToWav).toHaveBeenCalled();
      const link = mockCreateElement.mock.results[0].value;
      expect(link.download).toMatch(/^enhanced_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.wav$/);
    });

    it('should download chunk as MP3', async () => {
      (AudioConverter.webmToMp3 as any).mockResolvedValue(new Blob(['mp3 data'], { type: 'audio/mp3' }));
      
      await audioExporter.downloadChunk(mockProcessedChunk, 'mp3', 'original');
      
      expect(AudioConverter.webmToMp3).toHaveBeenCalled();
      const link = mockCreateElement.mock.results[0].value;
      expect(link.download).toMatch(/^original_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.mp3$/);
    });

    it('should throw error for unsupported format', async () => {
      await expect(audioExporter.downloadChunk(mockProcessedChunk, 'ogg' as any, 'processed'))
        .rejects.toThrow('Unsupported format: ogg');
    });

    it('should throw error if no WebM URL is available', async () => {
      const chunkWithoutUrl = { ...mockProcessedChunk, processedAudioUrl: undefined };
      
      await expect(audioExporter.downloadChunk(chunkWithoutUrl, 'webm', 'processed'))
        .rejects.toThrow('No processed audio URL available');
    });

    it('should revoke object URL after delay', async () => {
      await audioExporter.downloadChunk(mockProcessedChunk, 'webm', 'processed');
      
      expect(global.URL.revokeObjectURL).not.toHaveBeenCalled();
      
      // Fast-forward time
      vi.advanceTimersByTime(100);
      
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  describe('error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));
      audioExporter.setAudioConverter({} as AudioConverter);
      
      await expect(audioExporter.exportChunkAsWav(mockProcessedChunk, 'processed'))
        .rejects.toThrow('Network error');
    });

    it('should handle blob conversion errors', async () => {
      (global.fetch as any).mockResolvedValue({
        blob: vi.fn().mockRejectedValue(new Error('Blob conversion failed'))
      });
      audioExporter.setAudioConverter({} as AudioConverter);
      
      await expect(audioExporter.exportChunkAsWav(mockProcessedChunk, 'processed'))
        .rejects.toThrow('Blob conversion failed');
    });
  });
});