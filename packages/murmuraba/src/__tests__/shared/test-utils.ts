/**
 * Shared Test Utilities
 * Consolidates all duplicated test patterns and mocks
 */

import { vi } from 'vitest';

// Consolidated Mock Factories
export const MockFactories = {
  // Audio Context Mock Factory
  createAudioContextMock: (options: Partial<AudioContext> = {}) => {
    const mockAudioContext = {
      createScriptProcessor: vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
        onaudioprocess: null,
      }),
      createAnalyser: vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
        frequencyBinCount: 1024,
        getByteFrequencyData: vi.fn(),
        getByteTimeDomainData: vi.fn(),
      }),
      createGain: vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 1 },
      }),
      createBiquadFilter: vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
        frequency: { value: 440 },
        Q: { value: 1 },
        type: 'lowpass',
      }),
      destination: {
        connect: vi.fn(),
        disconnect: vi.fn(),
      },
      sampleRate: 44100,
      currentTime: 0,
      state: 'running',
      suspend: vi.fn(),
      resume: vi.fn(),
      close: vi.fn(),
      ...options,
    };

    return mockAudioContext as unknown as AudioContext;
  },

  // MediaRecorder Mock Factory
  createMediaRecorderMock: (options: Partial<MediaRecorder> = {}) => {
    const mockMediaRecorder = {
      start: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      state: 'inactive',
      mimeType: 'audio/webm',
      ondataavailable: null,
      onerror: null,
      onpause: null,
      onresume: null,
      onstart: null,
      onstop: null,
      ...options,
    };

    return mockMediaRecorder as unknown as MediaRecorder;
  },

  // MediaStream Mock Factory
  createMediaStreamMock: (tracks: MediaStreamTrack[] = []) => {
    const mockStream = {
      id: 'mock-stream-id',
      active: true,
      getTracks: vi.fn().mockReturnValue(tracks),
      getAudioTracks: vi.fn().mockReturnValue(tracks.filter(t => t.kind === 'audio')),
      getVideoTracks: vi.fn().mockReturnValue(tracks.filter(t => t.kind === 'video')),
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      clone: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    return mockStream as unknown as MediaStream;
  },

  // AudioBuffer Mock Factory
  createAudioBufferMock: (channels = 2, length = 1024, sampleRate = 44100) => {
    const mockBuffer = {
      sampleRate,
      length,
      duration: length / sampleRate,
      numberOfChannels: channels,
      getChannelData: vi.fn().mockImplementation((channel: number) => {
        return new Float32Array(length).fill(0.1);
      }),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    };

    return mockBuffer as unknown as AudioBuffer;
  },

  // WASM Module Mock Factory
  createWASMMock: () => ({
    RNNoiseProcessor: vi.fn().mockImplementation(() => ({
      process: vi.fn().mockReturnValue(new Float32Array(1024)),
      setGainControl: vi.fn(),
      destroy: vi.fn(),
    })),
    instance: {
      exports: {
        memory: new WebAssembly.Memory({ initial: 1 }),
        malloc: vi.fn().mockReturnValue(0),
        free: vi.fn(),
      },
    },
  }),
};

// Console Management Utilities
export class ConsoleManager {
  private originalConsole: typeof console;
  private logs: string[] = [];
  private errors: string[] = [];
  private warnings: string[] = [];

  constructor() {
    this.originalConsole = { ...console };
  }

  startCapture(options: { silent?: boolean; captureErrors?: boolean } = {}) {
    const { silent = false, captureErrors = true } = options;

    console.log = silent 
      ? vi.fn() 
      : vi.fn().mockImplementation((...args) => {
          this.logs.push(args.join(' '));
          this.originalConsole.log(...args);
        });

    console.error = captureErrors
      ? vi.fn().mockImplementation((...args) => {
          this.errors.push(args.join(' '));
          if (!silent) this.originalConsole.error(...args);
        })
      : this.originalConsole.error;

    console.warn = vi.fn().mockImplementation((...args) => {
      this.warnings.push(args.join(' '));
      if (!silent) this.originalConsole.warn(...args);
    });
  }

  stopCapture() {
    Object.assign(console, this.originalConsole);
  }

