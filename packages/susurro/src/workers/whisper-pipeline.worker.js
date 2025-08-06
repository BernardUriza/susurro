import { pipeline, env } from '@xenova/transformers';

/**
 * Singleton Whisper Pipeline
 * Based on Hugging Face's react-translator example
 * Ensures only one instance of the pipeline is loaded
 */
class WhisperPipeline {
  static task = 'automatic-speech-recognition';
  static model = 'Xenova/whisper-tiny';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      // Configure environment for local models
      env.allowLocalModels = true;
      env.allowRemoteModels = false;
      env.localURL = '/models/';
      env.remoteURL = '/models/';
      
      // Configure backends
      env.backends.onnx = {
        wasm: {
          wasmPaths: 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/',
          numThreads: 2,
        }
      };

      // Create pipeline with progress callback
      this.instance = await pipeline(this.task, this.model, {
        quantized: false,
        device: 'wasm',
        local_files_only: true,
        progress_callback,
      });
    }
    return this.instance;
  }
}

// Track if model is being loaded
let isLoading = false;

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
  const { id, type, data } = event.data;

  // Helper to send messages back
  const reply = (status, payload = {}) => {
    self.postMessage({ id, status, ...payload });
  };

  try {
    switch (type) {
      case 'load':
        if (isLoading) {
          reply('error', { error: 'Model is already loading' });
          return;
        }

        isLoading = true;
        
        // Get the pipeline instance with progress tracking
        await WhisperPipeline.getInstance((progress) => {
          // Send progress updates to main thread
          if (progress.status === 'progress') {
            reply('progress', {
              file: progress.file,
              progress: progress.progress || 0,
              loaded: progress.loaded,
              total: progress.total,
            });
          } else if (progress.status === 'ready') {
            reply('ready');
          } else if (progress.status === 'initiate') {
            reply('initiate', {
              file: progress.file,
              loaded: 0,
              total: progress.total || 0,
            });
          } else if (progress.status === 'done') {
            reply('done', { file: progress.file });
          }
        });

        isLoading = false;
        reply('loaded');
        break;

      case 'transcribe':
        const transcriber = await WhisperPipeline.getInstance();
        
        if (!transcriber) {
          reply('error', { error: 'Model not loaded' });
          return;
        }

        // Send start signal
        reply('transcribe_start');

        // Perform transcription
        const result = await transcriber(data.audio, {
          language: data.language || 'spanish',
          task: 'transcribe',
          chunk_length_s: 30,
          return_timestamps: true,
        });

        // Send result
        reply('transcribe_complete', { result });
        break;

      case 'status':
        reply('status', {
          loaded: WhisperPipeline.instance !== null,
          loading: isLoading,
        });
        break;

      default:
        reply('error', { error: `Unknown message type: ${type}` });
    }
  } catch (error) {
    console.error('Worker error:', error);
    reply('error', { 
      error: error.message || 'Unknown error occurred',
      stack: error.stack 
    });
  }
});

// Send ready signal
self.postMessage({ status: 'worker_ready' });