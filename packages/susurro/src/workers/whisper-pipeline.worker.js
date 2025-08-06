import { pipeline, env } from '@xenova/transformers';

// Disable local models - always use Hugging Face CDN
env.allowLocalModels = false;
env.allowRemoteModels = true;

/**
 * Simplified Whisper Pipeline based on official Hugging Face examples
 * Manages multiple model instances dynamically
 */
class WhisperPipelineFactory {
  static task = 'automatic-speech-recognition';
  static models = {
    'tiny': 'Xenova/whisper-tiny',
    'base': 'Xenova/whisper-base', 
    'small': 'Xenova/whisper-small',
    'medium': 'Xenova/whisper-medium'
  };
  
  static instance = null;
  static currentModel = null;

  static async getInstance(modelId = 'tiny', progress_callback = null) {
    const modelName = this.models[modelId];
    
    if (!modelName) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    // Return existing instance if same model
    if (this.instance && this.currentModel === modelName) {
      return this.instance;
    }

    // Clear previous instance if switching models
    if (this.instance && this.currentModel !== modelName) {
      this.instance = null;
    }

    // Create new pipeline instance
    this.currentModel = modelName;
    this.instance = pipeline(this.task, modelName, {
      quantized: true,
      progress_callback,
      // Use CDN for model files
      revision: 'main',
    });

    return this.instance;
  }
}

// Handle messages from main thread
self.addEventListener('message', async (event) => {
  const { id, type, data } = event.data;

  try {
    switch (type) {
      case 'load': {
        const modelId = data?.model || 'tiny';
        
        // Send initial message
        self.postMessage({
          id,
          status: 'progress',
          file: 'Verificando caché del modelo',
          progress: 0,
          model: modelId
        });
        
        // Track if we get any download progress
        let hasDownloadProgress = false;
        let isFromCache = true;
        let lastProgressTime = Date.now();
        let filesDownloaded = 0;
        
        // Send periodic status updates
        let lastProgress = 0;
        const statusInterval = setInterval(() => {
          const elapsed = Math.round((Date.now() - lastProgressTime) / 1000);
          if (!hasDownloadProgress && elapsed > 10) {
            self.postMessage({
              id,
              status: 'progress',
              file: `Conectando con Hugging Face CDN... (${elapsed}s)`,
              progress: lastProgress,
              model: modelId
            });
          }
        }, 10000); // Every 10 seconds
        
        // Load the model with progress tracking
        console.log('[WORKER] Starting model load with progress callback');
        
        try {
          await WhisperPipelineFactory.getInstance(modelId, (progress) => {
            console.log('[WORKER] Progress event:', progress);
            lastProgressTime = Date.now();
            
            // If we get download progress, it's not from cache
            if (progress.status === 'progress' && progress.progress > 0) {
              hasDownloadProgress = true;
              isFromCache = false;
              lastProgress = progress.progress || 0;
            }
            
            if (progress.status === 'done') {
              filesDownloaded++;
            }
            
            // Send all progress events
            if (progress.status === 'initiate') {
            self.postMessage({
              id,
              status: 'progress',
              file: progress.file || 'Descargando archivo',
              progress: 0,
              loaded: 0,
              total: progress.total || 0,
              model: modelId
            });
          } else if (progress.status === 'progress') {
            self.postMessage({
              id,
              status: 'progress',
              file: progress.file || 'Descargando',
              progress: progress.progress || 0,
              loaded: progress.loaded || 0,
              total: progress.total || 0,
              model: modelId
            });
          } else if (progress.status === 'done') {
            self.postMessage({
              id,
              status: 'progress',
              file: progress.file || 'Completado',
              progress: 100,
              model: modelId
            });
          }
          });
          
          // Clear the status interval
          clearInterval(statusInterval);
          
          // Send completion message with cache info
          if (isFromCache) {
            self.postMessage({
              id,
              status: 'progress',
              file: `Modelo ${modelId} cargado desde caché (${filesDownloaded} archivos)`,
              progress: 100,
              model: modelId,
              fromCache: true
            });
          }

          self.postMessage({
            id,
            status: 'loaded',
            model: modelId,
            fromCache: isFromCache
          });
          
        } catch (error) {
          clearInterval(statusInterval);
          throw error;
        }
        
        break;
      }

      case 'transcribe': {
        const transcriber = await WhisperPipelineFactory.getInstance();
        
        if (!transcriber) {
          throw new Error('Model not loaded');
        }

        // Perform transcription
        const output = await transcriber(data.audio, {
          language: data.language || 'spanish',
          task: 'transcribe',
          chunk_length_s: 30,
          return_timestamps: true,
        });

        self.postMessage({
          id,
          status: 'complete',
          result: output
        });
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      id,
      status: 'error',
      error: error.message
    });
  }
});