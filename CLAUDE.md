# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

### Primary Development
```bash
# Install dependencies
npm install

# Development - runs both package and vite dev servers
npm run dev

# Simple development mode (Vite only)
npm run dev:simple

# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing
```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run E2E tests
npm run test:e2e

# Run specific E2E test (Whisper pipeline)
npm run test:e2e:whisper

# Run E2E test with Puppeteer
npm run test:e2e:puppeteer

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run coverage
```

### Code Quality
```bash
# Lint code - check for issues
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Type checking
npm run type-check

# Strict type checking
npm run type-check:strict

# Analyze project structure
npm run analyze

# Dead code detection
npm run analyze:dead-code
```

### Package Management
```bash
# Build library for publishing
npm run build-lib

# Clean build artifacts (Windows)
npm run clean

# Copy WASM files (auto-run with dev/build)
npm run copy:wasm
```

## Architecture Overview

### Core Architecture Pattern
This project uses a **singleton audio engine architecture** managed through React Context to prevent multiple audio engine instances. Direct usage of `useSusurro` hook is forbidden - all components must use `useWhisper()` from WhisperProvider.

### Key Technologies
- **Murmuraba v3**: Neural audio processing engine (replaced MediaRecorder)
- **Distil-Whisper v3**: Speech-to-text using `Xenova/distil-whisper` models with WebGPU acceleration
- **Transformers.js v3**: Uses `@huggingface/transformers` for model loading
- **React 19 + Vite 7**: Modern build system with optimized chunking

### Project Structure
```
susurro/
├── packages/susurro/        # Core NPM package (@susurro/core)
│   ├── src/
│   │   ├── hooks/          # React hooks (useSusurro, useLatencyMonitor, etc.)
│   │   ├── lib/            # Core libraries (audio-engine-manager, types, middleware)
│   │   └── index.ts        # Package exports
│   └── tests/              # Unit tests for package
├── src/                     # Demo application
│   ├── app.tsx             # Main app component
│   ├── contexts/           # WhisperContext (required wrapper)
│   ├── components/         # UI components
│   └── features/           # Feature modules
│       ├── audio-processing/
│       └── visualization/
└── test/                    # E2E tests
```

### Critical Architectural Rules

1. **Audio Engine Singleton Pattern**: The AudioEngineManager ensures only ONE Murmuraba engine instance exists. Multiple instances cause "Audio engine is already initialized" errors.

2. **Context-Based Access**: All components MUST access audio functionality through `useWhisper()` from WhisperContext, never directly import `useSusurro`.

3. **Model Loading**: Whisper models are loaded dynamically via transformers.js v3 with caching in ASR_PIPELINE_CACHE to prevent duplicate loads.

4. **WebGPU Configuration**: Requires CORS headers (configured in vite.config.ts) for WebGPU acceleration.

### Key Components

#### AudioEngineManager (`packages/susurro/src/lib/audio-engine-manager.ts`)
- Singleton pattern for Murmuraba engine
- State machine: uninitialized → initializing → ready → error → destroying → destroyed
- Health monitoring with automatic recovery
- Circuit breaker pattern for error resilience

#### WhisperContext (`src/contexts/WhisperContext.tsx`)
- Provides single audio engine instance to entire app
- Manages Whisper model loading and transcription
- Handles conversational mode with real-time chunks

#### useSusurro Hook (`packages/susurro/src/hooks/use-susurro.ts`)
- Core hook with Murmuraba integration
- Supports conversational mode with SusurroChunk emissions
- Real-time VAD (Voice Activity Detection)
- <300ms latency target

### Common Issues and Solutions

1. **"Audio engine is already initialized"**: Components are importing useSusurro directly. Use useWhisper() from WhisperContext instead.

2. **Model loading failures**: Check network connection and ensure transformers.js can download from Hugging Face.

3. **WASM loading errors**: Run `npm run copy:wasm` to ensure rnnoise.wasm is in public/wasm/.

4. **Type errors in build**: Run `npm run type-check` before committing. Use `npm run lint:fix` for automatic fixes.

### Performance Optimizations

- **Dynamic imports**: Transformers.js and Murmuraba loaded on-demand
- **Code splitting**: Vendor chunks for react, transformers, murmuraba
- **4-bit quantization**: Uses q4 dtype for optimal model size/quality
- **WebGPU acceleration**: 6x faster transcription when available
- **Chunk size limit**: 1400KB warning threshold for vendor libraries

### Testing Strategy

- **Unit tests**: Test individual hooks and utilities
- **E2E tests**: Test full transcription pipeline with Puppeteer
- **Vitest configuration**: 60s timeout for model loading
- **Happy-dom environment**: Fast DOM testing environment

### Development Workflow

1. Always run `npm run lint` and `npm run type-check` before committing
2. Use the WhisperProvider wrapper in all demo components
3. Monitor browser console for audio engine state changes
4. Test with different Whisper model sizes (tiny, base, small, medium, large)
5. Ensure WASM files are copied when starting development