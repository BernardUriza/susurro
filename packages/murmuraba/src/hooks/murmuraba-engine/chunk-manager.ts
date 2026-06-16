import { ProcessedChunk, RecordingState } from './types';
import { URLManager } from './url-manager';
import { MAX_CHUNKS_IN_MEMORY, CHUNKS_TO_KEEP_ON_OVERFLOW, LOG_PREFIX } from './constants';

export class ChunkManager {
  private urlManager: URLManager;

  constructor(urlManager: URLManager) {
    this.urlManager = urlManager;
  }

  /**
   * Add a new chunk with memory management
   */
  addChunk(
    currentState: RecordingState,
    newChunk: ProcessedChunk
  ): RecordingState {
    let updatedChunks = [...currentState.chunks, newChunk];
    
    // CRITICAL FOR MEDICAL APP: Prevent memory overflow during long recordings
    if (updatedChunks.length > MAX_CHUNKS_IN_MEMORY) {
      console.warn(`⚠️ ${LOG_PREFIX.MEDICAL_MEMORY} Chunk limit reached (${MAX_CHUNKS_IN_MEMORY}). Removing oldest chunks...`);
      
      // Remove oldest chunks and revoke their URLs
      const chunksToRemove = updatedChunks.slice(0, updatedChunks.length - CHUNKS_TO_KEEP_ON_OVERFLOW);
      chunksToRemove.forEach(chunk => {
        this.urlManager.revokeChunkUrls(chunk.id);
      });
      
      updatedChunks = updatedChunks.slice(-CHUNKS_TO_KEEP_ON_OVERFLOW);
    }
    
    return {
      ...currentState,
      chunks: updatedChunks
    };
  }

  /**
   * Toggle chunk playback state
   */
  toggleChunkPlayback(
    chunks: ProcessedChunk[],
    chunkId: string,
    isPlaying: boolean
  ): ProcessedChunk[] {
    return chunks.map(chunk => ({
      ...chunk,
      isPlaying: chunk.id === chunkId ? isPlaying : false
    }));
  }

  /**
   * Toggle chunk expansion state
   */
  toggleChunkExpansion(
    chunks: ProcessedChunk[],
    chunkId: string
  ): ProcessedChunk[] {
    return chunks.map(chunk => ({
      ...chunk,
      isExpanded: chunk.id === chunkId ? !chunk.isExpanded : false
    }));
  }

  /**
   * Find chunk by ID
   */
  findChunk(chunks: ProcessedChunk[], chunkId: string): ProcessedChunk | undefined {
    return chunks.find(c => c.id === chunkId);
  }

  /**
   * Clear all chunks
   */
  clearChunks(chunks: ProcessedChunk[]): void {
    // Revoke all URLs before clearing
    chunks.forEach(chunk => {
      this.urlManager.revokeChunkUrls(chunk.id);
    });
  }

  /**
   * Revoke URLs for all chunks
   */
  revokeChunkUrls(chunks: ProcessedChunk[]): void {
    chunks.forEach(chunk => {
      this.urlManager.revokeChunkUrls(chunk.id);
    });
  }

  /**
   * Calculate average noise reduction
   */
  getAverageNoiseReduction(chunks: ProcessedChunk[]): number {
    const validChunks = chunks.filter(c => c.isValid !== false);
    if (validChunks.length === 0) return 0;
    
    const sum = validChunks.reduce((acc, chunk) => acc + chunk.noiseRemoved, 0);
    return sum / validChunks.length;
  }
}