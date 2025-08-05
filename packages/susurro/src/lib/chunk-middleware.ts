// Chunk Middleware Pipeline - Extensible processing for SusurroChunks
// Part of Murmuraba v3 Conversational Evolution

import type { SusurroChunk } from './types';

export interface ChunkMiddleware {
  name: string;
  process: (chunk: SusurroChunk) => Promise<SusurroChunk>;
  enabled: boolean;
  priority: number; // Lower number = higher priority
}

export interface MiddlewareContext {
  startTime: number;
  processingStage: 'pre-emit' | 'post-emit';
  metadata: Record<string, unknown>;
}

// Translation Middleware
export const translationMiddleware: ChunkMiddleware = {
  name: 'translation',
  enabled: false,
  priority: 1,
  async process(chunk: SusurroChunk): Promise<SusurroChunk> {
    // Future: Integrate with translation API
    const translatedText = chunk.transcript; // Placeholder

    return {
      ...chunk,
      metadata: {
        ...chunk.metadata,
        originalLanguage: 'en',
        translatedText,
        translationConfidence: 0.95,
      },
    };
  },
};

// Sentiment Analysis Middleware
export const sentimentMiddleware: ChunkMiddleware = {
  name: 'sentiment',
  enabled: false,
  priority: 2,
  async process(chunk: SusurroChunk): Promise<SusurroChunk> {
    // Future: Integrate with sentiment analysis
    const sentiment = analyzeSentiment(chunk.transcript);

    return {
      ...chunk,
      metadata: {
        ...chunk.metadata,
        sentiment: sentiment.label,
        sentimentScore: sentiment.score,
        emotion: sentiment.emotion,
      },
    };
  },
};

// Intent Detection Middleware
export const intentMiddleware: ChunkMiddleware = {
  name: 'intent',
  enabled: false,
  priority: 3,
  async process(chunk: SusurroChunk): Promise<SusurroChunk> {
    // Future: Integrate with intent detection
    const intent = detectIntent(chunk.transcript);

    return {
      ...chunk,
      metadata: {
        ...chunk.metadata,
        intent: intent.name,
        intentConfidence: intent.confidence,
        entities: intent.entities,
      },
    };
  },
};

// Quality Enhancement Middleware
export const qualityMiddleware: ChunkMiddleware = {
  name: 'quality',
  enabled: true,
  priority: 0, // Highest priority
  async process(chunk: SusurroChunk): Promise<SusurroChunk> {
    // Audio quality validation and enhancement
    const qualityMetrics = analyzeAudioQuality(chunk);

    return {
      ...chunk,
      metadata: {
        ...chunk.metadata,
        audioQuality: qualityMetrics.score,
        noiseLevel: qualityMetrics.noiseLevel,
        clarity: qualityMetrics.clarity,
        enhancement: qualityMetrics.applied,
      },
    };
  },
};

// Middleware Pipeline Manager
export class ChunkMiddlewarePipeline {
  private middlewares: ChunkMiddleware[] = [];
  private context: MiddlewareContext;

  constructor(_context: Partial<MiddlewareContext> = {}) {
    this.context = {
      startTime: Date.now(),
      processingStage: 'pre-emit',
      metadata: {},
      ..._context,
    };

    // Register default middlewares
    this.register(qualityMiddleware);
    this.register(translationMiddleware);
    this.register(sentimentMiddleware);
    this.register(intentMiddleware);
  }

  register(middleware: ChunkMiddleware): void {
    this.middlewares.push(middleware);
    this.middlewares.sort((a, b) => a.priority - b.priority);
  }

  unregister(name: string): void {
    this.middlewares = this.middlewares.filter((m) => m.name !== name);
  }

  enable(name: string): void {
    const middleware = this.middlewares.find((m) => m.name === name);
    if (middleware) {
      middleware.enabled = true;
    }
  }

  disable(name: string): void {
    const middleware = this.middlewares.find((m) => m.name === name);
    if (middleware) {
      middleware.enabled = false;
    }
  }

  async process(chunk: SusurroChunk): Promise<SusurroChunk> {
    let processedChunk = { ...chunk };
    const processingLatencies: Record<string, number> = {};

    for (const middleware of this.middlewares) {
      if (!middleware.enabled) continue;

      const startTime = performance.now();

      try {
        processedChunk = await middleware.process(processedChunk);

        const latency = performance.now() - startTime;
        processingLatencies[middleware.name] = latency;

        // Latency warning for debugging
        if (latency > 50) {
          console.warn(`Middleware "${middleware.name}" took ${latency.toFixed(2)}ms`);
        }
      } catch (error) {
        console.error(`Middleware "${middleware.name}" failed:`, error);
        // Continue processing with other middlewares
      }
    }

    // Add processing metadata
    return {
      ...processedChunk,
      metadata: {
        ...processedChunk.metadata,
        middlewareLatencies: processingLatencies,
        totalMiddlewareTime: Object.values(processingLatencies).reduce((a, b) => a + b, 0),
      },
    };
  }

  getStatus(): { name: string; enabled: boolean; priority: number }[] {
    return this.middlewares.map((m) => ({
      name: m.name,
      enabled: m.enabled,
      priority: m.priority,
    }));
  }
}

// Helper functions for middleware implementations
function analyzeSentiment(text: string): { label: string; score: number; emotion: string } {
  // Placeholder implementation - Future: integrate with sentiment API
  const positiveWords = ['good', 'great', 'awesome', 'excellent', 'amazing'];
  const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'worst'];

  const words = text.toLowerCase().split(' ');
  const positiveCount = words.filter((w) => positiveWords.includes(w)).length;
  const negativeCount = words.filter((w) => negativeWords.includes(w)).length;

  if (positiveCount > negativeCount) {
    return { label: 'positive', score: 0.7, emotion: 'happy' };
  } else if (negativeCount > positiveCount) {
    return { label: 'negative', score: 0.7, emotion: 'sad' };
  }

  return { label: 'neutral', score: 0.5, emotion: 'neutral' };
}

function detectIntent(text: string): { name: string; confidence: number; entities: string[] } {
  // Placeholder implementation - Future: integrate with NLU API
  const questionWords = ['what', 'how', 'when', 'where', 'why', 'who'];
  const commandWords = ['play', 'stop', 'start', 'open', 'close', 'send'];

  const words = text.toLowerCase().split(' ');

  if (words.some((w) => questionWords.includes(w))) {
    return { name: 'question', confidence: 0.8, entities: [] };
  } else if (words.some((w) => commandWords.includes(w))) {
    return { name: 'command', confidence: 0.8, entities: [] };
  }

  return { name: 'statement', confidence: 0.6, entities: [] };
}

function analyzeAudioQuality(chunk: SusurroChunk): {
  score: number;
  noiseLevel: number;
  clarity: number;
  applied: string[];
} {
  // Placeholder implementation - Future: integrate with audio analysis
  return {
    score: chunk.vadScore || 0.8,
    noiseLevel: 0.1, // Low noise thanks to neural processing
    clarity: 0.9,
    applied: ['neural_denoising', 'voice_enhancement'],
  };
}

export default ChunkMiddlewarePipeline;
