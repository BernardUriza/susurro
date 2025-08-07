import { pipeline, env } from '@xenova/transformers';

// Configure environment for local models ONLY - no network requests
env.allowLocalModels = true;
env.allowRemoteModels = false; // Disable remote models to prevent CDN requests
env.localModelPath = '/models/'; // Point to our local models directory
env.useBrowserCache = false; // Disable browser cache to force local loading

// Singleton pattern for Whisper pipeline - using local models
class WhisperPipeline {
  static task = 'automatic-speech-recognition';
  static model = 'whisper-tiny'; // Model name - will be resolved with localModelPath
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
  const { type, audio, model } = event.data;

  if (type === 'load') {
    // Load a specific model if requested
    if (model) {
      WhisperPipeline.model = model;
    }

    try {
      // Load the pipeline and send progress updates
      await WhisperPipeline.getInstance(x => {
        self.postMessage({
          status: x.status,
          progress: x.progress || 0,
          file: x.file,
          loaded: x.loaded,
          total: x.total,
        });
      });

      // Model is ready
      self.postMessage({ status: 'ready' });
    } catch (error) {
      self.postMessage({ 
        status: 'error', 
        error: error.message 
      });
    }
  }

  if (type === 'transcribe') {
    try {
      // Get the pipeline
      const transcriber = await WhisperPipeline.getInstance();

      // Perform transcription
      const output = await transcriber(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: 'spanish',
        task: 'transcribe',
        return_timestamps: true,
      });

      // Send the transcription result
      self.postMessage({
        status: 'complete',
        text: output.text,
        chunks: output.chunks,
      });
    } catch (error) {
      self.postMessage({
        status: 'error',
        error: error.message,
      });
    }
  }
});