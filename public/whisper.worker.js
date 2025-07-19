// Import Transformers.js using importScripts for Web Workers
importScripts('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');

// Get pipeline and env from the global scope
console.log('[Worker] Checking for transformers global:', self.transformers);
const { pipeline, env } = self.transformers || {};

if (!pipeline || !env) {
    console.error('[Worker] Transformers.js not loaded properly');
    self.postMessage({ type: 'error', data: 'Failed to load Transformers.js from CDN' });
}

// Configure Transformers.js environment for maximum caching
env.allowLocalModels = true;
env.useBrowserCache = true;
// Add global error handler for debugging
self.addEventListener('error', (event) => {
    console.error('[Worker] Global error:', event.error);
    self.postMessage({ type: 'error', data: event.error?.message || 'Unknown worker error' });
});
self.addEventListener('unhandledrejection', (event) => {
    console.error('[Worker] Unhandled promise rejection:', event.reason);
    self.postMessage({ type: 'error', data: event.reason?.message || 'Unhandled promise rejection' });
});
class WhisperPipeline {
    static async getInstance(progressCallback) {
        if (this.instance === null) {
            // Configure cache settings before loading
            env.useBrowserCache = true;
            env.useCustomCache = true;
            // Request persistent storage for better cache persistence
            if ('storage' in self.navigator && 'persist' in self.navigator.storage) {
                try {
                    const persistent = await self.navigator.storage.persist();
                    console.log(`Persistent storage: ${persistent ? 'granted' : 'denied'}`);
                }
                catch (e) {
                    console.log('Could not request persistent storage');
                }
            }
            console.log('Assigning model:', this.model);
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
        return this.instance;
    }
    static async checkCacheStatus() {
        // Check if model files are in cache
        try {
            if ('caches' in self) {
                const cacheNames = await caches.keys();
                const transformersCaches = cacheNames.filter(name => name.includes('transformers') || name.includes('huggingface'));
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
        }
        catch (error) {
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
        // Clear browser caches
        if ('caches' in self) {
            const cacheNames = await caches.keys();
            const transformersCaches = cacheNames.filter(name => name.includes('transformers') || name.includes('huggingface'));
            for (const cacheName of transformersCaches) {
                await caches.delete(cacheName);
            }
        }
    }
}
WhisperPipeline.task = 'automatic-speech-recognition';
WhisperPipeline.model = 'Xenova/whisper-tiny';
WhisperPipeline.instance = null;
WhisperPipeline.modelId = 'whisper-tiny-v3';
// Send message back to main thread
const postResponse = (response) => {
    self.postMessage(response);
};
// Log worker initialization
console.log('[Worker] Whisper worker initialized');
// Handle incoming messages
self.addEventListener('message', async (event) => {
    console.log('[Worker] Received message:', event.data.type);
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
            }
            catch (error) {
                postResponse({
                    type: 'error',
                    data: error instanceof Error ? error.message : 'Failed to load model'
                });
            }
            break;
        case 'transcribe':
            try {
                const { audio: audioBase64, options = {} } = data;
                // Get the pipeline instance
                const transcriber = await WhisperPipeline.getInstance();
                // Transformers.js expects the full data URL for audio
                // Add the data URL prefix if it's not there
                const audioDataUrl = audioBase64.startsWith('data:')
                    ? audioBase64
                    : `data:audio/webm;base64,${audioBase64}`;
                // Perform transcription
                const output = await transcriber(audioDataUrl, {
                    // Transformers.js specific options
                    chunk_length_s: 30,
                    stride_length_s: 5,
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
            }
            catch (error) {
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
            }
            catch (error) {
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
            }
            catch (error) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2hpc3Blci53b3JrZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi93b3JrZXJzL3doaXNwZXIud29ya2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxRQUFRLEVBQUUsR0FBRyxFQUFFLE1BQU0sc0JBQXNCLENBQUE7QUFFcEQsNERBQTREO0FBQzVELEdBQUcsQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUE7QUFDM0IsR0FBRyxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUE7QUFFMUIseUNBQXlDO0FBQ3pDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRTtJQUN2QyxPQUFPLENBQUMsS0FBSyxDQUFDLHdCQUF3QixFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQTtJQUNwRCxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLEtBQUssRUFBRSxPQUFPLElBQUksc0JBQXNCLEVBQUUsQ0FBQyxDQUFBO0FBQzNGLENBQUMsQ0FBQyxDQUFBO0FBRUYsSUFBSSxDQUFDLGdCQUFnQixDQUFDLG9CQUFvQixFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUU7SUFDcEQsT0FBTyxDQUFDLEtBQUssQ0FBQyx1Q0FBdUMsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUE7SUFDcEUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxNQUFNLEVBQUUsT0FBTyxJQUFJLDZCQUE2QixFQUFFLENBQUMsQ0FBQTtBQUNuRyxDQUFDLENBQUMsQ0FBQTtBQWFGLE1BQU0sZUFBZTtJQU1uQixNQUFNLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxnQkFBMEM7UUFDakUsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLElBQUksRUFBRSxDQUFDO1lBQzNCLDBDQUEw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