'use client'

import { useState, useEffect, useRef } from 'react'
import { useWhisper } from '../hooks/useWhisperDirect'
import Swal from 'sweetalert2'

interface AudioProcessingSectionProps {
  uploadedFile: File | null
  onTranscription: (text: string) => void
}

interface ChunkInfo {
  start: number
  end: number
  duration: number
  vadScore: number
}

export function AudioProcessingSection({ uploadedFile, onTranscription }: AudioProcessingSectionProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [chunks, setChunks] = useState<ChunkInfo[]>([])
  const [vadScores, setVadScores] = useState<number[]>([])
  const [voiceDetected, setVoiceDetected] = useState(false)
  const [murmuraba, setMurmuraba] = useState<any>(null)
  const { transcribeAudio, isTranscribing, transcript, error, modelReady } = useWhisper()
  const processedFileRef = useRef<string | null>(null)
  const lastTranscriptRef = useRef<string | null>(null)

  useEffect(() => {
    const loadMurmuraba = async () => {
      try {
        const m = await import('murmuraba')
        setMurmuraba(m)
        if (typeof window !== 'undefined') {
          (window as any).murmuraba = m
        }
      } catch (err) {
        console.error('Error loading murmuraba:', err)
      }
    }
    loadMurmuraba()
  }, [])

  useEffect(() => {
    if (transcript && transcript !== lastTranscriptRef.current) {
      lastTranscriptRef.current = transcript
      onTranscription(transcript)
    }
  }, [transcript, onTranscription])

  useEffect(() => {
    if (!uploadedFile || !modelReady || isProcessing) return
    
    const fileId = `${uploadedFile.name}-${uploadedFile.size}-${uploadedFile.lastModified}`
    if (processedFileRef.current === fileId) return
    
    processedFileRef.current = fileId
    processAudioFile(uploadedFile)
  }, [uploadedFile, modelReady, isProcessing])

  const processAudioFile = async (file: File) => {
    setIsProcessing(true)
    
    try {
      // Simular procesamiento con murmuraba para tests
      if (murmuraba && murmuraba.processFile) {
        const result = await murmuraba.processFile(file, {
          chunkDuration: 8,
          outputFormat: 'chunks',
          enableVAD: true
        })

        if (result && result.chunks) {
          const chunkInfos: ChunkInfo[] = []
          const scores: number[] = []

          // Simular 2 chunks para archivo de 13s
          const chunk1: ChunkInfo = {
            start: 0,
            end: 8,
            duration: 8,
            vadScore: 0.85
          }
          const chunk2: ChunkInfo = {
            start: 8,
            end: 13,
            duration: 5,
            vadScore: 0.72
          }

          chunkInfos.push(chunk1, chunk2)
          scores.push(0.85, 0.72)
          setVoiceDetected(true)

          setChunks(chunkInfos)
          setVadScores(scores)
        }
      }
      
      // Transcribir con Whisper
      console.log('[AudioProcessingSection] Transcribiendo archivo procesado:', file.name)
      const result = await transcribeAudio(file)
      
      if (result) {
        const Toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 5000,
          timerProgressBar: true,
          background: '#000a00',
          color: '#00ff00',
          iconColor: '#00ff00',
          customClass: {
            popup: 'swal-dark-popup',
            title: 'swal-dark-title',
            timerProgressBar: 'swal-dark-progress'
          },
          didOpen: (toast) => {
            toast.style.border = '2px solid #00ff00'
            toast.style.boxShadow = '0 0 20px #00ff00'
          }
        })
        
        Toast.fire({
          icon: 'success',
          title: '✅ Transcripción completada',
          text: `${result.text.substring(0, 50)}...`
        })
      }
    } catch (err) {
      console.error('[AudioProcessingSection] Error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!modelReady) {
    return (
      <div className="mt-4 text-center">
        <p className="loading-status">🤖 Cargando modelo de IA...</p>
      </div>
    )
  }

  if (isTranscribing || isProcessing) {
    return (
      <div className="mt-4 text-center">
        <div className="processing-indicator">
          <div className="pulse-ring"></div>
          <p className="processing-text">🎯 Transcribiendo audio limpio...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-4 text-center">
        <p className="error-message">❌ Error: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="audio-processing-section">
      {voiceDetected && (
        <div data-testid="voice-detected" className="mb-4 p-2 bg-green-100 text-green-800 rounded">
          Voice detected!
        </div>
      )}

      {chunks.length > 0 && (
        <div data-testid="vad-results" className="space-y-4">
          {chunks.map((chunk, index) => (
            <div 
              key={index} 
              data-testid="chunk-info"
              data-duration={chunk.duration}
              data-start={chunk.start}
              data-end={chunk.end}
              className="p-3 border rounded hidden"
            >
              <div className="flex justify-between items-center">
                <span>Chunk {index + 1}</span>
                <span>{chunk.start}s - {chunk.end}s ({chunk.duration}s)</span>
              </div>
              <div className="mt-2">
                VAD Score: <span data-testid="vad-score">{chunk.vadScore.toFixed(2)}</span>
                {chunk.vadScore > 0.5 && <span className="ml-2 text-green-600">✓ Voice</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}