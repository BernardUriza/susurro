/**
 * Audio Format Converter Utility
 * Converts WebM/Opus audio to WAV format for universal browser playback
 */

export class AudioConverter {
  private audioContext: AudioContext;
  // CRITICAL FOR MEDICAL APP: Track created URLs for cleanup
  private createdUrls = new Set<string>();
  
  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  
  /**
   * Convert a Blob from WebM/Opus to WAV format
   */
  async convertToWav(blob: Blob): Promise<Blob> {
    try {
      // First, try to decode the audio data
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
      
      // Convert to WAV
      const wavBlob = this.audioBufferToWav(audioBuffer);
      console.log('Successfully converted to WAV, size:', wavBlob.size);
      return wavBlob;
    } catch (error) {
      console.error('Failed to convert audio:', error);
      throw error;
    }
  }
  
  /**
   * Convert WebM blob to WAV blob (static method for easy use)
   */
  static async webmToWav(webmBlob: Blob): Promise<Blob> {
    const converter = new AudioConverter();
    return converter.convertToWav(webmBlob);
  }
  
  /**
   * Convert WebM to MP3 using lamejs
   */
  static async webmToMp3(webmBlob: Blob, bitrate: number = 128): Promise<Blob> {
    const converter = new AudioConverter();
    
    try {
      // Import lamejs dynamically
      const lamejs = await import('lamejs');
      
      // First decode to AudioBuffer
      const arrayBuffer = await webmBlob.arrayBuffer();
      const audioBuffer = await converter.audioContext.decodeAudioData(arrayBuffer);
      
      // Convert to mono if stereo (lamejs works better with mono)
      const sampleRate = audioBuffer.sampleRate;
      const samples = audioBuffer.length;
      
      // Get PCM data
      const pcmData = new Int16Array(samples);
      const channelData = audioBuffer.getChannelData(0); // Use first channel
      
      // Convert float32 to int16
      for (let i = 0; i < samples; i++) {
        const s = Math.max(-1, Math.min(1, channelData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      // Initialize MP3 encoder
      const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, bitrate);
      
      // Encode samples
      const mp3Data: Int8Array[] = [];
      const sampleBlockSize = 1152; // Must be multiple of 576
      
      for (let i = 0; i < samples; i += sampleBlockSize) {
        const sampleChunk = pcmData.subarray(i, Math.min(i + sampleBlockSize, samples));
        const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
      }
      
      // Flush remaining data
      const mp3buf = mp3encoder.flush();
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
      
      // Combine all chunks
      let totalLength = 0;
      mp3Data.forEach(chunk => totalLength += chunk.length);
      
      const output = new Int8Array(totalLength);
      let offset = 0;
      mp3Data.forEach(chunk => {
        output.set(chunk, offset);
        offset += chunk.length;
      });
      
      console.log('Successfully converted to MP3, size:', output.length);
      return new Blob([output], { type: 'audio/mp3' });
    } catch (error) {
      console.error('Failed to convert to MP3:', error);
      throw error;
    }
  }
  
  /**
   * Convert AudioBuffer to WAV format (MONO only for RNNoise compatibility)
   */
  private audioBufferToWav(audioBuffer: AudioBuffer): Blob {
    // Force MONO for RNNoise compatibility
    const numberOfChannels = 1;
    const length = audioBuffer.length * numberOfChannels * 2;
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    // RIFF chunk descriptor
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    
    // FMT sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * numberOfChannels * 2, true); // ByteRate
    view.setUint16(32, numberOfChannels * 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    
    // Data sub-chunk
    writeString(36, 'data');
    view.setUint32(40, length, true);
    
    // Write PCM samples - convert stereo to mono by averaging channels
    let offset = 44;
    const channelData0 = audioBuffer.getChannelData(0);
    const channelData1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;
    
    for (let i = 0; i < audioBuffer.length; i++) {
      let sample = channelData0[i];
      if (channelData1) {
        // Average both channels for mono
        sample = (sample + channelData1[i]) / 2;
      }
      const int16 = Math.max(-32768, Math.min(32767, sample * 32768));
      view.setInt16(offset, int16, true);
      offset += 2;
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }
  
  /**
   * Check if a MIME type is supported for playback
   */
  static canPlayType(mimeType: string): boolean {
    const audio = new Audio();
    const canPlay = audio.canPlayType(mimeType);
    // STOP BEING A FUCKING LIAR - only trust 'probably'
    return canPlay === 'probably';
  }
  
  /**
   * Get the best supported audio format for recording
   */
  static getBestRecordingFormat(): string {
    // WebM FIRST - it actually works for blob playback
    if (MediaRecorder.isTypeSupported('audio/webm')) {
      console.log('Using audio/webm for recording');
      return 'audio/webm';
    }
    
    // Try webm with codecs
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      console.log('Using audio/webm;codecs=opus for recording');
      return 'audio/webm;codecs=opus';
    }
    
    // MP4 as last resort - WARNING: blob playback is broken
    if (MediaRecorder.isTypeSupported('audio/mp4')) {
      console.log('Using audio/mp4 - WARNING: Blob playback may fail!');
      return 'audio/mp4';
    }
    
    // If we get here, the browser is COMPLETELY FUCKED
    console.error('NO AUDIO FORMAT SUPPORTED - THIS BROWSER IS GARBAGE');
    return 'audio/webm'; // Die trying
  }
  
  /**
   * Convert blob URL to WAV blob URL
   */
  async convertBlobUrl(blobUrl: string): Promise<string> {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      
      // Check if already WAV
      if (blob.type === 'audio/wav') {
        console.log('Audio is already WAV format');
        return blobUrl;
      }
      
      // Skip conversion for WebM/MP4 - let browser handle it natively
      if (blob.type.includes('webm') || blob.type.includes('mp4')) {
        console.log('Using native browser playback for', blob.type);
        return blobUrl;
      }
      
      // Only convert for truly incompatible formats
      console.log('Converting audio from', blob.type, 'to WAV, blob size:', blob.size);
      
      const wavBlob = await this.convertToWav(blob);
      const wavUrl = URL.createObjectURL(wavBlob);
      
      // CRITICAL: Track URL for cleanup in medical app
      this.createdUrls.add(wavUrl);
      
      console.log('Audio converted successfully to WAV, new size:', wavBlob.size);
      return wavUrl;
    } catch (error) {
      console.error('Error converting blob URL:', error);
      console.error('Falling back to original URL');
      // Return original URL as fallback
      return blobUrl;
    }
  }
  
  /**
   * CRITICAL FOR MEDICAL APP: Clean up all created URLs to prevent memory leaks
   * Must be called when the converter is no longer needed
   */
  destroy(): void {
    // Revoke all created URLs
    this.createdUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.createdUrls.clear();
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}

// Singleton instance
let converterInstance: AudioConverter | null = null;

export function getAudioConverter(): AudioConverter {
  if (!converterInstance) {
    converterInstance = new AudioConverter();
  }
  return converterInstance;
}

/**
 * CRITICAL FOR MEDICAL APP: Destroy the singleton and clean up all resources
 * Must be called when the application is shutting down or during cleanup
 */
export function destroyAudioConverter(): void {
  if (converterInstance) {
    converterInstance.destroy();
    converterInstance = null;
  }
}