// Import Transformers.js
import { pipeline, env, AutoProcessor, read_audio } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';

// Configure Transformers.js environment for maximum caching
env.allowLocalModels = true;
env.useBrowserCache = true;

// Message types for communication
class WhisperPipeline {
  static task = 'automatic-speech-recognition';
  static model = 'Xenova/whisper-tiny';
  static instance = null;
  static processor = null;

  static async getInstance(progressCallback) {
    if (this.instance === null) {
      // Configure cache settings before loading
      env.useBrowserCache = true;
      
      // Request persistent storage for better cache persistence
      if ('storage' in navigator && 'persist' in navigator.storage) {
        try {
          const persistent = await navigator.storage.persist();
          console.log(`Persistent storage: ${persistent ? 'granted' : 'denied'}`);
        } catch (e) {
          console.log('Could not request persistent storage');
        }
      }

      // Load the processor
      this.processor = await AutoProcessor.from_pretrained(this.model);

      this.instance = await pipeline(this.task, this.model, {
        progress_callback: (progress) => {
          // Enhanced progress tracking
          if (progressCallback) {
            progressCallback({
              ...progress,
              status: progress.status || 'downloading',
              file: progress.file || 'model',
              progress: progress.progress || 0,
              loaded: progress.loaded || 0,
              total: progress.total || 1
            });
          }
        },
        // Cache configuration
        cache_dir: 'transformers-cache',
        revision: 'main',
        // Use quantized model for smaller size and faster loading
        quantized: true,
      });
    }
    return { pipeline: this.instance, processor: this.processor };
  }

  static async checkCacheStatus() {
    // Check if model files are in cache
    try {
      if ('caches' in self) {
        const cacheNames = await caches.keys();
        const transformersCaches = cacheNames.filter(name => 
          name.includes('transformers') || name.includes('huggingface')
        );
        
        let totalSize = 0;
        for (const cacheName of transformersCaches) {
          const cache = await caches.open(cacheName);
          const requests = await cache.keys();
          
          // Estimate size (this is approximate)
          for (const request of requests) {
            const response = await cache.match(request);
            if (response && response.headers.get('content-length')) {
              totalSize += parseInt(response.headers.get('content-length') || '0');
            }
          }
        }

        return {
          hasCachedModel: transformersCaches.length > 0,
          cacheSize: totalSize,
          cacheNames: transformersCaches
        };
      }
    } catch (error) {
      console.error('Error checking cache status:', error);
    }
    
    return {
      hasCachedModel: false,
      cacheSize: 0,
      cacheNames: []
    };
  }

  static async clearCache() {
    this.instance = null;
    this.processor = null;
    
    // Clear browser caches
    if ('caches' in self) {
      const cacheNames = await caches.keys();
      const transformersCaches = cacheNames.filter(name => 
        name.includes('transformers') || name.includes('huggingface')
      );
      
      for (const cacheName of transformersCaches) {
        await caches.delete(cacheName);
      }
    }
  }
}

// Convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Decode audio data to get raw audio samples
async function decodeAudioData(arrayBuffer) {
  // Create an OfflineAudioContext for decoding
  const audioContext = new OfflineAudioContext(1, 1, 16000);
  
  // Decode the audio data
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Get the audio data as Float32Array
  const audioData = audioBuffer.getChannelData(0);
  
  return {
    audio: audioData,
    sampling_rate: audioBuffer.sampleRate
  };
}

// Send message back to main thread
const postResponse = (response) => {
  self.postMessage(response);
};

// Handle incoming messages
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'load':
      try {
        postResponse({ type: 'initiate' });
        
        // Check cache status first
        const cacheStatus = await WhisperPipeline.checkCacheStatus();
        console.log('Cache status:', cacheStatus);
        
        await WhisperPipeline.getInstance((progress) => {
          postResponse({ 
            type: 'progress', 
            data: {
              ...progress,
              cachedModel: cacheStatus.hasCachedModel
            }
          });
        });
        
        postResponse({ type: 'ready' });
      } catch (error) {
        postResponse({ 
          type: 'error', 
          data: error instanceof Error ? error.message : 'Failed to load model' 
        });
      }
      break;

    case 'transcribe':
      try {
        const { audio: audioBase64, options = {} } = data;
        
        // Convert base64 to ArrayBuffer
        const arrayBuffer = base64ToArrayBuffer(audioBase64);
        
        // Decode audio to get raw samples
        const { audio, sampling_rate } = await decodeAudioData(arrayBuffer);
        
        // Get the pipeline and processor
        const { pipeline: transcriber, processor } = await WhisperPipeline.getInstance();
        
        // Process the audio for the model
        const inputs = await processor(audio, {
          sampling_rate: sampling_rate
        });
        
        // Perform transcription
        const output = await transcriber(inputs, {
          // Transformers.js specific options
          language: options.language || 'spanish',
          task: 'transcribe',
          return_timestamps: options.timestamps || false,
        });
        
        postResponse({ 
          type: 'complete', 
          data: {
            text: output.text,
            chunks: output.chunks
          }
        });
      } catch (error) {
        console.error('Transcription error:', error);
        postResponse({ 
          type: 'error', 
          data: error instanceof Error ? error.message : 'Transcription failed' 
        });
      }
      break;

    case 'check-cache':
      try {
        const status = await WhisperPipeline.checkCacheStatus();
        postResponse({ 
          type: 'cache-status', 
          data: status
        });
      } catch (error) {
        postResponse({ 
          type: 'error', 
          data: 'Failed to check cache status' 
        });
      }
      break;

    case 'clear-cache':
      try {
        await WhisperPipeline.clearCache();
        postResponse({ 
          type: 'cache-status', 
          data: { hasCachedModel: false, cacheSize: 0 }
        });
      } catch (error) {
        postResponse({ 
          type: 'error', 
          data: 'Failed to clear cache' 
        });
      }
      break;

    default:
      postResponse({ 
        type: 'error', 
        data: 'Unknown message type' 
      });
  }
});