import { renderHook, act } from '@testing-library/react-hooks'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSusurro } from '../src/useSusurro'

// Mock dependencies
vi.mock('murmuraba', () => ({
  default: {
    processFileWithMetrics: vi.fn()
  }
}))

vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn()
}))

describe('useSusurro - Pipeline Explícito', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('cleanAudio', () => {
    it('debe procesar archivo y retornar blob + vadScore', async () => {
      const { result } = renderHook(() => useSusurro())
      const mockFile = new File(['audio'], 'test.wav', { type: 'audio/wav' })
      
      let cleanResult: any
      await act(async () => {
        cleanResult = await result.current.cleanAudio(mockFile)
      })
      
      expect(cleanResult).toHaveProperty('blob')
      expect(cleanResult).toHaveProperty('vadScore')
      expect(cleanResult.blob).toBeInstanceOf(Blob)
      expect(typeof cleanResult.vadScore).toBe('number')
    })

    it('debe cambiar estado cleaning mientras procesa', async () => {
      const { result } = renderHook(() => useSusurro())
      const mockFile = new File(['audio'], 'test.wav', { type: 'audio/wav' })
      
      expect(result.current.cleaning).toBe(false)
      
      const promise = act(async () => {
        await result.current.cleanAudio(mockFile)
      })
      
      expect(result.current.cleaning).toBe(true)
      await promise
      expect(result.current.cleaning).toBe(false)
    })

    it('debe manejar errores en procesamiento', async () => {
      const { result } = renderHook(() => useSusurro())
      const mockFile = new File([''], 'invalid.wav', { type: 'audio/wav' })
      
      await act(async () => {
        await expect(result.current.cleanAudio(mockFile)).rejects.toThrow()
      })
      
      expect(result.current.error).toBeTruthy()
      expect(result.current.cleaning).toBe(false)
    })
  })

  describe('transcribe', () => {
    it('debe transcribir blob y retornar texto', async () => {
      const { result } = renderHook(() => useSusurro())
      const mockBlob = new Blob(['audio'], { type: 'audio/wav' })
      
      let transcript: string = ''
      await act(async () => {
        transcript = await result.current.transcribe(mockBlob)
      })
      
      expect(typeof transcript).toBe('string')
      expect(transcript.length).toBeGreaterThan(0)
    })

    it('debe cambiar estado transcribing mientras procesa', async () => {
      const { result } = renderHook(() => useSusurro())
      const mockBlob = new Blob(['audio'], { type: 'audio/wav' })
      
      expect(result.current.transcribing).toBe(false)
      
      const promise = act(async () => {
        await result.current.transcribe(mockBlob)
      })
      
      expect(result.current.transcribing).toBe(true)
      await promise
      expect(result.current.transcribing).toBe(false)
    })

    it('debe manejar errores en transcripción', async () => {
      const { result } = renderHook(() => useSusurro())
      const mockBlob = new Blob([], { type: 'audio/wav' })
      
      await act(async () => {
        await expect(result.current.transcribe(mockBlob)).rejects.toThrow()
      })
      
      expect(result.current.error).toBeTruthy()
      expect(result.current.transcribing).toBe(false)
    })
  })

  describe('pipeline completo', () => {
    it('debe procesar archivo y transcribir en secuencia', async () => {
      const { result } = renderHook(() => useSusurro())
      const mockFile = new File(['audio'], 'test.wav', { type: 'audio/wav' })
      
      let cleanResult: any
      let transcript: string = ''
      
      await act(async () => {
        cleanResult = await result.current.cleanAudio(mockFile)
        transcript = await result.current.transcribe(cleanResult.blob)
      })
      
      expect(cleanResult.vadScore).toBeGreaterThanOrEqual(0)
      expect(cleanResult.vadScore).toBeLessThanOrEqual(1)
      expect(transcript).toBeTruthy()
    })
  })
})