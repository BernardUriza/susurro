# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

### Primary Development
```bash
# Install dependencies
npm install

# Development - runs package, vite, backends AND tests in watch mode
npm run dev

# Development with tests only (no Whisper backend)
npm run dev:with-tests

# Simple development mode (Vite only, no tests)
npm run dev:simple

# Build for production
npm run build

# Preview production build
npm run preview
```

**IMPORTANT: `npm run dev` now includes test watch mode by default!**
- Tests run automatically when you save files
- Instant feedback on breaking changes
- Minimal output with dot reporter
- Tests are shown in cyan 🧪 TESTS panel

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
This project uses a **singleton audio engine architecture** managed through React Context to prevent multiple audio engine instances. Direct usage of `useSusurro` hook is forbidden - all components must use `useNeural()` from NeuralProvider.

### Key Technologies
- **Deepgram**: Primary transcription engine (default backend)
- **Murmuraba v3**: Neural audio processing engine
- **Neural AI**: Unified transcription system (formerly Whisper)
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
│   ├── contexts/           # NeuralContext (required wrapper)
│   ├── components/         # UI components
│   └── features/           # Feature modules
│       ├── audio-processing/
│       └── visualization/
└── test/                    # E2E tests
```

### Critical Architectural Rules

1. **Audio Engine Singleton Pattern**: The AudioEngineManager ensures only ONE Murmuraba engine instance exists. Multiple instances cause "Audio engine is already initialized" errors.

2. **Context-Based Access**: All components MUST access audio functionality through `useNeural()` from NeuralContext, never directly import `useSusurro`.

3. **Model Loading**: Deepgram backend handles transcription by default. Local models are loaded dynamically when needed.

4. **WebGPU Configuration**: Requires CORS headers (configured in vite.config.ts) for WebGPU acceleration.

### Key Components

#### AudioEngineManager (`packages/susurro/src/lib/audio-engine-manager.ts`)
- Singleton pattern for Murmuraba engine
- State machine: uninitialized → initializing → ready → error → destroying → destroyed
- Health monitoring with automatic recovery
- Circuit breaker pattern for error resilience

#### NeuralContext (`src/contexts/NeuralContext.tsx`)
- Provides single audio engine instance to entire app
- Manages Neural/Deepgram model loading and transcription
- Handles conversational mode with real-time chunks

#### useSusurro Hook (`packages/susurro/src/hooks/use-susurro.ts`)
- Core hook with Murmuraba integration
- Supports conversational mode with SusurroChunk emissions
- Real-time VAD (Voice Activity Detection)
- <300ms latency target

### Common Issues and Solutions

1. **"Audio engine is already initialized"**: Components are importing useSusurro directly. Use useNeural() from NeuralContext instead.

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

**IMPORTANT: Before making any code changes, always run tests to ensure nothing breaks!**

#### Pre-commit Checklist
```bash
# 1. Run tests first
npm test                    # Run all tests
npm run test:unit          # Run unit tests only

# 2. Check code quality
npm run lint               # Check for linting issues
npm run type-check         # Verify TypeScript types

# 3. Fix issues automatically
npm run lint:fix           # Auto-fix linting issues
```

#### When Making Changes

1. **Always run tests BEFORE and AFTER making changes**:
   - Unit tests: `npm run test:unit` - Tests individual hooks and components
   - E2E tests: `npm run test:e2e` - Tests complete user workflows
   - Integration tests: Tests backend API integration

2. **Test Coverage**:
   - `packages/susurro/tests/use-dual-transcription.test.ts` - Dual transcription hook tests
   - `src/features/.../SimpleTranscriptionMode.test.tsx` - UI component tests
   - `test/e2e/dual-transcription.test.ts` - E2E workflow tests
   - `test/integration/backend-refinement.test.ts` - Backend integration tests

3. **Critical Rules**:
   - Use the NeuralProvider wrapper in all demo components
   - Monitor browser console for audio engine state changes
   - Deepgram is the default backend - always use backend transcription
   - Ensure WASM files are copied when starting development
   - NEVER skip tests when making changes to core functionality

4. **Backend Testing**:
   - Start backend: `cd backend-deepgram && python server.py`
   - Integration tests require backend running on port 8001
   - Tests will skip gracefully if backend unavailable