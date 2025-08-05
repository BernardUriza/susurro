/**
 * Global Audio Engine Manager
 * Singleton pattern to ensure only one engine instance exists
 */

import { 
  initializeAudioEngine as murmubaraInit, 
  destroyEngine as murmubaraDestroy,
  type MurmubaraConfig
} from 'murmuraba';

class AudioEngineManager {
  private static instance: AudioEngineManager;
  private isInitialized: boolean = false;
  private isInitializing: boolean = false;
  private initPromise: Promise<void> | null = null;
  
  private constructor() {}
  
  static getInstance(): AudioEngineManager {
    if (!AudioEngineManager.instance) {
      AudioEngineManager.instance = new AudioEngineManager();
    }
    return AudioEngineManager.instance;
  }
  
  async initialize(config: Partial<MurmubaraConfig> = {}): Promise<void> {
    console.log('[AudioEngineManager] Initialize called, current state:', {
      isInitialized: this.isInitialized,
      isInitializing: this.isInitializing
    });
    
    // If already initialized, return immediately
    if (this.isInitialized) {
      console.log('[AudioEngineManager] Engine already initialized, skipping');
      return;
    }
    
    // If initialization is in progress, wait for it
    if (this.isInitializing && this.initPromise) {
      console.log('[AudioEngineManager] Initialization in progress, waiting...');
      return this.initPromise;
    }
    
    // Start new initialization
    this.isInitializing = true;
    
    this.initPromise = (async () => {
      try {
        // Always try to destroy first to ensure clean state
        await this.forceDestroy();
        
        console.log('[AudioEngineManager] Initializing Murmuraba engine...');
        
        // Use proper MurmubaraConfig properties
        const finalConfig: MurmubaraConfig = {
          logLevel: 'info',
          noiseReductionLevel: 'high',
          algorithm: 'rnnoise',
          useAudioWorklet: true,
          autoCleanup: true,
          ...config
        };
        
        await murmubaraInit(finalConfig);
        
        this.isInitialized = true;
        console.log('[AudioEngineManager] Engine initialized successfully');
      } catch (error: any) {
        // Check if error is about already initialized engine
        if (error?.message?.includes('already initialized')) {
          console.log('[AudioEngineManager] Engine was already initialized, marking as ready');
          this.isInitialized = true;
          return; // Don't throw, just mark as initialized
        }
        console.error('[AudioEngineManager] Initialization failed:', error);
        this.isInitialized = false;
        throw error;
      } finally {
        this.isInitializing = false;
        this.initPromise = null;
      }
    })();
    
    return this.initPromise;
  }
  
  async destroy(): Promise<void> {
    console.log('[AudioEngineManager] Destroy called, current state:', {
      isInitialized: this.isInitialized
    });
    
    if (!this.isInitialized) {
      console.log('[AudioEngineManager] Engine not initialized, nothing to destroy');
      return;
    }
    
    try {
      console.log('[AudioEngineManager] Destroying engine...');
      await murmubaraDestroy();
      this.isInitialized = false;
      console.log('[AudioEngineManager] Engine destroyed successfully');
    } catch (error) {
      console.error('[AudioEngineManager] Destroy failed:', error);
      // Force state reset even if destroy fails
      this.isInitialized = false;
    }
  }
  
  private async forceDestroy(): Promise<void> {
    try {
      console.log('[AudioEngineManager] Force destroying any existing engine...');
      await murmubaraDestroy();
      this.isInitialized = false;
    } catch (error) {
      // Ignore errors during force destroy
      console.log('[AudioEngineManager] Force destroy completed (error ignored):', error);
      this.isInitialized = false;
    }
  }
  
  async reset(): Promise<void> {
    console.log('[AudioEngineManager] Reset called');
    await this.destroy();
    // Small delay to ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  getState(): { isInitialized: boolean; isInitializing: boolean } {
    return {
      isInitialized: this.isInitialized,
      isInitializing: this.isInitializing
    };
  }
}

export const audioEngineManager = AudioEngineManager.getInstance();