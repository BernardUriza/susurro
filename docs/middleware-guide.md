# Susurro Middleware Guide - Phase 3 Conversational Evolution

The Susurro middleware system allows you to enhance and process audio chunks in real-time as they're emitted from the conversational system.

## Overview

Middleware operates on `SusurroChunk` objects before they're emitted to your application, allowing you to:
- Analyze audio quality and apply enhancements
- Perform sentiment analysis on transcripts  
- Detect user intent from speech
- Translate speech to different languages
- Add custom metadata to chunks

## Built-in Middleware

### Quality Enhancement Middleware

**Purpose**: Analyzes and enhances audio quality with neural processing metrics.

```typescript
import { useSusurro } from '@susurro/core';

const { middlewarePipeline } = useSusurro({
  conversational: {
    onChunk: (chunk) => {
      // Quality middleware adds metadata:
      console.log('Audio Quality:', chunk.metadata?.audioQuality);
      console.log('Noise Level:', chunk.metadata?.noiseLevel);
      console.log('Clarity Score:', chunk.metadata?.clarity);
      console.log('Applied Enhancements:', chunk.metadata?.enhancement);
    }
  }
});

// Quality middleware is enabled by default
middlewarePipeline.enable('quality');
```

### Sentiment Analysis Middleware

**Purpose**: Analyzes emotional tone of transcribed speech.

```typescript
// Enable sentiment analysis
middlewarePipeline.enable('sentiment');

// Access sentiment data in chunks
const { conversationalChunks } = useSusurro({
  conversational: {
    onChunk: (chunk) => {
      if (chunk.metadata?.sentiment) {
        console.log('Sentiment:', chunk.metadata.sentiment); // 'positive', 'negative', 'neutral'
        console.log('Score:', chunk.metadata.sentimentScore);
        console.log('Emotion:', chunk.metadata.emotion);
      }
    }
  }
});
```

### Intent Detection Middleware

**Purpose**: Detects user intent from speech patterns.

```typescript
middlewarePipeline.enable('intent');

// Handle detected intents
const handleChunk = (chunk) => {
  if (chunk.metadata?.intent) {
    switch(chunk.metadata.intent) {
      case 'question':
        console.log('User asked a question:', chunk.transcript);
        break;
      case 'command':
        console.log('User gave a command:', chunk.transcript);
        break;
      case 'statement':
        console.log('User made a statement:', chunk.transcript);
        break;
    }
  }
};
```

### Translation Middleware

**Purpose**: Translates speech to different languages (future implementation).

```typescript
middlewarePipeline.enable('translation');

const handleTranslation = (chunk) => {
  if (chunk.metadata?.translatedText) {
    console.log('Original:', chunk.transcript);
    console.log('Translated:', chunk.metadata.translatedText);
    console.log('Confidence:', chunk.metadata.translationConfidence);
  }
};
```

## Custom Middleware

Create your own middleware to process chunks with custom logic:

```typescript
import { ChunkMiddleware, SusurroChunk } from '@susurro/core';

const customMiddleware: ChunkMiddleware = {
  name: 'keyword-detector',
  enabled: true,
  priority: 5, // Higher numbers run later
  
  async process(chunk: SusurroChunk): Promise<SusurroChunk> {
    const keywords = ['hello', 'help', 'stop', 'continue'];
    const detectedKeywords = keywords.filter(keyword => 
      chunk.transcript.toLowerCase().includes(keyword)
    );
    
    return {
      ...chunk,
      metadata: {
        ...chunk.metadata,
        detectedKeywords,
        hasKeywords: detectedKeywords.length > 0,
        keywordCount: detectedKeywords.length
      }
    };
  }
};

// Register and enable custom middleware
const { middlewarePipeline } = useSusurro();
middlewarePipeline.register(customMiddleware);
middlewarePipeline.enable('keyword-detector');
```

## Performance Considerations

Middleware processing adds latency to chunk emission. Monitor performance:

