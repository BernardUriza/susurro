# CLAUDE.md - Susurro Audio Transcription System

## CLI Commands

```bash
npm i && npm run dev          # Full stack: Vite + backends + tests (watch)
npm run dev:simple            # Vite only
npm test / test:all           # CI validation
npm run lint:fix && npm run type-check && npm test:all  # Pre-commit
```

## Architecture

### Core Pattern: Singleton Audio Engine
- **Access**: `useNeural()` from NeuralContext (NEVER direct `useSusurro` import)
- **State Machine**: uninitialized→initializing→ready→error→destroying→destroyed
- **Engine**: Murmuraba v3 (RNNoise, VAD, real-time processing)
- **Transcription**: Deepgram (default), Whisper (fallback), Claude AI (refinement)
- **Stack**: React 19, Vite 7, TypeScript, Vitest

### Project Structure
```
packages/susurro/          # @susurro/core NPM package
  src/hooks/               # useSusurro, useDualTranscription, useLatencyMonitor
  src/lib/                 # audio-engine-manager, types, middleware
  tests/                   # Unit tests (60s timeout for model loading)
src/                       # Demo app
  contexts/NeuralContext   # Singleton wrapper (REQUIRED)
  features/                # Feature modules
test/                      # E2E (Playwright)
```

### Key Components

**AudioEngineManager** (`lib/audio-engine-manager.ts`)
- Singleton Murmuraba instance, health monitoring, circuit breaker
- Error: "Audio engine already initialized" → Check for duplicate `useSusurro` imports

**NeuralContext** (`contexts/NeuralContext.tsx`)
- Global audio engine instance, model loading, conversational mode

**useSusurro** (`hooks/use-susurro.ts`)
- Murmuraba integration, VAD, streaming chunks, <300ms latency target

### Performance
- Dynamic imports (Transformers.js, Murmuraba on-demand)
- Code splitting (vendor chunks: react, transformers, murmuraba <1400KB)
- 4-bit quantization (q4 dtype), WebGPU acceleration (6x faster)

## Testing Strategy

**TDD Workflow**: `npm run dev` → auto-watch tests (cyan 🧪 panel) → instant feedback
- Unit: Individual hooks/utilities
- Integration: Backend API (port 8001)
- E2E: Full pipeline (Playwright)

**Coverage**:
- `packages/susurro/tests/use-dual-transcription.test.ts` (unit)
- `src/features/.../SimpleTranscriptionMode.test.tsx` (UI)
- `test/e2e/dual-transcription.test.ts` (E2E)
- `test/integration/backend-refinement.test.ts` (API)

## Best Practices (2025)

### MediaStream Lifecycle
```ts
// ✅ Cleanup pattern
useEffect(() => {
  let stream: MediaStream | null = null;
  (async () => {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  })();
  return () => stream?.getTracks().forEach(t => t.stop());
}, []);

// ❌ Anti-patterns
stream.removeTrack(track);           // Camera stays on
useState<MediaStream>(...)           // Missing cleanup → memory leak
```

**Rule**: `getTracks().forEach(t => t.stop())` on unmount/cleanup. AudioContext: `close()`. MediaRecorder: `stop()` + null reference.

### React Hooks: exhaustive-deps
```ts
// ✅ Include all deps
useCallback(() => console.log(userId), [userId])

// ✅ setState callback (no dep on state)
useCallback(() => setCount(p => p+1), [])

// ✅ Move fn inside effect
useEffect(() => {
  const fetch = async () => api.get(userId);
  fetch();
}, [userId]);

// ✅ Legitimate ignore (document reason)
useEffect(() => {
  someFunction();  // Including would cause ∞ loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [dep]);

// ❌ Silent bugs
useEffect(() => doSomething(userId), []) // userId changes ignored!
```

**Safe omissions**: Redux `dispatch`, `setState` (stable), `window.scrollTo` (DOM API).
**Solutions**: (1) Move fn inside effect, (2) `useCallback`, (3) Destructure props, (4) `useRef` for non-reactive values.

### TypeScript
```ts
// ✅ Type safety
unknown → type guard
Record<string, unknown>
typeof import('module') | null
<T,>(data: T): T

// ❌ Avoid
any → breaks type system
var → use const/let
@ts-ignore → use @ts-expect-error (fails if error fixed)
```

### Code Quality
- Console: `// eslint-disable-next-line no-console` (debugging only)
- Unused vars: `const _unused = ...` or comment
- Memory leaks: Always cleanup streams, contexts, timers
- State updates: Use callback form `setState(prev => ...)` to avoid deps

## Critical Rules
1. NeuralProvider wrapper REQUIRED for all components
2. Deepgram default backend (Whisper fallback)
3. WASM files: `npm run copy:wasm` before dev
4. Tests MUST pass before commit
5. Monitor browser console for engine state transitions
6. Backend integration: `cd backend-deepgram && python server.py` (port 8001)

## Troubleshooting
| Issue | Solution |
|-------|----------|
| "Audio engine already initialized" | Remove direct `useSusurro` imports → use `useNeural()` |
| Model loading fails | Check network, Hugging Face access |
| WASM errors | `npm run copy:wasm` |
| Type errors | `npm run type-check`, `npm run lint:fix` |
| Memory leaks | Verify stream cleanup in DevTools Memory Profiler |
