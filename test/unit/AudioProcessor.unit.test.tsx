import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import AudioProcessor from '../../src/components/AudioProcessor'

vi.mock('murmuraba', () => ({
  isInitialized: false,
  initializeAudioEngine: vi.fn(),
  processFile: vi.fn()
}))

describe('AudioProcessor Unit Tests', () => {
  const mockOnProcessedAudio = vi.fn()
  const mockFile = new File(['audio data'], 'test.wav', { 
    type: 'audio/wav',
    lastModified: Date.now()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('debe cargar murmuraba correctamente', async () => {
    const { container } = render(
      <AudioProcessor 
        onProcessedAudio={mockOnProcessedAudio} 
        uploadedFile={null} 
      />
    )
    
    await waitFor(() => {
      expect(container.textContent).not.toContain('Error loading audio processor')
    })
  })

  it('debe procesar archivo cuando se proporciona uploadedFile', async () => {
    const murmuraba = await import('murmuraba')
    const processedBlob = new Blob(['processed'], { type: 'audio/wav' })
    
    vi.mocked(murmuraba.processFile).mockResolvedValue({
      processedAudio: processedBlob,
      vadScores: [0.8, 0.9, 0.7]
    })

    render(
      <AudioProcessor 
        onProcessedAudio={mockOnProcessedAudio} 
        uploadedFile={mockFile} 
      />
    )

    await waitFor(() => {
      expect(murmuraba.initializeAudioEngine).toHaveBeenCalledWith({
        enableAGC: true,
        enableNoiseSuppression: true,
        enableEchoCancellation: true
      })
    })

    await waitFor(() => {
      expect(murmuraba.processFile).toHaveBeenCalledWith(mockFile, {
        outputFormat: 'blob',
        enableTranscription: false
      })
    })

    await waitFor(() => {
      expect(mockOnProcessedAudio).toHaveBeenCalledWith(processedBlob)
    })
  })

  it('debe usar archivo original si processFile falla', async () => {
    const murmuraba = await import('murmuraba')
    vi.mocked(murmuraba.processFile).mockRejectedValue(new Error('Processing failed'))

    render(
      <AudioProcessor 
        onProcessedAudio={mockOnProcessedAudio} 
        uploadedFile={mockFile} 
      />
    )

    await waitFor(() => {
      expect(mockOnProcessedAudio).toHaveBeenCalledWith(mockFile)
    })
  })

  it('no debe reprocesar el mismo archivo', async () => {
    const murmuraba = await import('murmuraba')
    const { rerender } = render(
      <AudioProcessor 
        onProcessedAudio={mockOnProcessedAudio} 
        uploadedFile={mockFile} 
      />
    )

    await waitFor(() => {
      expect(murmuraba.processFile).toHaveBeenCalledTimes(1)
    })

    rerender(
      <AudioProcessor 
        onProcessedAudio={mockOnProcessedAudio} 
        uploadedFile={mockFile} 
      />
    )

    await waitFor(() => {
      expect(murmuraba.processFile).toHaveBeenCalledTimes(1)
    })
  })
})