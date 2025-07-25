import { useCallback, useEffect, useRef, useState } from 'react';

interface AudioWorkletConfig {
  rmsThreshold?: number;
  silenceThreshold?: number;
  maxSilenceDuration?: number;
  onAudioChunk?: (data: AudioChunkData) => void;
  onStatusUpdate?: (status: AudioStatus) => void;
}

interface AudioChunkData {
  data: Float32Array;
  rms: number;
  timestamp: number;
  isSilent: boolean;
}

interface AudioStatus {
  rms: number;
  silenceDuration: number;
  isActive: boolean;
}

export function useAudioWorklet(config: AudioWorkletConfig = {}) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const initializeWorklet = useCallback(async () => {
    try {
      console.log('[AudioWorklet] Initializing audio worklet...');
      
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      // Load and add worklet module
      await audioContext.audioWorklet.addModule('/audio-processor.worklet.js');
      
      // Create worklet node
      const workletNode = new AudioWorkletNode(audioContext, 'audio-processor-worklet');
      workletNodeRef.current = workletNode;
      
      // Set up message handling
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio-chunk' && config.onAudioChunk) {
          config.onAudioChunk(event.data);
        } else if (event.data.type === 'status' && config.onStatusUpdate) {
          config.onStatusUpdate(event.data);
        }
      };
      
      // Send configuration to worklet
      if (config.rmsThreshold || config.silenceThreshold || config.maxSilenceDuration) {
        workletNode.port.postMessage({
          type: 'config',
          rmsThreshold: config.rmsThreshold,
          silenceThreshold: config.silenceThreshold,
          maxSilenceDuration: config.maxSilenceDuration
        });
      }
      
      console.log('[AudioWorklet] Audio worklet initialized successfully');
      setIsInitialized(true);
    } catch (err) {
      console.error('[AudioWorklet] Failed to initialize:', err);
      setError(err instanceof Error ? err : new Error('Failed to initialize audio worklet'));
    }
  }, [config]);
  
  const processAudioBuffer = useCallback(async (audioBuffer: AudioBuffer): Promise<AudioBuffer> => {
    if (!audioContextRef.current || !workletNodeRef.current) {
      throw new Error('Audio worklet not initialized');
    }
    
    const audioContext = audioContextRef.current;
    const workletNode = workletNodeRef.current;
    
    // Create offline context for processing
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    // Create buffer source
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    
    // Create script processor to capture output
    const scriptNode = offlineContext.createScriptProcessor(4096, 1, 1);
    const outputBuffer = new Float32Array(audioBuffer.length);
    let outputIndex = 0;
    
    scriptNode.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      outputBuffer.set(inputData, outputIndex);
      outputIndex += inputData.length;
    };
    
    // Connect nodes
    source.connect(scriptNode);
    scriptNode.connect(offlineContext.destination);
    
    // Start processing
    source.start();
    workletNode.port.postMessage({ type: 'start' });
    
    // Render offline
    const renderedBuffer = await offlineContext.startRendering();
    
    // Stop processing
    workletNode.port.postMessage({ type: 'stop' });
    
    return renderedBuffer;
  }, []);
  
  const startProcessing = useCallback(async (stream: MediaStream) => {
    if (!audioContextRef.current || !workletNodeRef.current) {
      await initializeWorklet();
    }
    
    const audioContext = audioContextRef.current!;
    const workletNode = workletNodeRef.current!;
    
    // Create source from stream
    const source = audioContext.createMediaStreamSource(stream);
    sourceNodeRef.current = source;
    
    // Connect source -> worklet -> destination
    source.connect(workletNode);
    workletNode.connect(audioContext.destination);
    
    // Start processing
    workletNode.port.postMessage({ type: 'start' });
    setIsProcessing(true);
    
    console.log('[AudioWorklet] Started processing audio stream');
  }, [initializeWorklet]);
  
  const stopProcessing = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ type: 'stop' });
    }
    
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    
    setIsProcessing(false);
    console.log('[AudioWorklet] Stopped processing audio stream');
  }, []);
  
  const cleanup = useCallback(() => {
    stopProcessing();
    
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsInitialized(false);
  }, [stopProcessing]);
  
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  
  return {
    isInitialized,
    isProcessing,
    error,
    initializeWorklet,
    processAudioBuffer,
    startProcessing,
    stopProcessing,
    cleanup
  };
}