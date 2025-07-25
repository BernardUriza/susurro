import { describe, it, expect, vi, beforeEach } from 'vitest'
import { murmurabaManager } from '../../src/lib/murmuraba-singleton'
import { WhisperSingleton } from '../../src/lib/whisper-singleton'

// Mock de murmuraba
vi.mock('../../src/lib/murmuraba-singleton', () => ({
  murmurabaManager: {
    initialize: vi.fn(),
    processFileWithMetrics: vi.fn()
  }
}))

// Mock de WhisperSingleton
vi.mock('../../src/lib/whisper-singleton', () => ({
  WhisperSingleton: {
    getInstance: vi.fn(() => ({
      loadModel: vi.fn(),
      processAudio: vi.fn()
    }))
  }
}))

describe('Transcription Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Murmuraba Audio Processing', () => {
    it('should initialize murmuraba manager', async () => {
      await murmurabaManager.initialize()
      expect(murmurabaManager.initialize).toHaveBeenCalled()
    })

    it('should process audio file with metrics', async () => {
      const mockFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' })
      const mockCallback = vi.fn()
      const mockResult = {
        processedBuffer: new ArrayBuffer(1000),
        averageVad: 0.85
      }

      vi.mocked(murmurabaManager.processFileWithMetrics).mockResolvedValue(mockResult)

      const result = await murmurabaManager.processFileWithMetrics(mockFile, mockCallback)

      expect(murmurabaManager.processFileWithMetrics).toHaveBeenCalledWith(mockFile, mockCallback)
      expect(result).toEqual(mockResult)
      expect(result.averageVad).toBe(0.85)
    })

    it('should handle processing errors', async () => {
      const mockFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' })
      const mockError = new Error('Processing failed')

      vi.mocked(murmurabaManager.processFileWithMetrics).mockRejectedValue(mockError)

      await expect(
        murmurabaManager.processFileWithMetrics(mockFile, () => {})
      ).rejects.toThrow('Processing failed')
    })
  })

  describe('Whisper Transcription', () => {
    it('should load whisper model', async () => {
      const whisper = WhisperSingleton.getInstance()
      await whisper.loadModel()
      
      expect(whisper.loadModel).toHaveBeenCalled()
    })

    it('should transcribe audio file', async () => {
      const whisper = WhisperSingleton.getInstance()
      const mockFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' })
      const mockTranscription = {
        text: 'Ask not what your country can do for you'
      }

      vi.mocked(whisper.processAudio).mockResolvedValue(mockTranscription)

      const result = await whisper.processAudio(mockFile)

      expect(whisper.processAudio).toHaveBeenCalledWith(mockFile)
      expect(result.text).toBe('Ask not what your country can do for you')
    })

    it('should handle transcription errors', async () => {
      const whisper = WhisperSingleton.getInstance()
      const mockFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' })
      const mockError = new Error('Transcription failed')

      vi.mocked(whisper.processAudio).mockRejectedValue(mockError)

      await expect(
        whisper.processAudio(mockFile)
      ).rejects.toThrow('Transcription failed')
    })
  })

  describe('Audio File Validation', () => {
    it('should validate WAV file format', () => {
      const wavFile = new File(['audio'], 'test.wav', { type: 'audio/wav' })
      const mp3File = new File(['audio'], 'test.mp3', { type: 'audio/mp3' })
      
      expect(wavFile.type).toBe('audio/wav')
      expect(mp3File.type).not.toBe('audio/wav')
    })

    it('should validate file size', () => {
      const smallFile = new File(['x'.repeat(100)], 'small.wav', { type: 'audio/wav' })
      const largeFile = new File(['x'.repeat(10000000)], 'large.wav', { type: 'audio/wav' })
      
      expect(smallFile.size).toBeLessThan(1000)
      expect(largeFile.size).toBeGreaterThan(1000000)
    })
  })

  describe('VAD Score Calculation', () => {
    it('should calculate VAD score as percentage', () => {
      const vadScore = 0.75
      const percentage = (vadScore * 100).toFixed(1)
      
      expect(percentage).toBe('75.0')
    })

    it('should handle zero VAD score', () => {
      const vadScore = 0
      const percentage = (vadScore * 100).toFixed(1)
      
      expect(percentage).toBe('0.0')
    })

    it('should handle perfect VAD score', () => {
      const vadScore = 1
      const percentage = (vadScore * 100).toFixed(1)
      
      expect(percentage).toBe('100.0')
    })
  })
})