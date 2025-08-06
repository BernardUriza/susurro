# Development Guide

## Getting Started

### Prerequisites

```bash
Node.js 18+ (LTS recommended)
npm, yarn, or pnpm
Modern browser with WebGPU support (Chrome/Edge 113+)
```

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/susurro.git
cd susurro

# Install dependencies
npm install

# Build the library
npm run build-lib

# Start development server
npm run dev
```

### Project Structure

```
susurro/
├── packages/susurro/          # Core library
│   ├── src/
│   │   ├── hooks/             # React hooks (kebab-case)
│   │   │   ├── use-susurro.ts
│   │   │   ├── use-whisper-direct.ts
│   │   │   ├── use-model-cache.ts
│   │   │   └── use-latency-monitor.ts
│   │   ├── lib/               # Core libraries
│   │   │   ├── modern-vad.ts
│   │   │   ├── dynamic-loaders.ts
│   │   │   ├── types.ts
│   │   │   └── murmuraba-types.ts
│   │   └── index.ts           # Public API
│   └── package.json
├── src/                       # Demo application
│   ├── components/
│   │   ├── matrix-navigation/ # Main UI (kebab-case)
│   │   └── matrix-scroll-area/
│   └── features/
│       ├── audio-processing/
│       └── visualization/
└── docs/                      # Documentation
```

## React 19 Conventions

### File Naming

**✅ Correct (kebab-case)**:
```
use-susurro.ts
use-whisper-direct.ts  
matrix-navigation.tsx
whisper-echo-logs.tsx
modern-vad.ts
```

**❌ Incorrect (PascalCase)**:
```
UseSusurro.ts
UseWhisperDirect.ts
MatrixNavigation.tsx
WhisperEchoLogs.tsx
```

### Import Organization (4-tier structure)

```tsx
// 1. React and external libraries
import { useState, useEffect } from 'react';
import { SomeExternalLib } from 'external-package';

// 2. Absolute imports (internal modules)
import { useSusurro } from '../../../packages/susurro/src/hooks/use-susurro';
import { ModernVAD } from '../lib/modern-vad';

// 3. Type imports
import type { SusurroChunk, VADConfig } from './types';

// 4. Style imports
import styles from './component.module.css';
```

## Development Workflow

### Building the Library

```bash
# Build library for distribution
npm run build-lib

# Watch mode for development
npm run dev-lib

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Testing

```bash
# Run all tests
npm run test

# Unit tests
npm run test:unit

# E2E tests  
npm run test:e2e

# Test coverage
npm run test:coverage
```

### Code Quality

```bash
# Format code
npm run format

# Lint and fix
npm run lint:fix

# Type check
npm run typecheck

# Pre-commit hooks
npm run pre-commit
```

## Core Development Concepts

### Hook-based Architecture

**Central Pattern**: All functionality exposed via React hooks

```tsx
// ❌ Old singleton pattern (eliminated)
const audioManager = AudioManager.getInstance()

// ✅ New hook pattern
const { startRecording, stopRecording } = useSusurro()
```

### Zero MediaRecorder Architecture

**Key Principle**: All audio processing through Murmuraba v3

```tsx
// ❌ MediaRecorder usage (forbidden)
const mediaRecorder = new MediaRecorder(stream)

// ✅ Murmuraba engine (required)
const { audioEngine } = useMurmubaraEngine()
```

### Dynamic Import Strategy

**Optimization**: Lazy load heavy dependencies

```tsx
// ✅ Dynamic imports for large modules
const loadTransformers = async () => {
  return await import(
    /* webpackChunkName: "transformers" */
    '@xenova/transformers'
  )
}

// ❌ Direct imports for large modules
import { pipeline } from '@xenova/transformers'
```

## Component Development

### Creating New Components

```tsx
// 1. Create component file (kebab-case)
// src/components/new-component/new-component.tsx

// 2. Use 4-tier import structure
import { useState } from 'react';
import { useSusurro } from '../../packages/susurro';
import type { ComponentProps } from './types';
import styles from './new-component.module.css';

// 3. Export with kebab-case naming
export const NewComponent = (props: ComponentProps) => {
  // Component implementation
}

// 4. Create index file
// src/components/new-component/index.ts
export { NewComponent } from './new-component';
export type { ComponentProps } from './types';
```

### Matrix UI Components

```tsx
// Using Matrix theme
<div className={styles.matrixContainer}>
  <div className={styles.matrixTerminal}>
    <span className={styles.matrixText}>
      [SYSTEM_STATUS: ONLINE]
    </span>
  </div>
</div>
```

### Progress Logging

```tsx
// Spanish logging with emojis
const addLog = (message: string, type: LogType) => {
  console.log(`${getEmoji(type)} ${message}`)
}

// Examples:
// 👋 Bienvenido a Susurro Whisper AI
// 🚀 Iniciando carga del modelo...
// ✅ Modelo cargado exitosamente
```

