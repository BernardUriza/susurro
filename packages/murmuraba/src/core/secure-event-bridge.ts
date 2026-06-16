/**
 * Secure Event Bridge for internal communication
 * Replaces the insecure global __murmurabaTDDBridge
 */

import { EventEmitter } from './event-emitter';
import { ProcessingMetrics } from '../types';
import { ChunkProcessor } from '../managers/chunk-processor';

interface BridgeEvents extends Record<string, (...args: any[]) => void> {
  'metrics': (metrics: ProcessingMetrics) => void;
  'chunk-processed': (chunkId: string) => void;
  'recording-manager-registered': (id: string) => void;
  'recording-manager-unregistered': (id: string) => void;
}

class SecureEventBridge extends EventEmitter<BridgeEvents> {
  private static instance: SecureEventBridge | null = null;
  private chunkProcessor: ChunkProcessor | null = null;
  private recordingManagers: Map<string, any> = new Map();
  private readonly accessToken: string;
  
  private constructor() {
    super();
    // Generate a unique access token for this session
    this.accessToken = this.generateAccessToken();
  }
  
  /**
   * Get the singleton instance
   */
  static getInstance(): SecureEventBridge {
    if (!SecureEventBridge.instance) {
      SecureEventBridge.instance = new SecureEventBridge();
    }
    return SecureEventBridge.instance;
  }
  
  /**
   * Reset the singleton (mainly for testing)
   */
  static reset(): void {
    if (SecureEventBridge.instance) {
      SecureEventBridge.instance.removeAllListeners();
      SecureEventBridge.instance.recordingManagers.clear();
      SecureEventBridge.instance = null;
    }
  }
  
  /**
   * Register a chunk processor with validation
   */
  registerChunkProcessor(processor: ChunkProcessor, token: string): void {
    if (!this.validateToken(token)) {
      throw new Error('Invalid access token for chunk processor registration');
    }
    this.chunkProcessor = processor;
  }
  
  /**
   * Register a recording manager with validation
   */
  registerRecordingManager(id: string, manager: any, token: string): void {
    if (!this.validateToken(token)) {
      throw new Error('Invalid access token for recording manager registration');
    }
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid recording manager ID');
    }
    this.recordingManagers.set(id, manager);
    this.emit('recording-manager-registered', id);
  }
  
  /**
   * Unregister a recording manager
   */
  unregisterRecordingManager(id: string, token: string): void {
    if (!this.validateToken(token)) {
      throw new Error('Invalid access token for recording manager unregistration');
    }
    this.recordingManagers.delete(id);
    this.emit('recording-manager-unregistered', id);
  }
  
  /**
   * Notify metrics to all registered managers
   */
  notifyMetrics(metrics: ProcessingMetrics, token: string): void {
    if (!this.validateToken(token)) {
      throw new Error('Invalid access token for metrics notification');
    }
    
    // Validate metrics object
    if (!this.validateMetrics(metrics)) {
      console.warn('Invalid metrics object received');
      return;
    }
    
    // Emit metrics event
    this.emit('metrics', metrics);
    
    // Notify all registered recording managers
    this.recordingManagers.forEach((manager) => {
      try {
        if (manager && typeof manager.notifyMetrics === 'function') {
          manager.notifyMetrics(metrics);
        }
      } catch (error) {
        console.error('Error notifying recording manager:', error);
      }
    });
  }
  
  /**
   * Get the access token (only for internal use)
   */
  getAccessToken(): string {
    return this.accessToken;
  }
  
  /**
   * Get registered recording managers count
   */
  getRecordingManagersCount(): number {
    return this.recordingManagers.size;
  }
  
  /**
   * Generate a secure access token
   */
  private generateAccessToken(): string {
    const array = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array);
    } else if (typeof global !== 'undefined' && global.crypto) {
      (global.crypto as any).getRandomValues(array);
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * Validate access token
   */
  private validateToken(token: string): boolean {
    return token === this.accessToken;
  }
  
  /**
   * Validate metrics object
   */
  private validateMetrics(metrics: any): metrics is ProcessingMetrics {
    if (!metrics || typeof metrics !== 'object') {
      return false;
    }
    
    // Check required fields
    const requiredFields = [
      'noiseReductionLevel',
      'processingLatency',
      'inputLevel',
      'outputLevel',
      'frameCount',
      'droppedFrames',
      'timestamp'
    ];
    
    for (const field of requiredFields) {
      if (!(field in metrics)) {
        return false;
      }
      
      // Validate numeric fields
      if (field !== 'timestamp' && (typeof metrics[field] !== 'number' || isNaN(metrics[field]) || !isFinite(metrics[field]))) {
        return false;
      }
    }
    
    // Validate ranges
    if (metrics.inputLevel < 0 || metrics.inputLevel > 1) return false;
    if (metrics.outputLevel < 0 || metrics.outputLevel > 1) return false;
    if (metrics.noiseReductionLevel < 0 || metrics.noiseReductionLevel > 100) return false;
    if (metrics.processingLatency < 0) return false;
    
    return true;
  }
}

export { SecureEventBridge };
export type { BridgeEvents };