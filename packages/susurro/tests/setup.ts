import { vi } from 'vitest';

// Mock browser APIs
Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [
          {
            stop: vi.fn(),
          },
        ],
      }),
    },
    userAgent: 'test',
  },
  writable: true,
});

global.AudioContext = vi.fn().mockImplementation(() => ({
  createBuffer: vi.fn(),
  decodeAudioData: vi.fn().mockResolvedValue({
    duration: 10,
    sampleRate: 44100,
    numberOfChannels: 2,
    getChannelData: vi.fn().mockReturnValue(new Float32Array(44100)),
  }),
  close: vi.fn(),
})) as any;

global.MediaRecorder = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  state: 'inactive',
  stream: {
    getTracks: () => [
      {
        stop: vi.fn(),
      },
    ],
  },
})) as any;

// Mock IndexedDB
const mockDB = {
  transaction: vi.fn(() => ({
    objectStore: vi.fn(() => ({
      get: vi.fn(() => ({
        onsuccess: null,
        onerror: null,
        result: null,
      })),
      put: vi.fn(() => ({
        onsuccess: null,
        onerror: null,
      })),
      clear: vi.fn(() => ({
        onsuccess: null,
        onerror: null,
      })),
    })),
  })),
};

global.indexedDB = {
  open: vi.fn(() => ({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: mockDB,
  })),
} as any;

// Mock storage API
Object.defineProperty(global.navigator, 'storage', {
  value: {
    estimate: vi.fn().mockResolvedValue({
      usage: 1000000,
      quota: 10000000,
    }),
    persist: vi.fn().mockResolvedValue(true),
  },
  writable: true,
});
