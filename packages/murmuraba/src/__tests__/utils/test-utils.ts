/**
 * Main test utilities export file
 * Import everything from here for a clean, organized test setup
 */

import { describe, afterEach, expect } from 'vitest';

// Re-export all utilities
export * from './audio-context-utils';
export * from './console-utils';
export * from './factories';
export * from './custom-matchers';

// Import for side effects (auto-setup custom matchers)
import './custom-matchers';

import { vi } from 'vitest';
import { setupAudioContextMock, type AudioContextMockOptions } from './audio-context-utils';
import { useConsoleMocks, type ConsoleMockOptions } from './console-utils';

/**
 * Complete test environment setup
 * Combines all common test setup patterns
 */
export interface TestEnvironmentOptions {
  audio?: AudioContextMockOptions;
  console?: ConsoleMockOptions;
  wasm?: {
    rnnoiseState?: number;
    vadProbability?: number;
  };
  fetch?: boolean;
  timers?: boolean;
}

export interface TestEnvironment {
  audioContext: any;
  consoleMocks: ReturnType<typeof useConsoleMocks>;
  wasmModule?: any;
  cleanup: () => void;
}

/**
 * Setup complete test environment with all common mocks
 */
export function setupTestEnvironment(options: TestEnvironmentOptions = {}): TestEnvironment {
  const env: TestEnvironment = {
    audioContext: null,
    consoleMocks: null as any,
    cleanup: () => {},
  };

  // Setup console mocks
  const getConsoleMocks = useConsoleMocks(options.console);
  env.consoleMocks = getConsoleMocks;

  // Setup AudioContext mock
  const audioMock = setupAudioContextMock(options.audio);
  env.audioContext = audioMock.context;

  // Setup WASM mocks if needed
  if (options.wasm) {
    env.wasmModule = setupWASMMocks(options.wasm);
  }

  // Setup fetch mock if needed
  if (options.fetch) {
    setupFetchMock();
  }

  // Setup timers if needed
  if (options.timers) {
    vi.useFakeTimers();
  }

  // Cleanup function
  env.cleanup = () => {
    audioMock.restore();
    vi.clearAllMocks();
    
    if (options.timers) {
      vi.useRealTimers();
    }
  };

  return env;
}

/**
 * Setup WASM module mocks
 */
function setupWASMMocks(options: { rnnoiseState?: number; vadProbability?: number } = {}) {
  const { rnnoiseState = 12345, vadProbability = 0.7 } = options;

  const mockModule = {
    _rnnoise_create: vi.fn().mockReturnValue(rnnoiseState),
    _rnnoise_destroy: vi.fn(),
    _rnnoise_process_frame: vi.fn().mockReturnValue(vadProbability),
    _malloc: vi.fn((size: number) => size),
    _free: vi.fn(),
    HEAPF32: new Float32Array(10000),
    HEAP32: new Int32Array(10000),
    HEAPU8: new Uint8Array(10000),
    HEAPU32: new Uint32Array(10000),
  };

  // Mock the loader
  vi.doMock('../../utils/rnnoise-loader', () => ({
    loadRNNoiseModule: vi.fn().mockResolvedValue(mockModule),
  }));

  return mockModule;
}

/**
 * Setup fetch mock for blob and WASM operations
 */
function setupFetchMock() {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.startsWith('blob:')) {
      return Promise.resolve({
        ok: true,
        blob: vi.fn().mockResolvedValue(new Blob(['mock audio data'], { type: 'audio/webm' })),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      });
    }
    
    if (url.includes('.wasm')) {
      const mockWasm = new ArrayBuffer(8);
      new Uint8Array(mockWasm).set([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
      return Promise.resolve({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockWasm),
      });
    }
    
    return Promise.reject(new Error(`Fetch not mocked for URL: ${url}`));
  });
}

/**
 * Helper to wait for async operations
 */
export async function waitForAsync(ms = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper to flush all promises
 */
export async function flushPromises(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Create a deferred promise for testing async operations
 */
export function createDeferred<T = void>() {
  let resolve: (value: T) => void;
  let reject: (error: any) => void;
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}

/**
 * Mock performance.now for consistent timing tests
 */
export function mockPerformanceNow(sequence: number[]) {
  let index = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => {
    const value = sequence[index % sequence.length];
    index++;
    return value;
  });
}

/**
 * Helper for testing error scenarios
 */
export async function expectAsyncError(
  fn: () => Promise<any>,
  errorPattern?: string | RegExp
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw');
  } catch (error: any) {
    if (errorPattern) {
      if (typeof errorPattern === 'string') {
        expect(error.message).toContain(errorPattern);
      } else {
        expect(error.message).toMatch(errorPattern);
      }
    }
  }
}

/**
 * Create a test suite with common setup
 */
export function createTestSuite(
  name: string,
  options: TestEnvironmentOptions = {},
  tests: (env: TestEnvironment) => void
) {
  describe(name, () => {
    const env = setupTestEnvironment(options);

    afterEach(() => {
      env.cleanup();
    });

    tests(env);
  });
}