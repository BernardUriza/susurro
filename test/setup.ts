import { vi } from 'vitest'

global.AudioContext = vi.fn().mockImplementation(() => ({
  createAnalyser: vi.fn(),
  createGain: vi.fn(),
  createMediaStreamSource: vi.fn(),
  sampleRate: 48000,
  currentTime: 0,
  state: 'running',
  destination: {},
  close: vi.fn()
}))

global.MediaRecorder = vi.fn() as any
global.MediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true)
global.URL.createObjectURL = vi.fn()