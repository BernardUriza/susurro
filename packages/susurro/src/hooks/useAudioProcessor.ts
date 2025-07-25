import { useState, useCallback, useRef } from 'react'
import { murmurabaManager } from '../lib/murmuraba-singleton'
import { AudioChunk } from '../lib/types'
import { useAudioWorklet } from './useAudioWorklet'

interface UseAudioProcessorOptions {
  chunkDurationMs?: number
  enableVAD?: boolean
}

interface UseAudioProcessorReturn {
  isRecording: boolean
  isPaused: boolean
  audioChunks: AudioChunk[]
  startRecording: () => Promise<void>
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  processAudioFile: (file: File) => Promise<void>
}

export function useAudioProcessor(options: UseAudioProcessorOptions = {}): UseAudioProcessorReturn {
  const { chunkDurationMs = 8000, enableVAD = true } = options
  
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([])
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const startTimeRef = useRef<number>(0)
  
  const { processAudioBuffer: processWithWorklet, initializeWorklet } = useAudioWorklet({
    rmsThreshold: 0.01,
    silenceThreshold: 0.005,
    maxSilenceDuration: 0.5,
    onStatusUpdate: (status) => {
      console.log('[AudioProcessor] Worklet status:', status)
    }
  })
  
  const createChunk = (blob: Blob, startTime: number, endTime: number): AudioChunk => ({
    id: `chunk-${Date.now()}-${Math.random()}`,
    blob,
    duration: endTime - startTime,
    startTime,
    endTime
  })
  
  const processAudioFile = useCallback(async (file: File) => {
    try {
      console.log('[AudioProcessor] Starting file processing...')
      
      // Step 1: Initialize Murmuraba
      await murmurabaManager.initialize()
      console.log('[AudioProcessor] Murmuraba initialized')
      
      // Step 2: Process with Murmuraba to clean audio
      console.log('[AudioProcessor] Processing with Murmuraba for audio cleaning...')
      const cleanedResult = await murmurabaManager.processFile(file, {
        enableAGC: true,
        enableNoiseSuppression: true,
        enableEchoCancellation: true,
        enableVAD: enableVAD
      })
      
      console.log('[AudioProcessor] Murmuraba processing complete, cleaned audio received')
      
      // Step 3: Initialize worklet for post-processing
      await initializeWorklet()
      
      // Step 4: Decode the cleaned audio
      const audioContext = new AudioContext()
      let audioBuffer: AudioBuffer
      
      if (cleanedResult.processedBuffer instanceof ArrayBuffer) {
        audioBuffer = await audioContext.decodeAudioData(cleanedResult.processedBuffer)
      } else if (cleanedResult.processedBuffer instanceof Blob) {
        const arrayBuffer = await cleanedResult.processedBuffer.arrayBuffer()
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      } else {
        // If it's already an AudioBuffer
        audioBuffer = cleanedResult.processedBuffer
      }
      
      console.log('[AudioProcessor] Cleaned audio decoded, duration:', audioBuffer.duration, 'seconds')
      
      // Step 5: Process cleaned audio through worklet
      const processedBuffer = await processWithWorklet(audioBuffer)
      console.log('[AudioProcessor] Worklet processing complete')
      
      // Step 6: Create chunks from processed audio
      const duration = processedBuffer.duration * 1000 // Convert to ms
      const chunks: AudioChunk[] = []
      const chunkCount = Math.ceil(duration / chunkDurationMs)
      
      for (let i = 0; i < chunkCount; i++) {
        const startTime = i * chunkDurationMs
        const endTime = Math.min((i + 1) * chunkDurationMs, duration)
        
        const startSample = Math.floor((startTime / 1000) * processedBuffer.sampleRate)
        const endSample = Math.floor((endTime / 1000) * processedBuffer.sampleRate)
        const frameCount = endSample - startSample
        
        const chunkBuffer = audioContext.createBuffer(
          processedBuffer.numberOfChannels,
          frameCount,
          processedBuffer.sampleRate
        )
        
        for (let channel = 0; channel < processedBuffer.numberOfChannels; channel++) {
          const channelData = processedBuffer.getChannelData(channel)
          const chunkChannelData = chunkBuffer.getChannelData(channel)
          for (let j = 0; j < frameCount; j++) {
            chunkChannelData[j] = channelData[startSample + j]
          }
        }
        
        const wavBlob = await audioBufferToWav(chunkBuffer)
        chunks.push(createChunk(wavBlob, startTime, endTime))
      }
      
      console.log('[AudioProcessor] Created', chunks.length, 'chunks for transcription')
      setAudioChunks(chunks)
      audioContext.close()
    } catch (error) {
      console.error('Error processing audio file:', error)
      throw error
    }
  }, [chunkDurationMs, enableVAD, processWithWorklet, initializeWorklet])
  
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const audioFile = new File([blob], 'recording.webm', { type: 'audio/webm' })
        await processAudioFile(audioFile)
      }
      
      mediaRecorderRef.current = mediaRecorder
      startTimeRef.current = Date.now()
      mediaRecorder.start(chunkDurationMs)
      setIsRecording(true)
      setAudioChunks([])
    } catch (error) {
      console.error('Error starting recording:', error)
      throw error
    }
  }, [chunkDurationMs, processAudioFile])
  
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      setIsRecording(false)
      setIsPaused(false)
    }
  }, [isRecording])
  
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
    }
  }, [isRecording, isPaused])
  
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
    }
  }, [isRecording, isPaused])
  
  return {
    isRecording,
    isPaused,
    audioChunks,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    processAudioFile
  }
}

// Helper function to convert AudioBuffer to WAV
async function audioBufferToWav(audioBuffer: AudioBuffer): Promise<Blob> {
  const length = audioBuffer.length * audioBuffer.numberOfChannels * 2
  const buffer = new ArrayBuffer(44 + length)
  const view = new DataView(buffer)
  
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }
  
  const floatTo16BitPCM = (output: DataView, offset: number, input: Float32Array) => {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]))
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    }
  }
  
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + length, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, audioBuffer.numberOfChannels, true)
  view.setUint32(24, audioBuffer.sampleRate, true)
  view.setUint32(28, audioBuffer.sampleRate * audioBuffer.numberOfChannels * 2, true)
  view.setUint16(32, audioBuffer.numberOfChannels * 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, length, true)
  
  const offset = 44
  const interleaved = new Float32Array(audioBuffer.length * audioBuffer.numberOfChannels)
  
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel)
    for (let i = 0; i < channelData.length; i++) {
      interleaved[i * audioBuffer.numberOfChannels + channel] = channelData[i]
    }
  }
  
  floatTo16BitPCM(view, offset, interleaved)
  
  return new Blob([buffer], { type: 'audio/wav' })
}