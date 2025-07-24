import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AudioComparison } from '../components/AudioComparison'

describe('AudioComparison Component', () => {
  const mockFile = new File(['audio data'], 'test.mp3', { type: 'audio/mp3' })
  
  beforeEach(() => {
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = jest.fn()
  })

  it('renders upload area initially', () => {
    render(<AudioComparison />)
    expect(screen.getByText(/arrastra un archivo de audio/i)).toBeInTheDocument()
  })

  it('accepts audio file upload', async () => {
    render(<AudioComparison />)
    const input = screen.getByLabelText(/seleccionar archivo/i)
    
    fireEvent.change(input, { target: { files: [mockFile] } })
    
    await waitFor(() => {
      expect(screen.getByText(/audio original/i)).toBeInTheDocument()
      expect(screen.getByText(/audio mejorado/i)).toBeInTheDocument()
    })
  })

  it('shows dual audio players after upload', async () => {
    render(<AudioComparison />)
    const input = screen.getByLabelText(/seleccionar archivo/i)
    
    fireEvent.change(input, { target: { files: [mockFile] } })
    
    await waitFor(() => {
      const audioElements = screen.getAllByRole('audio')
      expect(audioElements).toHaveLength(2)
    })
  })

  it('displays transcription section', async () => {
    render(<AudioComparison />)
    const input = screen.getByLabelText(/seleccionar archivo/i)
    
    fireEvent.change(input, { target: { files: [mockFile] } })
    
    await waitFor(() => {
      expect(screen.getByText(/transcripción/i)).toBeInTheDocument()
    })
  })

  it('shows processing status during enhancement', async () => {
    render(<AudioComparison />)
    const input = screen.getByLabelText(/seleccionar archivo/i)
    
    fireEvent.change(input, { target: { files: [mockFile] } })
    
    await waitFor(() => {
      expect(screen.getByText(/procesando audio/i)).toBeInTheDocument()
    })
  })
})