import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AudioUploader } from '../../src/components/AudioUploader'
import { AudioPlayer } from '../../src/components/AudioPlayer'
import { TranscriptionResult } from '../../src/components/TranscriptionResult'
import { StatusMessage } from '../../src/components/StatusMessage'

describe('Component Tests', () => {
  describe('AudioUploader', () => {
    it('should render upload area and example button', () => {
      const mockFileSelect = vi.fn()
      const mockExampleClick = vi.fn()
      
      render(
        <AudioUploader 
          onFileSelect={mockFileSelect}
          onExampleClick={mockExampleClick}
        />
      )
      
      expect(screen.getByText('📁 Clic para seleccionar WAV')).toBeTruthy()
      expect(screen.getByText('📁 Usar ejemplo')).toBeTruthy()
    })

    it('should call onExampleClick when example button is clicked', () => {
      const mockFileSelect = vi.fn()
      const mockExampleClick = vi.fn()
      
      render(
        <AudioUploader 
          onFileSelect={mockFileSelect}
          onExampleClick={mockExampleClick}
        />
      )
      
      fireEvent.click(screen.getByText('📁 Usar ejemplo'))
      expect(mockExampleClick).toHaveBeenCalled()
    })

    it('should accept only WAV files', () => {
      const mockFileSelect = vi.fn()
      const mockExampleClick = vi.fn()
      
      render(
        <AudioUploader 
          onFileSelect={mockFileSelect}
          onExampleClick={mockExampleClick}
        />
      )
      
      const input = document.getElementById('file') as HTMLInputElement
      expect(input.accept).toBe('.wav')
    })
  })

  describe('AudioPlayer', () => {
    it('should render title and audio element', () => {
      render(
        <AudioPlayer 
          title="Test Audio" 
          audioUrl="test.wav"
        />
      )
      
      expect(screen.getByText('Test Audio')).toBeTruthy()
      expect(screen.getByRole('application')).toBeTruthy() // audio element
    })

    it('should display VAD score when provided', () => {
      render(
        <AudioPlayer 
          title="Test Audio" 
          audioUrl="test.wav"
          vadScore={0.85}
        />
      )
      
      expect(screen.getByText('VAD Score: 85.0%')).toBeTruthy()
    })

    it('should not display VAD score when not provided', () => {
      render(
        <AudioPlayer 
          title="Test Audio" 
          audioUrl="test.wav"
        />
      )
      
      expect(screen.queryByText(/VAD Score/)).toBeNull()
    })
  })

  describe('TranscriptionResult', () => {
    it('should render transcribe button', () => {
      const mockTranscribe = vi.fn()
      
      render(
        <TranscriptionResult
          transcript=""
          isTranscribing={false}
          onTranscribe={mockTranscribe}
        />
      )
      
      expect(screen.getByText('🎯 Transcribir')).toBeTruthy()
    })

    it('should show loading state when transcribing', () => {
      const mockTranscribe = vi.fn()
      
      render(
        <TranscriptionResult
          transcript=""
          isTranscribing={true}
          onTranscribe={mockTranscribe}
        />
      )
      
      expect(screen.getByText('⏳ Transcribiendo...')).toBeTruthy()
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should display transcript when available', () => {
      const mockTranscribe = vi.fn()
      const testTranscript = 'Test transcription text'
      
      render(
        <TranscriptionResult
          transcript={testTranscript}
          isTranscribing={false}
          onTranscribe={mockTranscribe}
        />
      )
      
      expect(screen.getByText(`"${testTranscript}"`)).toBeTruthy()
    })

    it('should call onTranscribe when button is clicked', () => {
      const mockTranscribe = vi.fn()
      
      render(
        <TranscriptionResult
          transcript=""
          isTranscribing={false}
          onTranscribe={mockTranscribe}
        />
      )
      
      fireEvent.click(screen.getByText('🎯 Transcribir'))
      expect(mockTranscribe).toHaveBeenCalled()
    })
  })

  describe('StatusMessage', () => {
    it('should not render when status is empty', () => {
      const { container } = render(<StatusMessage status="" />)
      expect(container.firstChild).toBeNull()
    })

    it('should render success status with green background', () => {
      render(<StatusMessage status="✅ Procesado" />)
      
      const message = screen.getByText('✅ Procesado')
      expect(message.style.background).toBe('rgb(232, 245, 233)')
    })

    it('should render error status with red background', () => {
      render(<StatusMessage status="Error: Something went wrong" />)
      
      const message = screen.getByText('Error: Something went wrong')
      expect(message.style.background).toBe('rgb(255, 235, 238)')
    })
  })
})