  getLogs() { return [...this.logs]; }
  getErrors() { return [...this.errors]; }
  getWarnings() { return [...this.warnings]; }
  
  clear() {
    this.logs = [];
    this.errors = [];
    this.warnings = [];
  }

  hasLogContaining(text: string) {
    return this.logs.some(log => log.includes(text));
  }

  hasErrorContaining(text: string) {
    return this.errors.some(error => error.includes(text));
  }
}

// Test Environment Setup
export class TestEnvironment {
  private consoleManager = new ConsoleManager();
  private mocks: { [key: string]: any } = {};
  private cleanupFunctions: (() => void)[] = [];

  setup(config: {
    audio?: boolean;
    mediaRecorder?: boolean;
    console?: { silent?: boolean; captureErrors?: boolean };
    wasm?: boolean;
  } = {}) {
    // Setup console management
    if (config.console) {
      this.consoleManager.startCapture(config.console);
      this.cleanupFunctions.push(() => this.consoleManager.stopCapture());
    }

    // Setup Audio Context
    if (config.audio) {
      const mockAudioContext = MockFactories.createAudioContextMock();
      (global as any).AudioContext = vi.fn().mockImplementation(() => mockAudioContext);
      (global as any).webkitAudioContext = vi.fn().mockImplementation(() => mockAudioContext);
      this.mocks.audioContext = mockAudioContext;
      
      this.cleanupFunctions.push(() => {
        delete (globalThis as any).AudioContext;
        delete (globalThis as any).webkitAudioContext;
      });
    }

    // Setup MediaRecorder
    if (config.mediaRecorder) {
      const mockMediaRecorder = MockFactories.createMediaRecorderMock();
      (global as any).MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder) as any;
      ((global as any).MediaRecorder as any).isTypeSupported = vi.fn().mockReturnValue(true);
      this.mocks.mediaRecorder = mockMediaRecorder;
      
      this.cleanupFunctions.push(() => {
        delete (globalThis as any).MediaRecorder;
      });
    }

    // Setup WASM
    if (config.wasm) {
      this.mocks.wasm = MockFactories.createWASMMock();
    }

    return this;
  }

  get console() { return this.consoleManager; }
  get audioContext() { return this.mocks.audioContext; }
  get mediaRecorder() { return this.mocks.mediaRecorder; }
  get wasm() { return this.mocks.wasm; }

  cleanup() {
    this.cleanupFunctions.forEach(fn => fn());
    this.cleanupFunctions = [];
    vi.clearAllMocks();
  }
}

// Utility Functions
export const TestUtils = {
  // Wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Wait for condition to be true
  waitForCondition: async (condition: () => boolean, timeout = 5000) => {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) {
      await TestUtils.waitFor(10);
    }
    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  },

  // Create test audio data
  createTestAudioData: (length = 1024, frequency = 440, sampleRate = 44100) => {
    const data = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      data[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
    }
    return data;
  },

  // Simulate file drop event
  createDropEvent: (files: File[]) => {
    const event = new Event('drop') as any;
    event.dataTransfer = {
      files,
      items: files.map(file => ({ getAsFile: () => file })),
    };
    return event;
  },

  // Common assertion helpers
  expectNoConsoleErrors: (consoleManager: ConsoleManager) => {
    const errors = consoleManager.getErrors();
    if (errors.length > 0) {
      throw new Error(`Unexpected console errors: ${errors.join(', ')}`);
    }
  },

  expectConsoleLogContaining: (consoleManager: ConsoleManager, text: string) => {
    if (!consoleManager.hasLogContaining(text)) {
      throw new Error(`Expected console log containing "${text}", but found: ${consoleManager.getLogs().join(', ')}`);
    }
  },
};

// Export commonly used combinations
export const createTestEnvironment = (config?: Parameters<TestEnvironment['setup']>[0]) => {
  const env = new TestEnvironment();
  return env.setup(config);
};

export const createAudioTestEnvironment = () => {
  return createTestEnvironment({
    audio: true,
    mediaRecorder: true,
    console: { silent: true },
  });
};

export const createFullTestEnvironment = () => {
  return createTestEnvironment({
    audio: true,
    mediaRecorder: true,
    console: { captureErrors: true },
    wasm: true,
  });
};