```typescript
const { latencyReport, latencyStatus } = useSusurro({
  conversational: {
    onChunk: (chunk) => {
      // Check middleware timing
      if (chunk.metadata?.middlewareLatencies) {
        Object.entries(chunk.metadata.middlewareLatencies).forEach(([name, latency]) => {
          if (latency > 50) {
            console.warn(`Middleware ${name} took ${latency}ms`);
          }
        });
      }
    }
  }
});

// Disable expensive middleware if latency is too high
if (!latencyStatus.isHealthy) {
  middlewarePipeline.disable('sentiment');
  middlewarePipeline.disable('intent');
}
```

## Middleware Controls in Demo Interface

The conversational demo includes real-time middleware controls:

```typescript
const [middlewareSettings, setMiddlewareSettings] = useState({
  quality: true,      // Always recommended for audio enhancement
  sentiment: false,   // Enable for emotion detection
  intent: false,      // Enable for command detection  
  translation: false  // Enable for multi-language support
});

// Middleware state is automatically synchronized with the pipeline
useEffect(() => {
  Object.entries(middlewareSettings).forEach(([name, enabled]) => {
    if (enabled) {
      middlewarePipeline.enable(name);
    } else {
      middlewarePipeline.disable(name);
    }
  });
}, [middlewareSettings, middlewarePipeline]);
```

## Advanced Middleware Pipeline

For complex scenarios, manage the entire pipeline:

```typescript
import { ChunkMiddlewarePipeline } from '@susurro/core';

// Create custom pipeline with specific configuration
const customPipeline = new ChunkMiddlewarePipeline({
  processingStage: 'pre-emit',
  metadata: { 
    sessionId: 'user-123',
    environment: 'production' 
  }
});

// Add multiple custom middleware
customPipeline.register(keywordMiddleware);
customPipeline.register(profanityFilterMiddleware);
customPipeline.register(dataEnrichmentMiddleware);

// Use in Susurro hook
const { conversationalChunks } = useSusurro({
  conversational: {
    onChunk: async (chunk) => {
      // Process through custom pipeline
      const enhancedChunk = await customPipeline.process(chunk);
      
      // Handle enhanced chunk
      console.log('Enhanced chunk:', enhancedChunk);
    }
  }
});
```

## Error Handling

Middleware failures don't break chunk processing:

```typescript
const robustMiddleware: ChunkMiddleware = {
  name: 'robust-analyzer',
  enabled: true,
  priority: 3,
  
  async process(chunk: SusurroChunk): Promise<SusurroChunk> {
    try {
      // Potentially failing operation
      const analysis = await performComplexAnalysis(chunk.transcript);
      
      return {
        ...chunk,
        metadata: {
          ...chunk.metadata,
          analysis
        }
      };
    } catch (error) {
      console.error('Analysis failed:', error);
      
      // Return chunk unchanged on error
      return {
        ...chunk,
        metadata: {
          ...chunk.metadata,
          analysisError: error.message
        }
      };
    }
  }
};
```

## Middleware Best Practices

1. **Keep processing fast**: Target <50ms processing time per middleware
2. **Handle errors gracefully**: Always return a valid chunk, even on failure
3. **Use appropriate priorities**: Quality (0) → Translation (1) → Sentiment (2) → Intent (3)
4. **Monitor performance**: Use latency monitoring to detect slow middleware
5. **Make middleware optional**: Allow disabling for performance-critical scenarios
6. **Add meaningful metadata**: Enhance chunks with useful information for your application

## Integration with Latency Monitoring

The Phase 3 latency monitoring system tracks middleware performance:

```typescript
import { latencyMonitor } from '@susurro/core';

// Get detailed latency breakdown
const report = latencyMonitor.generateReport();
console.log('Middleware latency:', report.breakdown.middleware);

// Monitor real-time status
const status = latencyMonitor.getRealtimeStatus();
if (!status.isHealthy) {
  console.warn('High latency detected, consider disabling middleware');
}

// Export performance data
const csvData = latencyMonitor.exportMetrics('csv');
console.log('Performance data:', csvData);
```

This middleware system provides the foundation for building intelligent, real-time voice applications with Susurro's conversational architecture.