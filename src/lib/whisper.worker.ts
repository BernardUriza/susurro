import { pipeline, env } from '@xenova/transformers'

// Configure Transformers.js environment for maximum caching
env.allowLocalModels = true
env.useBrowserCache = true

// Message types for communication
interface WorkerMessage {
  type: 'load' | 'transcribe' | 'check-cache' | 'clear-cache'
  data?: any
}

interface WorkerResponse {
  type: 'initiate' | 'ready' | 'progress' | 'complete' | 'error' | 'cache-status'
  data?: any
}

class WhisperPipeline {
  static task = 'automatic-speech-recognition'
  static model = 'Xenova/whisper-tiny'
  static instance: any = null
  static modelId = 'whisper-tiny-v3'

  static async getInstance(progressCallback?: (progress: any) => void) {
    if (this.instance === null) {
      // Configure cache settings before loading
      env.useBrowserCache = true
      env.useCustomCache = true
      
      // Request persistent storage for better cache persistence
      if ('storage' in navigator && 'persist' in navigator.storage) {
        try {
          const persistent = await navigator.storage.persist()
          console.log(`Persistent storage: ${persistent ? 'granted' : 'denied'}`)
        } catch (e) {
          console.log('Could not request persistent storage')
        }
      }

      this.instance = await pipeline(this.task as any, this.model, {
        progress_callback: (progress: any) => {
          // Enhanced progress tracking
          if (progressCallback) {
            progressCallback({
              ...progress,
              status: progress.status || 'downloading',
              file: progress.file || 'model',
              progress: progress.progress || 0,
              loaded: progress.loaded || 0,
              total: progress.total || 1
            })
          }
        },
        // Cache configuration
        cache_dir: 'transformers-cache',
        revision: 'main',
        // Use quantized model for smaller size and faster loading
        quantized: true,
      })
    }
    return this.instance
  }

  static async checkCacheStatus() {
    // Check if model files are in cache
    try {
      if ('caches' in self) {
        const cacheNames = await caches.keys()
        const transformersCaches = cacheNames.filter(name => 
          name.includes('transformers') || name.includes('huggingface')
        )
        
        let totalSize = 0
        for (const cacheName of transformersCaches) {
          const cache = await caches.open(cacheName)
          const requests = await cache.keys()
          
          // Estimate size (this is approximate)
          for (const request of requests) {
            const response = await cache.match(request)
            if (response && response.headers.get('content-length')) {
              totalSize += parseInt(response.headers.get('content-length') || '0')
            }
          }
        }

        return {
          hasCachedModel: transformersCaches.length > 0,
          cacheSize: totalSize,
          cacheNames: transformersCaches
        }
      }
    } catch (error) {
      console.error('Error checking cache status:', error)
    }
    
    return {
      hasCachedModel: false,
      cacheSize: 0,
      cacheNames: []
    }
  }

  static async clearCache() {
    this.instance = null
    
    // Clear browser caches
    if ('caches' in self) {
      const cacheNames = await caches.keys()
      const transformersCaches = cacheNames.filter(name => 
        name.includes('transformers') || name.includes('huggingface')
      )
      
      for (const cacheName of transformersCaches) {
        await caches.delete(cacheName)
      }
    }
  }
}

// Send message back to main thread
const postResponse = (response: WorkerResponse) => {
  self.postMessage(response)
}

// Handle incoming messages
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { type, data } = event.data

  switch (type) {
    case 'load':
      try {
        postResponse({ type: 'initiate' })
        
        // Check cache status first
        const cacheStatus = await WhisperPipeline.checkCacheStatus()
        console.log('Cache status:', cacheStatus)
        
        await WhisperPipeline.getInstance((progress) => {
          postResponse({ 
            type: 'progress', 
            data: {
              ...progress,
              cachedModel: cacheStatus.hasCachedModel
            }
          })
        })
        
        postResponse({ type: 'ready' })
      } catch (error) {
        postResponse({ 
          type: 'error', 
          data: error instanceof Error ? error.message : 'Failed to load model' 
        })
      }
      break

    case 'transcribe':
      try {
        const { audio, options = {} } = data
        
        // Get the pipeline instance
        const transcriber = await WhisperPipeline.getInstance()
        
        // Perform transcription
        const output = await transcriber(audio, {
          // Transformers.js specific options
          chunk_length_s: 30,
          stride_length_s: 5,
          language: options.language || 'spanish',
          task: 'transcribe',
          return_timestamps: options.timestamps || false,
        })
        
        postResponse({ 
          type: 'complete', 
          data: {
            text: output.text,
            chunks: output.chunks
          }
        })
      } catch (error) {
        postResponse({ 
          type: 'error', 
          data: error instanceof Error ? error.message : 'Transcription failed' 
        })
      }
      break

    case 'check-cache':
      try {
        const status = await WhisperPipeline.checkCacheStatus()
        postResponse({ 
          type: 'cache-status', 
          data: status
        })
      } catch (error) {
        postResponse({ 
          type: 'error', 
          data: 'Failed to check cache status' 
        })
      }
      break

    case 'clear-cache':
      try {
        await WhisperPipeline.clearCache()
        postResponse({ 
          type: 'cache-status', 
          data: { hasCachedModel: false, cacheSize: 0 }
        })
      } catch (error) {
        postResponse({ 
          type: 'error', 
          data: 'Failed to clear cache' 
        })
      }
      break

    default:
      postResponse({ 
        type: 'error', 
        data: 'Unknown message type' 
      })
  }
})