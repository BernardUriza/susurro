'use client'

import { useState, useRef } from 'react'
import { initializeAudioEngine, processStreamChunked } from 'murmuraba'
import type { MurmubaraChunk } from 'murmuraba'

interface AudioState {
  original: string | null
  enhanced: string | null
  isProcessing: boolean
  transcription: string
}

export function AudioComparison() {
  const [audioState, setAudioState] = useState<AudioState>({
    original: null,
    enhanced: null,
    isProcessing: false,
    transcription: ''
  })
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setAudioState(prev => ({ ...prev, isProcessing: true }))

    try {
      await initializeAudioEngine()
      
      const originalUrl = URL.createObjectURL(file)
      setAudioState(prev => ({ ...prev, original: originalUrl }))

      const audioContext = new AudioContext()
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      )
      
      const source = offlineContext.createBufferSource()
      source.buffer = audioBuffer
      
      const mediaStreamDestination = audioContext.createMediaStreamDestination()
      const chunks: MurmubaraChunk[] = []
      
      await processStreamChunked(
        mediaStreamDestination.stream,
        (chunk) => chunks.push(chunk),
        { chunkDuration: 8000, reductionLevel: 'high' }
      )
      
      source.connect(offlineContext.destination)
      source.start(0)
      
      const enhancedBuffer = await offlineContext.startRendering()
      const enhancedBlob = await bufferToWave(enhancedBuffer)
      const enhancedUrl = URL.createObjectURL(enhancedBlob)
      
      const transcription = await processTranscription(file)
      
      setAudioState({
        original: originalUrl,
        enhanced: enhancedUrl,
        isProcessing: false,
        transcription
      })
    } catch (error) {
      console.error('Error processing audio:', error)
      setAudioState(prev => ({ ...prev, isProcessing: false }))
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Comparación de Audio</h1>
        
        {!audioState.original ? (
          <div className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center">
            <p className="mb-4">Arrastra un archivo de audio o haz clic para seleccionar</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
              aria-label="Seleccionar archivo"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg"
            >
              Seleccionar archivo
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {audioState.isProcessing && (
              <div className="bg-yellow-900 p-4 rounded-lg">
                <p>Procesando audio...</p>
              </div>
            )}
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">Audio Original</h2>
                <audio 
                  controls 
                  src={audioState.original} 
                  className="w-full"
                  role="audio"
                />
              </div>
              
              <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">Audio Mejorado</h2>
                {audioState.enhanced ? (
                  <audio 
                    controls 
                    src={audioState.enhanced} 
                    className="w-full"
                    role="audio"
                  />
                ) : (
                  <div className="h-12 bg-gray-700 rounded animate-pulse" />
                )}
              </div>
            </div>
            
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Transcripción</h2>
              <div className="bg-gray-900 p-4 rounded">
                {audioState.transcription || 'Procesando transcripción...'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

async function bufferToWave(buffer: AudioBuffer): Promise<Blob> {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44
  const arrayBuffer = new ArrayBuffer(length)
  const view = new DataView(arrayBuffer)
  const channels: Float32Array[] = []
  
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i))
  }
  
  let offset = 0
  const writeString = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
    offset += str.length
  }
  
  writeString('RIFF')
  view.setUint32(offset, length - 8, true)
  offset += 4
  writeString('WAVE')
  writeString('fmt ')
  view.setUint32(offset, 16, true)
  offset += 4
  view.setUint16(offset, 1, true)
  offset += 2
  view.setUint16(offset, buffer.numberOfChannels, true)
  offset += 2
  view.setUint32(offset, buffer.sampleRate, true)
  offset += 4
  view.setUint32(offset, buffer.sampleRate * 2 * buffer.numberOfChannels, true)
  offset += 4
  view.setUint16(offset, buffer.numberOfChannels * 2, true)
  offset += 2
  view.setUint16(offset, 16, true)
  offset += 2
  writeString('data')
  view.setUint32(offset, length - offset - 4, true)
  offset += 4
  
  const interleaved = new Float32Array(buffer.length * buffer.numberOfChannels)
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      interleaved[i * buffer.numberOfChannels + channel] = channels[channel][i]
    }
  }
  
  for (let i = 0; i < interleaved.length; i++) {
    view.setInt16(offset, interleaved[i] * 0x7FFF, true)
    offset += 2
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

async function processTranscription(file: File): Promise<string> {
  // Integrate with existing Whisper API
  const formData = new FormData()
  formData.append('audio', file)
  
  try {
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) throw new Error('Transcription failed')
    
    const data = await response.json()
    return data.transcription
  } catch (error) {
    console.error('Transcription error:', error)
    return 'Error al transcribir el audio'
  }
}