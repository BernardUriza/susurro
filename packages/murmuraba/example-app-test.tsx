import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import React from 'react'

// Example of how to test a React app using murmuraba components
import { 
  AudioPlayer,
  WaveformAnalyzer,
  ChunkProcessingResults,
  ErrorBoundary,
  BuildInfo,
  AdvancedMetricsPanel
} from 'murmuraba'

// Example App component using murmuraba
const ExampleApp = () => {
  const [engineStatus, setEngineStatus] = React.useState('uninitialized')
  const [audioFile, setAudioFile] = React.useState<File | null>(null)
  const [processedAudio, setProcessedAudio] = React.useState<ArrayBuffer | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Mock audio processing
  const processAudio = async (file: File) => {
    try {
      setEngineStatus('processing')
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 1000))
      setProcessedAudio(new ArrayBuffer(1000))
      setEngineStatus('ready')
    } catch (err) {
      setError(err.message)
      setEngineStatus('error')
    }
  }

  return (
    <ErrorBoundary>
      <div className="app">
        <h1>Murmuraba Audio Processor</h1>
        
        <BuildInfo />
        
        <div data-testid="engine-status" className={`status ${engineStatus}`}>
          Engine Status: {engineStatus}
        </div>
        
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
          aria-label="Upload audio file"
        />
        
        <button
          onClick={() => audioFile && processAudio(audioFile)}
          disabled={!audioFile || engineStatus === 'processing'}
        >
          Process Audio
        </button>
        
        {error && <div className="error">{error}</div>}
        
        {processedAudio && (
          <>
            <AudioPlayer
              audioBuffer={processedAudio}
              onError={setError}
            />
            
            <WaveformAnalyzer
              audioData={processedAudio}
              sampleRate={48000}
            />
            
            <ChunkProcessingResults
              chunks={[]}
              metadata={{
                totalChunks: 10,
                processedChunks: 10,
                totalDuration: 30,
                sampleRate: 48000
              }}
            />
            
            <AdvancedMetricsPanel
              metrics={{
                processingTime: 1234,
                compressionRatio: 0.75,
                noiseReduction: 15.5
              }}
            />
          </>
        )}
      </div>
    </ErrorBoundary>
  )
}

