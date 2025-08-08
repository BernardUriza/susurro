import { useState, useCallback, useEffect } from 'react';

interface CacheStatus {
  hasCache: boolean;
  cacheSize?: number;
  lastUpdated?: Date;
}

interface UseModelCacheReturn {
  cacheStatus: CacheStatus;
  storeModel: (modelId: string, data: ArrayBuffer) => Promise<void>;
  getModel: (modelId: string) => Promise<ArrayBuffer | null>;
  hasModel: (modelId: string) => Promise<boolean>;
  clearCache: () => Promise<void>;
  getStorageInfo: () => Promise<{ usage: number; quota: number } | null>;
  requestPersistentStorage: () => Promise<boolean>;
  refreshCacheStatus: () => Promise<void>;
}

/**
 * Hook-based model cache manager
 * Replaces the singleton ModelCacheManager with modern React patterns
 */
export function useModelCache(): UseModelCacheReturn {
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({ hasCache: false });

  const dbName = 'whisper-models-cache';
  const storeName = 'models';
  const cacheVersion = 1;

  // Initialize IndexedDB for model storage
  const initDB = useCallback(async (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, cacheVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      };
    });
  }, [dbName, storeName, cacheVersion]);

  // Store model data in IndexedDB
  const storeModel = useCallback(
    async (modelId: string, data: ArrayBuffer): Promise<void> => {
      const db = await initDB();
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.put({
          id: modelId,
          data: data,
          timestamp: Date.now(),
          size: data.byteLength,
        });

        request.onsuccess = () => {
          resolve();
          // Refresh cache status after storing
          refreshCacheStatus();
        };
        request.onerror = () => reject(request.error);
      });
    },
    [initDB, storeName]
  );

  // Retrieve model from IndexedDB
  const getModel = useCallback(
    async (modelId: string): Promise<ArrayBuffer | null> => {
      try {
        const db = await initDB();
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);

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
    },
    [initDB, storeName]
  );

  // Check if model exists in cache
  const hasModel = useCallback(
    async (modelId: string): Promise<boolean> => {
      const model = await getModel(modelId);
      return model !== null;
    },
    [getModel]
  );

  // Get cache status
  const refreshCacheStatus = useCallback(async (): Promise<void> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);

      return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const models = request.result;

          if (models.length > 0) {
            const totalSize = models.reduce((sum, model) => sum + (model.size || 0), 0);
            const lastUpdated = new Date(Math.max(...models.map((m) => m.timestamp || 0)));

            setCacheStatus({
              hasCache: true,
              cacheSize: totalSize,
              lastUpdated: lastUpdated,
            });
          } else {
            setCacheStatus({ hasCache: false });
          }
          resolve();
        };
        request.onerror = () => {
          setCacheStatus({ hasCache: false });
          resolve();
        };
      });
    } catch (error) {
      setCacheStatus({ hasCache: false });
    }
  }, [initDB, storeName]);

  // Clear all cached models
  const clearCache = useCallback(async (): Promise<void> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => {
          setCacheStatus({ hasCache: false });
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      // Silently fail but update cache status
      setCacheStatus({ hasCache: false });
    }
  }, [initDB, storeName]);

  // Get storage estimate
  const getStorageInfo = useCallback(async (): Promise<{ usage: number; quota: number } | null> => {
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
  }, []);

  // Request persistent storage
  const requestPersistentStorage = useCallback(async (): Promise<boolean> => {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        // Check current persistence status
        const currentlyPersisted = await navigator.storage.persisted();

        if (currentlyPersisted) {
          return true;
        }

        // Request persistence
        const isPersisted = await navigator.storage.persist();

        // Get storage estimate after persistence request
        if ('estimate' in navigator.storage) {
          await navigator.storage.estimate();
        }

        return isPersisted;
      } catch (error) {
        return false;
      }
    }

    return false;
  }, []);

  // Initialize cache status on mount
  useEffect(() => {
    refreshCacheStatus();
  }, [refreshCacheStatus]);

  return {
    cacheStatus,
    storeModel,
    getModel,
    hasModel,
    clearCache,
    getStorageInfo,
    requestPersistentStorage,
    refreshCacheStatus,
  };
}
