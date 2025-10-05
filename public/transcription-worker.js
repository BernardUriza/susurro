/**
 * Transcription Web Worker
 * Handles heavy transcription processing off the main thread
 * to prevent UI blocking during chunk processing
 */

// Worker state
let transcriptionQueue = [];
let isProcessing = false;
let claudeConfig = null;

// Message types
const MessageTypes = {
  INIT: 'init',
  PROCESS_CHUNK: 'process_chunk',
  REFINE_TEXT: 'refine_text',
  RESET: 'reset',
  GET_STATE: 'get_state',
};

// Response types
const ResponseTypes = {
  READY: 'ready',
  CHUNK_PROCESSED: 'chunk_processed',
  TEXT_REFINED: 'text_refined',
  ERROR: 'error',
  STATE: 'state',
};

/**
 * Initialize worker with configuration
 */
function initialize(config) {
  claudeConfig = config.claudeConfig || null;

  postMessage({
    type: ResponseTypes.READY,
    data: { initialized: true },
  });
}

/**
 * Process transcription chunk
 * This is lightweight - just accumulate and notify
 */
function processChunk(chunk) {
  try {
    // Add chunk to queue
    transcriptionQueue.push({
      text: chunk.text,
      timestamp: Date.now(),
      source: chunk.source || 'unknown',
    });

    // Notify main thread immediately (non-blocking)
    postMessage({
      type: ResponseTypes.CHUNK_PROCESSED,
      data: {
        chunk,
        queueLength: transcriptionQueue.length,
      },
    });
  } catch (error) {
    postMessage({
      type: ResponseTypes.ERROR,
      data: { error: error.message, context: 'processChunk' },
    });
  }
}

/**
 * Refine text with Claude (heavy operation)
 * This runs in the background without blocking UI
 */
async function refineText(webSpeechText, deepgramText) {
  if (!claudeConfig || !claudeConfig.enabled) {
    // No Claude - return immediately
    postMessage({
      type: ResponseTypes.TEXT_REFINED,
      data: {
        refinedText: deepgramText || webSpeechText || '',
        skipped: true,
      },
    });
    return;
  }

  try {
    isProcessing = true;

    // Call Claude API (use snake_case for Python backend)
    const response = await fetch(claudeConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        web_speech_text: webSpeechText || '',
        deepgram_text: deepgramText || '',
        language: 'es',  // Default to Spanish
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const result = await response.json();

    postMessage({
      type: ResponseTypes.TEXT_REFINED,
      data: {
        refinedText: result.refined_text || result.refinedText || result.text || deepgramText || webSpeechText,
        webSpeechText,
        deepgramText,
      },
    });
  } catch (error) {
    // On error, return best available text
    postMessage({
      type: ResponseTypes.TEXT_REFINED,
      data: {
        refinedText: deepgramText || webSpeechText || '',
        error: error.message,
      },
    });
  } finally {
    isProcessing = false;
  }
}

/**
 * Reset worker state
 */
function reset() {
  transcriptionQueue = [];
  isProcessing = false;

  postMessage({
    type: ResponseTypes.STATE,
    data: {
      reset: true,
      queueLength: 0,
      isProcessing: false,
    },
  });
}

/**
 * Get current state
 */
function getState() {
  postMessage({
    type: ResponseTypes.STATE,
    data: {
      queueLength: transcriptionQueue.length,
      isProcessing,
      hasClaudeConfig: !!claudeConfig,
    },
  });
}

/**
 * Message handler
 */
self.onmessage = function (e) {
  const { type, data } = e.data;

  switch (type) {
    case MessageTypes.INIT:
      initialize(data);
      break;

    case MessageTypes.PROCESS_CHUNK:
      processChunk(data);
      break;

    case MessageTypes.REFINE_TEXT:
      refineText(data.webSpeechText, data.deepgramText);
      break;

    case MessageTypes.RESET:
      reset();
      break;

    case MessageTypes.GET_STATE:
      getState();
      break;

    default:
      postMessage({
        type: ResponseTypes.ERROR,
        data: { error: `Unknown message type: ${type}` },
      });
  }
};

// Log worker ready
console.log('[TranscriptionWorker] Ready and waiting for messages');
