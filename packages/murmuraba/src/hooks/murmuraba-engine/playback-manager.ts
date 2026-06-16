import { ProcessedChunk } from './types';
import { LOG_PREFIX } from './constants';

export class PlaybackManager {
  private audioElements = new Map<string, HTMLAudioElement>();
  private stateChangeCallback?: (chunkId: string, isPlaying: boolean) => void;
  
  /**
   * Toggle chunk playback
   */
  async toggleChunkPlayback(
    chunk: ProcessedChunk,
    audioType: 'processed' | 'original',
    onPlayStateChange: (chunkId: string, isPlaying: boolean) => void
  ): Promise<void> {
    // Store the callback for global state management
    this.stateChangeCallback = onPlayStateChange;
    const audioUrl = audioType === 'processed' ? chunk.processedAudioUrl : chunk.originalAudioUrl;
    if (!audioUrl) {
      console.error(`❌ ${LOG_PREFIX.ERROR} No ${audioType} audio URL for chunk ${chunk.id}`);
      return;
    }
    
    // Get or create audio element
    const audioKey = `${chunk.id}-${audioType}`;
    let audio = this.audioElements.get(audioKey);
    
    if (!audio) {
      audio = new Audio(audioUrl);
      this.audioElements.set(audioKey, audio);
      
      // Set up event listeners
      audio.addEventListener('ended', () => {
        onPlayStateChange(chunk.id, false);
      });
      
      audio.addEventListener('error', (e) => {
        console.error(`❌ ${LOG_PREFIX.ERROR} Audio playback error:`, e);
        onPlayStateChange(chunk.id, false);
      });
    }
    
    // Check if this specific audio is already playing
    const isThisAudioPlaying = !audio.paused;
    
    if (isThisAudioPlaying) {
      // Stop this specific audio
      audio.pause();
      audio.currentTime = 0;
      onPlayStateChange(chunk.id, false);
    } else {
      // Stop all audio from OTHER chunks, but not from this chunk
      this.stopAllAudioExceptChunk(chunk.id);
      
      // Stop the other audio type of the same chunk
      const otherAudioType = audioType === 'processed' ? 'original' : 'processed';
      const otherAudioKey = `${chunk.id}-${otherAudioType}`;
      const otherAudio = this.audioElements.get(otherAudioKey);
      if (otherAudio && !otherAudio.paused) {
        otherAudio.pause();
        otherAudio.currentTime = 0;
      }
      
      // Start playback
      try {
        await audio.play();
        onPlayStateChange(chunk.id, true);
      } catch (error) {
        console.error(`❌ ${LOG_PREFIX.ERROR} Failed to play audio:`, error);
        onPlayStateChange(chunk.id, false);
      }
    }
  }
  
  /**
   * Stop all audio playback
   */
  stopAllAudio(): void {
    this.audioElements.forEach((audio, key) => {
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
        
        // Extract chunk ID from key and update state
        const keyChunkId = key.split('-')[0];
        if (this.stateChangeCallback) {
          this.stateChangeCallback(keyChunkId, false);
        }
      }
    });
  }
  
  /**
   * Stop all audio except for a specific chunk
   */
  private stopAllAudioExceptChunk(chunkId: string): void {
    this.audioElements.forEach((audio, key) => {
      if (!key.startsWith(chunkId) && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
        
        // Extract chunk ID from key (format: "chunkId-audioType")
        const keyChunkId = key.split('-')[0];
        if (this.stateChangeCallback) {
          this.stateChangeCallback(keyChunkId, false);
        }
      }
    });
  }
  
  /**
   * Clean up audio elements for a chunk
   */
  cleanupChunk(chunkId: string): void {
    const keysToRemove: string[] = [];
    
    this.audioElements.forEach((audio, key) => {
      if (key.startsWith(chunkId)) {
        audio.pause();
        audio.src = '';
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => this.audioElements.delete(key));
  }
  
  /**
   * Clean up all audio elements
   */
  cleanup(): void {
    this.audioElements.forEach(audio => {
      audio.pause();
      audio.src = '';
    });
    this.audioElements.clear();
  }
}