## API Development

### Adding New Hooks

```tsx
// 1. Create hook file
// packages/susurro/src/hooks/use-new-feature.ts

export const useNewFeature = (options: Options = {}) => {
  const [state, setState] = useState()
  
  return {
    // Hook API
    state,
    actions: {
      doSomething: () => setState(...)
    }
  }
}

// 2. Export from index
// packages/susurro/src/index.ts
export { useNewFeature } from './hooks/use-new-feature';
```

### VAD Integration

```tsx
// Extending VAD functionality
import { getModernVAD, ModernVADEngine } from './modern-vad'

const vadEngine = getModernVAD({
  frameSamples: 1536,
  positiveSpeechThreshold: 0.5
})

await vadEngine.initialize()
const analysis = await vadEngine.analyze(audioBuffer)
```

### Whisper Pipeline

```tsx
// Custom Whisper configuration
const whisperConfig = {
  model: 'Xenova/distil-whisper/distil-large-v3',
  dtype: { 
    encoder_model: 'fp32',
    decoder_model_merged: 'q4'
  },
  device: 'webgpu'
}
```

## Performance Development

### Monitoring Performance

```tsx
// Built-in performance monitoring
const { processingLatency } = useLatencyMonitor()

useEffect(() => {
  console.log('Processing latency:', processingLatency)
}, [processingLatency])
```

### Bundle Analysis

```bash
# Analyze bundle size
npm run build -- --analyze

# Check chunk sizes
npm run webpack-bundle-analyzer
```

### Memory Profiling

```tsx
// Memory usage monitoring
const checkMemoryUsage = () => {
  if (performance.memory) {
    console.log({
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit
    })
  }
}
```

## Testing Strategy

### Unit Testing

```tsx
// Test hooks with React Testing Library
import { renderHook } from '@testing-library/react'
import { useSusurro } from './use-susurro'

test('should initialize without errors', () => {
  const { result } = renderHook(() => useSusurro())
  expect(result.current.isRecording).toBe(false)
})
```

### Integration Testing

```tsx
// Test VAD integration
import { getModernVAD } from './modern-vad'

test('should analyze audio correctly', async () => {
  const vadEngine = getModernVAD()
  await vadEngine.initialize()
  
  const audioBuffer = new ArrayBuffer(1024)
  const result = await vadEngine.analyze(audioBuffer)
  
  expect(result.averageVad).toBeGreaterThanOrEqual(0)
  expect(result.averageVad).toBeLessThanOrEqual(1)
})
```

### E2E Testing

```tsx
// Test complete workflow
test('should record and transcribe audio', async () => {
  const { startRecording, stopRecording, transcriptions } = useSusurro()
  
  await startRecording()
  // Simulate audio input
  await new Promise(resolve => setTimeout(resolve, 1000))
  stopRecording()
  
  expect(transcriptions.length).toBeGreaterThan(0)
})
```

## Debugging

### Development Logging

```tsx
// Enable debug mode
const DEBUG_MODE = process.env.NODE_ENV === 'development'

const log = {
  info: (...args) => DEBUG_MODE && console.log('[INFO]', ...args),
  warn: (...args) => DEBUG_MODE && console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
}
```

### Performance Debugging

```tsx
// Profile processing stages
const performanceMarker = {
  start: performance.now(),
  mark(label: string) {
    const elapsed = performance.now() - this.start
    console.log(`[${label}] ${elapsed.toFixed(2)}ms`)
  }
}
```

### Network Debugging

```tsx
// Monitor model downloads
const debugNetworkRequests = () => {
  const originalFetch = window.fetch
  window.fetch = async (input, init) => {
    console.log('Fetching:', input)
    const response = await originalFetch(input, init)
    console.log('Response:', response.status)
    return response
  }
}
```

## Deployment

### Production Build

```bash
# Build for production
npm run build

# Verify build
npm run preview

# Deploy to Vercel
vercel deploy
```

### Environment Configuration

```bash
# Environment variables
VITE_HUGGINGFACE_TOKEN=your_token_here
VITE_DEBUG_MODE=false
VITE_WEBGPU_ENABLED=true
```

### Performance Optimization

```bash
# Enable persistent storage in production
# Check bundle sizes
# Verify WebGPU availability
# Monitor loading performance
```

## Contributing

### Pull Request Guidelines

1. Follow React 19 conventions (kebab-case files)
2. Use 4-tier import structure
3. Add tests for new features
4. Update documentation
5. Ensure MediaRecorder is not used

### Code Review Checklist

- [ ] File naming follows kebab-case
- [ ] Imports organized in 4 tiers
- [ ] No MediaRecorder usage
- [ ] Performance considerations addressed
- [ ] Tests added/updated
- [ ] Documentation updated