import { ProcessedChunk } from './types';
import { AudioConverter } from '../../utils/audio-converter';
import { DEFAULT_MP3_BITRATE, LOG_PREFIX } from './constants';

export class AudioExporter {
  private audioConverter: AudioConverter | null = null;

  setAudioConverter(converter: AudioConverter): void {
    this.audioConverter = converter;
  }

  /**
   * Export chunk as WAV
   */
  async exportChunkAsWav(
    chunk: ProcessedChunk,
    audioType: 'processed' | 'original'
  ): Promise<Blob> {
    const audioUrl = audioType === 'processed' ? chunk.processedAudioUrl : chunk.originalAudioUrl;
    if (!audioUrl) {
      throw new Error(`No ${audioType} audio URL available for chunk ${chunk.id}`);
    }

    console.log(`📦 ${LOG_PREFIX.EXPORT} Exporting chunk ${chunk.id} as WAV (${audioType})...`);
    
    const response = await fetch(audioUrl);
    const webmBlob = await response.blob();
    
    if (!this.audioConverter) {
      throw new Error('Audio converter not initialized');
    }
    
    return AudioConverter.webmToWav(webmBlob);
  }

  /**
   * Export chunk as MP3
   */
  async exportChunkAsMp3(
    chunk: ProcessedChunk,
    audioType: 'processed' | 'original',
    bitrate: number = DEFAULT_MP3_BITRATE
  ): Promise<Blob> {
    const audioUrl = audioType === 'processed' ? chunk.processedAudioUrl : chunk.originalAudioUrl;
    if (!audioUrl) {
      throw new Error(`No ${audioType} audio URL available for chunk ${chunk.id}`);
    }

    console.log(`📦 ${LOG_PREFIX.EXPORT} Exporting chunk ${chunk.id} as MP3 (${audioType}, ${bitrate}kbps)...`);
    
    const response = await fetch(audioUrl);
    const webmBlob = await response.blob();
    
    return AudioConverter.webmToMp3(webmBlob, bitrate);
  }

  /**
   * Download chunk in specified format
   */
  async downloadChunk(
    chunk: ProcessedChunk,
    format: 'webm' | 'wav' | 'mp3',
    audioType: 'processed' | 'original'
  ): Promise<void> {
    let blob: Blob;
    let filename: string;
    const timestamp = new Date(chunk.startTime).toISOString().replace(/:/g, '-').split('.')[0];
    const prefix = audioType === 'processed' ? 'enhanced' : 'original';
    
    if (format === 'webm') {
      const audioUrl = audioType === 'processed' ? chunk.processedAudioUrl : chunk.originalAudioUrl;
      if (!audioUrl) {
        throw new Error(`No ${audioType} audio URL available`);
      }
      const response = await fetch(audioUrl);
      blob = await response.blob();
      filename = `${prefix}_${timestamp}.webm`;
    } else if (format === 'wav') {
      blob = await this.exportChunkAsWav(chunk, audioType);
      filename = `${prefix}_${timestamp}.wav`;
    } else if (format === 'mp3') {
      blob = await this.exportChunkAsMp3(chunk, audioType);
      filename = `${prefix}_${timestamp}.mp3`;
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    console.log(`✅ ${LOG_PREFIX.EXPORT} Downloaded ${filename}`);
  }

  /**
   * Download all chunks as ZIP
   */
  async downloadAllChunksAsZip(
    chunks: ProcessedChunk[], 
    audioType: 'processed' | 'original' | 'both' = 'both'
  ): Promise<void> {
    if (chunks.length === 0) {
      throw new Error('No chunks available to export');
    }

    console.log(`📦 ${LOG_PREFIX.EXPORT} Creating ZIP with ${chunks.length} chunks (${audioType})...`);

    // Dynamic import for JSZip to reduce bundle size
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    // Process each chunk
    for (const chunk of chunks) {
      const timestamp = new Date(chunk.startTime).toISOString().replace(/:/g, '-').split('.')[0];
      const chunkIndex = chunks.indexOf(chunk) + 1;

      try {
        if (audioType === 'processed' || audioType === 'both') {
          if (chunk.processedAudioUrl) {
            const blob = await this.exportChunkAsWav(chunk, 'processed');
            zip.file(`chunk_${chunkIndex.toString().padStart(3, '0')}_enhanced_${timestamp}.wav`, blob);
          }
        }

        if (audioType === 'original' || audioType === 'both') {
          if (chunk.originalAudioUrl) {
            const blob = await this.exportChunkAsWav(chunk, 'original');
            zip.file(`chunk_${chunkIndex.toString().padStart(3, '0')}_original_${timestamp}.wav`, blob);
          }
        }
      } catch (error) {
        console.warn(`⚠️ ${LOG_PREFIX.EXPORT} Failed to export chunk ${chunk.id}:`, error);
      }
    }

    // Generate ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `murmuraba_recordings_${audioType}_${timestamp}.zip`;

    // Download ZIP
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    console.log(`✅ ${LOG_PREFIX.EXPORT} Downloaded ZIP: ${filename}`);
  }
}