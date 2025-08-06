/**
 * @deprecated This singleton pattern has been replaced with hook-based architecture.
 * Use useModelCache hook instead of this manager.
 * This file will be removed in a future version.
 * 
 * Migration: Replace cacheManager usage with useModelCache hook.
 */

// DEPRECATED: Cache Manager for Transformers.js models
// Uses multiple storage strategies for maximum persistence

interface CacheStatus {
  hasCache: boolean;
  cacheSize?: number;
  lastUpdated?: Date;
}

class ModelCacheManager {
  private static instance: ModelCacheManager;
  private dbName = 'whisper-models-cache';
  private storeName = 'models';
  private cacheVersion = 1;

  private constructor() {}

  static getInstance(): ModelCacheManager {
    if (!ModelCacheManager.instance) {
      ModelCacheManager.instance = new ModelCacheManager();
    }
    return ModelCacheManager.instance;
  }

  // Initialize IndexedDB for model storage
  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.cacheVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  // Store model data in IndexedDB
  async storeModel(modelId: string, data: ArrayBuffer): Promise<void> {
    const db = await this.initDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);

    return new Promise((resolve, reject) => {
      const request = store.put({
        id: modelId,
        data: data,
        timestamp: Date.now(),
        size: data.byteLength,
      });

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Retrieve model from IndexedDB
  async getModel(modelId: string): Promise<ArrayBuffer | null> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve) => {
        const request = store.get(modelId);
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.data) {
            resolve(result.data);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    } catch (error) {
      return null;
    }
  }

  // Check if model exists in cache
  async hasModel(modelId: string): Promise<boolean> {
    const model = await this.getModel(modelId);
    return model !== null;
  }

  // Get cache status
  async getCacheStatus(): Promise<CacheStatus> {
    console.log('[CACHE MANAGER] Getting cache status...');
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const models = request.result;
          console.log('[CACHE MANAGER] Found', models.length, 'cached models');
          
          if (models.length > 0) {
            const totalSize = models.reduce((sum, model) => sum + (model.size || 0), 0);
            const lastUpdated = new Date(Math.max(...models.map((m) => m.timestamp || 0)));

            console.log('[CACHE MANAGER] Cache details:', {
              modelCount: models.length,
              totalSize: `${(totalSize / 1048576).toFixed(2)} MB`,
              lastUpdated: lastUpdated.toISOString(),
              models: models.map(m => ({
                id: m.id,
                size: `${((m.size || 0) / 1048576).toFixed(2)} MB`,
                timestamp: new Date(m.timestamp || 0).toISOString()
              }))
            });

            resolve({
              hasCache: true,
              cacheSize: totalSize,
              lastUpdated: lastUpdated,
            });
          } else {
            console.log('[CACHE MANAGER] No cached models found');
            resolve({ hasCache: false });
          }
        };
        request.onerror = () => {
          console.error('[CACHE MANAGER] Error reading cache:', request.error);
          resolve({ hasCache: false });
        };
      });
    } catch (error) {
      console.error('[CACHE MANAGER] Failed to get cache status:', error);
      return { hasCache: false };
    }
  }

  // Clear all cached models
  async clearCache(): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {}
  }

  // Get storage estimate
  async getStorageInfo(): Promise<{ usage: number; quota: number } | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
        };
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  // Request persistent storage
  async requestPersistentStorage(): Promise<boolean> {
    console.log('[CACHE MANAGER] Requesting persistent storage...');
    
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        // Check current persistence status
        const currentlyPersisted = await navigator.storage.persisted();
        console.log('[CACHE MANAGER] Current persistence status:', currentlyPersisted);
        
        if (currentlyPersisted) {
          console.log('[CACHE MANAGER] Storage is already persistent');
          return true;
        }
        
        // Request persistence
        const isPersisted = await navigator.storage.persist();
        console.log('[CACHE MANAGER] Persistence request result:', isPersisted);
        
        // Get storage estimate after persistence request
        if ('estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          console.log('[CACHE MANAGER] Storage estimate after persistence:', {
            usage: `${((estimate.usage || 0) / 1048576).toFixed(2)} MB`,
            quota: `${((estimate.quota || 0) / 1048576).toFixed(2)} MB`,
            percentUsed: `${(((estimate.usage || 0) / (estimate.quota || 1)) * 100).toFixed(2)}%`
          });
        }
        
        return isPersisted;
      } catch (error) {
        console.error('[CACHE MANAGER] Failed to request persistent storage:', error);
        return false;
      }
    }
    
    console.warn('[CACHE MANAGER] Persistent storage API not available');
    return false;
  }
}

export const cacheManager = ModelCacheManager.getInstance();