describe('React App with Murmuraba Integration', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    // Mock browser APIs
    global.AudioContext = vi.fn().mockImplementation(() => ({
      state: 'running',
      sampleRate: 48000,
      createGain: vi.fn(() => ({ connect: vi.fn() })),
      createScriptProcessor: vi.fn(() => ({ 
        connect: vi.fn(),
        onaudioprocess: null
      })),
      destination: {}
    }))

    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()
    
    // Mock fetch for WASM
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('rnnoise.wasm')) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000))
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      })
    })
  })

  describe('Initial Render Health Checks', () => {
    it('should render without errors', () => {
      const consoleSpy = vi.spyOn(console, 'error')
      render(<ExampleApp />)
      
      expect(screen.getByText('Murmuraba Audio Processor')).toBeInTheDocument()
      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should display initial engine status', () => {
      render(<ExampleApp />)
      
      const status = screen.getByTestId('engine-status')
      expect(status).toHaveTextContent('Engine Status: uninitialized')
    })

    it('should render BuildInfo component', () => {
      render(<ExampleApp />)
      
      // BuildInfo should display version info
      expect(screen.getByText(/version/i)).toBeInTheDocument()
    })
  })

  describe('File Upload and Processing', () => {
    it('should handle file upload', async () => {
      render(<ExampleApp />)
      
      const file = new File(['audio content'], 'test.wav', { type: 'audio/wav' })
      const input = screen.getByLabelText('Upload audio file')
      
      await user.upload(input, file)
      
      // Process button should be enabled
      const processButton = screen.getByText('Process Audio')
      expect(processButton).not.toBeDisabled()
    })

    it('should process audio file', async () => {
      render(<ExampleApp />)
      
      // Upload file
      const file = new File(['audio content'], 'test.wav', { type: 'audio/wav' })
      const input = screen.getByLabelText('Upload audio file')
      await user.upload(input, file)
      
      // Click process
      const processButton = screen.getByText('Process Audio')
      await user.click(processButton)
      
      // Should show processing state
      expect(screen.getByTestId('engine-status')).toHaveTextContent('processing')
      
      // Wait for completion
      await waitFor(() => {
        expect(screen.getByTestId('engine-status')).toHaveTextContent('ready')
      })
      
      // Should render audio components
      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
    })
  })

  describe('Component Integration', () => {
    it('should render AudioPlayer after processing', async () => {
      render(<ExampleApp />)
      
      // Quick process
      const file = new File(['audio'], 'test.wav', { type: 'audio/wav' })
      await user.upload(screen.getByLabelText('Upload audio file'), file)
      await user.click(screen.getByText('Process Audio'))
      
      await waitFor(() => {
        // AudioPlayer should be rendered
        expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
      })
    })

    it('should render WaveformAnalyzer with processed audio', async () => {
      render(<ExampleApp />)
      
      const file = new File(['audio'], 'test.wav', { type: 'audio/wav' })
      await user.upload(screen.getByLabelText('Upload audio file'), file)
      await user.click(screen.getByText('Process Audio'))
      
      await waitFor(() => {
        // WaveformAnalyzer canvas should be rendered
        expect(screen.getByRole('img', { name: /waveform/i })).toBeInTheDocument()
      })
    })

    it('should display processing metrics', async () => {
      render(<ExampleApp />)
      
      const file = new File(['audio'], 'test.wav', { type: 'audio/wav' })
      await user.upload(screen.getByLabelText('Upload audio file'), file)
      await user.click(screen.getByText('Process Audio'))
      
      await waitFor(() => {
        // Metrics should be displayed
        expect(screen.getByText(/processing time/i)).toBeInTheDocument()
        expect(screen.getByText(/compression ratio/i)).toBeInTheDocument()
        expect(screen.getByText(/noise reduction/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      // Mock processing error
      const { rerender } = render(<ExampleApp />)
      
      // Trigger an error by simulating failed processing
      const errorMessage = 'Failed to process audio'
      
      // You would typically trigger this through user interaction
      // For this example, we'll check error boundary behavior
      const ThrowError = () => {
        throw new Error(errorMessage)
      }
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      rerender(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      )
      
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
      consoleSpy.mockRestore()
    })
  })

  describe('Performance and Memory', () => {
    it('should clean up resources on unmount', async () => {
      const { unmount } = render(<ExampleApp />)
      
      // Process audio
      const file = new File(['audio'], 'test.wav', { type: 'audio/wav' })
      await user.upload(screen.getByLabelText('Upload audio file'), file)
      await user.click(screen.getByText('Process Audio'))
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
      })
      
      // Track URL creation
      const createCalls = (URL.createObjectURL as any).mock.calls.length
      
      unmount()
      
      // Should revoke created URLs
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(createCalls)
    })

    it('should not have memory leaks with repeated processing', async () => {
      render(<ExampleApp />)
      
      const file = new File(['audio'], 'test.wav', { type: 'audio/wav' })
      
      // Process multiple times
      for (let i = 0; i < 3; i++) {
        await user.upload(screen.getByLabelText('Upload audio file'), file)
        await user.click(screen.getByText('Process Audio'))
        
        await waitFor(() => {
          expect(screen.getByTestId('engine-status')).toHaveTextContent('ready')
        })
      }
      
      // Should handle multiple processes without issues
      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
    })
  })
})

// Browser-specific tests
describe('Browser Compatibility Checks', () => {
  it('should handle missing AudioWorklet gracefully', () => {
    const originalAudioWorklet = (window as any).AudioWorklet
    delete (window as any).AudioWorklet
    
    render(<ExampleApp />)
    
    // Should still render without crashing
    expect(screen.getByText('Murmuraba Audio Processor')).toBeInTheDocument()
    
    // Restore
    (window as any).AudioWorklet = originalAudioWorklet
  })

  it('should handle AudioContext autoplay restrictions', async () => {
    const mockContext = {
      state: 'suspended',
      resume: vi.fn().mockResolvedValue(undefined),
      sampleRate: 48000,
      createGain: vi.fn(() => ({ connect: vi.fn() })),
      destination: {}
    }
    
    global.AudioContext = vi.fn(() => mockContext)
    
    render(<ExampleApp />)
    
    // User interaction should resume context
    await user.click(screen.getByText('Process Audio'))
    
    expect(mockContext.resume).toHaveBeenCalled()
  })
})