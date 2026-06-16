/**
 * Medical-grade URL management to prevent memory leaks
 * Critical for long recording sessions in hospitals
 */

export class URLManager {
  private objectUrls: Map<string, Set<string>>;

  constructor() {
    this.objectUrls = new Map();
  }

  /**
   * Create and track an object URL
   */
  createObjectURL(chunkId: string, blob: Blob): string {
    const url = URL.createObjectURL(blob);
    
    if (!this.objectUrls.has(chunkId)) {
      this.objectUrls.set(chunkId, new Set());
    }
    
    this.objectUrls.get(chunkId)!.add(url);
    return url;
  }

  /**
   * Revoke all URLs for a specific chunk
   */
  revokeChunkUrls(chunkId: string): void {
    const urls = this.objectUrls.get(chunkId);
    if (urls) {
      urls.forEach(url => {
        URL.revokeObjectURL(url);
      });
      this.objectUrls.delete(chunkId);
    }
  }

  /**
   * Revoke all tracked URLs (for cleanup)
   */
  revokeAllUrls(): void {
    this.objectUrls.forEach((urls, chunkId) => {
      urls.forEach(url => {
        URL.revokeObjectURL(url);
      });
    });
    this.objectUrls.clear();
  }

  /**
   * Get statistics about tracked URLs
   */
  getStats(): { totalChunks: number; totalUrls: number } {
    let totalUrls = 0;
    this.objectUrls.forEach(urls => {
      totalUrls += urls.size;
    });
    
    return {
      totalChunks: this.objectUrls.size,
      totalUrls
    };
  }
}