# 🧪 Susurro Test Suite

Comprehensive testing suite following 2025 best practices with automatic watch mode during development.

## 🚀 Quick Start

```bash
# Development with automatic test watching
npm run dev              # Tests run automatically on file changes 🎯

# Run all tests once
npm test                 # All tests (single run)
npm run test:all        # Unit + Integration + E2E (pre-commit)

# Interactive test UI
npm run test:ui         # Visual debugging interface
```

## 📊 Test Structure

```
test/
├── e2e/                          # End-to-end tests
│   ├── dual-transcription.test.ts    # Complete user workflow
│   └── whisper-pipeline.test.ts      # Legacy Whisper pipeline
├── integration/                  # Integration tests
│   └── backend-refinement.test.ts    # Deepgram + Claude API
└── README.md                     # This file

packages/susurro/tests/           # Unit tests
├── use-dual-transcription.test.ts    # Dual transcription hook
└── useSusurro.test.ts               # Core Susurro hook

src/features/.../
└── SimpleTranscriptionMode.test.tsx  # UI component tests
```

## 🎯 Test Categories

### Unit Tests
**What**: Individual functions, hooks, and components
**Speed**: Fast (milliseconds)
**Run with**: `npm run test:unit`

- ✅ `use-dual-transcription.test.ts` - Dual transcription hook logic
- ✅ `useSusurro.test.ts` - Core audio processing hook
- ✅ `SimpleTranscriptionMode.test.tsx` - Simple mode UI component

### Integration Tests
**What**: Backend API interactions
**Speed**: Medium (seconds)
**Run with**: `npm run test:integration`
**Requires**: Backend running on port 8001

- ✅ `backend-refinement.test.ts` - Deepgram transcription + Claude refinement

### E2E Tests
**What**: Complete user workflows
**Speed**: Slow (seconds to minutes)
**Run with**: `npm run test:e2e`

- ✅ `dual-transcription.test.ts` - Full transcription workflow
- ✅ `whisper-pipeline.test.ts` - Legacy Whisper pipeline (deprecated)

## 🔄 Development Workflow

### Option 1: Automatic Watch Mode (Recommended ⭐)

```bash
npm run dev
```

This starts:
- 📦 SUSURRO - Package development
- ⚡ FRONTEND - Vite dev server
- 🎙️ WHISPER - Whisper backend (optional)
- 🌊 DEEPGRAM - Deepgram backend
- **🧪 TESTS - Automatic test watching**

**Benefits**:
- ✅ Tests run on every file save
- ✅ Instant feedback on breaking changes
- ✅ Minimal output (dot reporter)
- ✅ Parallel execution with dev servers

### Option 2: Manual Testing

```bash
# Quick unit tests
npm run test:unit

# Watch unit tests only
npm run test:unit:watch

# Full pre-commit check
npm run test:all
```

## 📝 Writing Tests

### Test File Naming
- Unit tests: `*.test.ts` or `*.test.tsx`
- E2E tests: `test/e2e/*.test.ts`
- Integration tests: `test/integration/*.test.ts`

### Example Unit Test

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDualTranscription } from '../src/hooks/use-dual-transcription';

describe('useDualTranscription', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useDualTranscription());

    expect(result.current.isTranscribing).toBe(false);
    expect(result.current.webSpeechText).toBe('');
  });
});
```

### Example Integration Test

```typescript
describe('Backend Integration', () => {
  it('should refine dual transcriptions', async () => {
    const response = await fetch('http://localhost:8001/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        web_speech_text: 'hola',
        deepgram_text: 'Hola.',
        language: 'es',
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.refined_text).toBeTruthy();
  });
});
```

## 🎨 Test Output

### Watch Mode (Development)
```
🧪 TESTS | PASS  Waiting for file changes...
🧪 TESTS | ✓ packages/susurro/tests/use-dual-transcription.test.ts (8)
🧪 TESTS | ✓ src/features/.../SimpleTranscriptionMode.test.tsx (12)
🧪 TESTS | Test Files  2 passed (2)
🧪 TESTS | Tests  20 passed (20)
```

### Single Run (CI/Pre-commit)
```
✓ packages/susurro/tests/use-dual-transcription.test.ts (8)
  ✓ should initialize with default state
  ✓ should start transcription
  ✓ should refine text with Claude
  ...

Test Files  4 passed (4)
Tests  35 passed (35)
```

## 🔧 Configuration

### Vitest Config
Located in `vitest.config.ts`:
- 60s timeout for model loading
- Happy-dom environment for DOM testing
- Coverage reporting with c8
- Concurrent test execution

### Test Scripts
All test scripts defined in `package.json`:
```json
{
  "test": "vitest run",
  "test:watch": "vitest --reporter=dot --hideSkippedTests",
  "test:unit": "vitest run packages/susurro/tests",
  "test:integration": "vitest run test/integration",
  "test:e2e": "vitest run test/e2e",
  "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e"
}
```

## 🚨 Troubleshooting

### Tests Failing on Backend Integration
```bash
# Start the backend first
cd backend-deepgram && python server.py

# Then run integration tests
npm run test:integration
```

### Tests Timing Out
- Check `vitest.config.ts` timeout settings
- Model loading tests need 60s timeout
- E2E tests may need longer timeouts

### Watch Mode Not Updating
- Ensure file changes are saved
- Check Vitest is watching correct directories
- Restart watch mode if needed

## 📚 Best Practices

1. ✅ **Use watch mode during development** - Instant feedback
2. ✅ **Run `test:all` before committing** - Catch all issues
3. ✅ **Write tests for new features** - Protect your work
4. ✅ **Keep tests focused** - One concept per test
5. ✅ **Mock external dependencies** - Fast, reliable tests
6. ✅ **Use descriptive test names** - Clear documentation

## 🎯 Coverage Goals

- **Unit Tests**: >80% coverage
- **Integration Tests**: All API endpoints
- **E2E Tests**: Critical user paths

Run coverage report:
```bash
npm run coverage
```

## 📖 Resources

- [Vitest Documentation](https://vitest.dev)
- [Testing Library](https://testing-library.com)
- [Playwright (E2E)](https://playwright.dev)

---

**Remember**: Tests are running automatically in `npm run dev` - you get instant feedback on every change! 🎯
