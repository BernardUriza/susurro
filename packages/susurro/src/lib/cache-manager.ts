// Cache Manager for Transformers.js models
// Uses multiple storage strategies for maximum persistence

interface CacheStatus {
  hasCache: boolean
  cacheSize?: number
  lastUpdated?: Date
}

class ModelCacheManager {
  private static instance: ModelCacheManager
  private dbName = 'whisper-models-cache'
  private storeName = 'models'
  private cacheVersion = 1

  private constructor() {}

  static getInstance(): ModelCacheManager {
    if (!ModelCacheManager.instance) {
      ModelCacheManager.instance = new ModelCacheManager()
    }
    return ModelCacheManager.instance
  }

  // Initialize IndexedDB for model storage
  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.cacheVersion)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' })
        }
      }
    })
  }

  // Store model data in IndexedDB
  async storeModel(modelId: string, data: ArrayBuffer): Promise<void> {
    const db = await this.initDB()
    const transaction = db.transaction([this.storeName], 'readwrite')
    const store = transaction.objectStore(this.storeName)

    return new Promise((resolve, reject) => {
      const request = store.put({
        id: modelId,
        data: data,
        timestamp: Date.now(),
        size: data.byteLength
      })

      request.onsuccess = () => {
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Retrieve model from IndexedDB
  async getModel(modelId: string): Promise<ArrayBuffer | null> {
    try {
      const db = await this.initDB()
      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)

      return new Promise((resolve) => {
        const request = store.get(modelId)
        request.onsuccess = () => {
          const result = request.result
          if (result && result.data) {
            resolve(result.data)
          } else {
            resolve(null)
          }
        }
        request.onerror = () => resolve(null)
      })
    } catch (error) {
      return null
    }
  }

  // Check if model exists in cache
  async hasModel(modelId: string): Promise<boolean> {
    const model = await this.getModel(modelId)
    return model !== null
  }

  // Get cache status
  async getCacheStatus(): Promise<CacheStatus> {
    try {
      const db = await this.initDB()
      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)

      return new Promise((resolve) => {
        const request = store.getAll()
        request.onsuccess = () => {
          const models = request.result
          if (models.length > 0) {
            const totalSize = models.reduce((sum, model) => sum + (model.size || 0), 0)
            const lastUpdated = new Date(Math.max(...models.map(m => m.timestamp || 0)))
            
            resolve({
              hasCache: true,
              cacheSize: totalSize,
              lastUpdated: lastUpdated
            })
          } else {
            resolve({ hasCache: false })
          }
        }
        request.onerror = () => resolve({ hasCache: false })
      })
    } catch (error) {
      return { hasCache: false }
    }
  }

  // Clear all cached models
  async clearCache(): Promise<void> {
    try {
      const db = await this.initDB()
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      
      return new Promise((resolve, reject) => {
        const request = store.clear()
        request.onsuccess = () => {
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
    }
  }

  // Get storage estimate
  async getStorageInfo(): Promise<{ usage: number; quota: number } | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate()
        return {
          usage: estimate.usage || 0,
          quota: estimate.quota || 0
        }
      } catch (error) {
        return null
      }
    }
    return null
  }

  // Request persistent storage
  async requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        const isPersisted = await navigator.storage.persist()
        return isPersisted
      } catch (error) {
        return false
      }
    }
    return false
  }
}

export const cacheManager = ModelCacheManager.getInstance()