# Plan de Refactorización: useSusurro Hook Consolidado

## Problema Actual
- `whisper-matrix-terminal.tsx` está llamando directamente a `murmuraba` 
- Violación de la arquitectura: los componentes NO deben usar murmuraba directamente
- `useSusurro` debe ser el único punto de acceso para toda la funcionalidad de audio

## Objetivo
Refactorizar `useSusurro` para que contenga TODOS los métodos de audio que necesita `whisper-matrix-terminal`, eliminando las llamadas directas a murmuraba.

## Arquitectura Target

```
whisper-matrix-terminal.tsx
         ↓ (solo usa)
    useSusurro hook
         ↓ (maneja)
  [useWhisperDirect + murmuraba internamente]
```

## Métodos que useSusurro debe exponer

### 1. Audio Engine Management & Transcription
```typescript
interface UseSusurroReturn {
  // Métodos existentes...
  
  // Audio engine
  initializeAudioEngine: (config?: AudioEngineConfig) => Promise<void>;
  isEngineInitialized: boolean;
  engineError: string | null;
  
  // MÉTODO PRINCIPAL PARA ARCHIVOS - TODO en uno
  processAndTranscribeFile: (file: File) => Promise<CompleteAudioResult>;
  
  // MÉTODO PARA RECORDING - Retorna chunks
  startRecording: (config?: RecordingConfig) => Promise<void>;
  stopRecording: () => Promise<SusurroChunk[]>;
  isRecording: boolean;
  
  // Métodos auxiliares (internos, pueden no exponerse)
  analyzeVAD: (buffer: ArrayBuffer) => Promise<VADAnalysisResult>;
  convertBlobToBuffer: (blob: Blob) => Promise<ArrayBuffer>;
}
```

### 2. Tipos de Datos Necesarios
```typescript
interface AudioEngineConfig {
  enableVAD?: boolean;
  enableNoiseSuppression?: boolean;
  enableEchoCancellation?: boolean;
  vadThreshold?: number;
}

// RESULTADO COMPLETO PARA ARCHIVOS - TODO incluido
interface CompleteAudioResult {
  // Audio URLs para descarga/reproducción
  originalAudioUrl: string;        // URL del archivo original
  processedAudioUrl: string;       // URL del audio procesado (con noise reduction)
  
  // Transcripción
  transcriptionText: string;       // Texto transcrito por Whisper
  transcriptionSegments?: TranscriptionSegment[];
  
  // Métricas y análisis
  vadAnalysis: VADAnalysisResult;  // Análisis completo de VAD
  
  // Metadata
  metadata: AudioMetadata;
  processingTime: number;          // Tiempo total de procesamiento (ms)
}

// RESULTADO PARA RECORDING - Chunks de Susurro
interface SusurroChunk {
  id: string;
  audioBlob: Blob;                 // Audio chunk
  transcriptionText: string;       // Transcripción del chunk
  vadScore: number;                // Score VAD del chunk
  timestamp: number;               // Timestamp del chunk
  duration: number;                // Duración del chunk (ms)
  isVoiceActive: boolean;          // Si contiene voz activa
}

interface RecordingConfig {
  chunkDuration?: number;          // Duración de chunks (segundos)
  vadThreshold?: number;           // Umbral VAD
  enableRealTimeTranscription?: boolean;
  enableNoiseReduction?: boolean;
}

interface VADAnalysisResult {
  averageVad: number;
  vadScores: number[];
  metrics: ProcessingMetrics[];
  voiceSegments: VoiceSegment[];   // Segmentos con voz detectada
}

interface VoiceSegment {
  startTime: number;
  endTime: number;
  vadScore: number;
  confidence: number;
}

interface AudioMetadata {
  duration: number;                // Duración total (segundos)
  sampleRate: number;
  channels: number;
  fileSize: number;                // Tamaño original (bytes)
  processedSize: number;           // Tamaño procesado (bytes)
}

interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  confidence?: number;
}
```

## Pasos de Refactorización

### Fase 1: Extender useSusurro

#### A. Estados Nuevos
```typescript
const [isEngineInitialized, setIsEngineInitialized] = useState(false);
const [engineError, setEngineError] = useState<string | null>(null);
const [isInitializingEngine, setIsInitializingEngine] = useState(false);
const [isRecording, setIsRecording] = useState(false);
const [currentChunks, setCurrentChunks] = useState<SusurroChunk[]>([]);
```

#### B. Método Principal para Archivos
```typescript
const processAndTranscribeFile = useCallback(async (file: File): Promise<CompleteAudioResult> => {
  const startTime = performance.now();
  
  // 1. Convertir archivo a ArrayBuffer
  const originalBuffer = await convertFileToBuffer(file);
  
  // 2. Crear URL del audio original
  const originalAudioUrl = URL.createObjectURL(file);
  
  // 3. Procesar audio con Murmuraba (noise reduction + VAD)
  const processedResult = await murmubaraProcess(originalBuffer, (metrics) => {
    // Callback para métricas en tiempo real
  });
  
  // 4. Crear URL del audio procesado
  const processedBlob = new Blob([processedResult.processedBuffer], { type: 'audio/wav' });
  const processedAudioUrl = URL.createObjectURL(processedBlob);
  
  // 5. Transcribir con Whisper
  const transcriptionResult = await transcribe(processedBlob);
  
  // 6. Analizar VAD
  const vadAnalysis = await analyzeVAD(originalBuffer);
  
  // 7. Compilar resultado completo
  return {
    originalAudioUrl,
    processedAudioUrl,
    transcriptionText: transcriptionResult.text,
    transcriptionSegments: transcriptionResult.segments,
    vadAnalysis,
    metadata: extractMetadata(file, processedResult),
    processingTime: performance.now() - startTime
  };
}, [transcribe, analyzeVAD]);
```

#### C. Métodos para Recording - Usando Murmuraba Streaming
```typescript
// PATRÓN MODERNO: Callback para chunks usando Murmuraba nativo
const startRecording = useCallback(async (
  onChunk: (chunk: SusurroChunk) => void, // Callback que se llama por cada chunk
  config?: RecordingConfig
): Promise<void> => {
  if (!isEngineInitialized) {
    await initializeAudioEngine();
  }
  
  setIsRecording(true);
  setCurrentChunks([]); // Reset chunks
  
  // Configuración por defecto
  const recordingConfig = {
    chunkDuration: 3, // 3 segundos por chunk
    vadThreshold: 0.5,
    enableRealTimeTranscription: true,
    enableNoiseReduction: true,
    ...config
  };
  
  // USAR MURMURABA STREAMING - NO MediaRecorder basura
  // Murmuraba maneja todo: micrófono, chunks, VAD, noise reduction
  const streamingSession = await murmubaraStreamChunked({
    chunkDuration: recordingConfig.chunkDuration,
    vadThreshold: recordingConfig.vadThreshold,
    enableNoiseSuppression: recordingConfig.enableNoiseReduction,
    enableVAD: true,
    
    // CALLBACK por cada chunk procesado por Murmuraba
    onChunkProcessed: async (murmubaraChunk: MurmurabaChunk) => {
      const chunkId = `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = Date.now();
      
      try {
        // Murmuraba ya procesó el audio (VAD + noise reduction)
        const audioBlob = murmubaraChunk.blob || new Blob([murmubaraChunk.audioBuffer]);
        
        // Transcribir chunk con Whisper
        const transcriptionResult = await transcribe(audioBlob);
        
        // Crear SusurroChunk completo
        const susurroChunk: SusurroChunk = {
          id: chunkId,
          audioBlob, // Audio ya procesado por Murmuraba
          transcriptionText: transcriptionResult?.text || '',
          vadScore: murmubaraChunk.vadScore || 0,
          timestamp,
          duration: recordingConfig.chunkDuration * 1000,
          isVoiceActive: (murmubaraChunk.vadScore || 0) > recordingConfig.vadThreshold
        };
        
        // CALLBACK INMEDIATO - chunk listo para mostrar
        onChunk(susurroChunk);
        
        // Agregar a estado interno
        setCurrentChunks(prev => [...prev, susurroChunk]);
        
      } catch (error) {
        console.error('Error transcribing chunk:', error);
        // Crear chunk de error con audio de Murmuraba
        const errorChunk: SusurroChunk = {
          id: chunkId,
          audioBlob: murmubaraChunk.blob || new Blob([murmubaraChunk.audioBuffer]),
          transcriptionText: '[Error transcribing]',
          vadScore: murmubaraChunk.vadScore || 0,
          timestamp,
          duration: recordingConfig.chunkDuration * 1000,
          isVoiceActive: false
        };
        onChunk(errorChunk);
      }
    }
  });
  
  // Guardar referencia de la sesión de Murmuraba
  currentStreamingSessionRef.current = streamingSession;
  
}, [isEngineInitialized, initializeAudioEngine, transcribe]);

const stopRecording = useCallback(async (): Promise<SusurroChunk[]> => {
  if (currentStreamingSessionRef.current) {
    // Detener sesión de streaming de Murmuraba
    await currentStreamingSessionRef.current.stop();
    currentStreamingSessionRef.current = null;
  }
  
  setIsRecording(false);
  
  // Retornar todos los chunks procesados
  return currentChunks;
}, [currentChunks]);

// Referencia para la sesión de streaming de Murmuraba
const currentStreamingSessionRef = useRef<{
  stop: () => Promise<void>;
} | null>(null);
```

### Fase 2: Limpiar whisper-matrix-terminal

#### A. Remover Imports de Murmuraba
```typescript
// REMOVER COMPLETAMENTE:
import { processFileWithMetrics as murmubaraProcessFile, initializeAudioEngine } from 'murmuraba';
import type { ProcessingMetrics } from 'murmuraba';

// SOLO MANTENER:
import React from 'react';
import { useSusurro } from '@susurro/core';
```

#### B. Simplificar Component Logic
```typescript
const WhisperMatrixTerminal = () => {
  // UN SOLO HOOK - TODA LA FUNCIONALIDAD
  const {
    // Engine status
    isEngineInitialized,
    engineError,
    initializeAudioEngine,
    
    // Whisper model status
    modelReady,
    loadingProgress,
    
    // MÉTODO PRINCIPAL PARA ARCHIVOS
    processAndTranscribeFile,
    
    // Para recording (Fase 2)
    startRecording,
    stopRecording,
    isRecording
  } = useSusurro();

  // Manejo de archivos simplificado
  const handleFileUpload = async (file: File) => {
    try {
      setStatus('[PROCESSING] Analyzing audio file...');
      
      // UN SOLO MÉTODO QUE HACE TODO
      const result = await processAndTranscribeFile(file);
      
      // Actualizar UI con resultado completo
      setOriginalAudioUrl(result.originalAudioUrl);
      setProcessedAudioUrl(result.processedAudioUrl);
      setTranscriptionText(result.transcriptionText);
      setVadAnalysis(result.vadAnalysis);
      setMetadata(result.metadata);
      
      setStatus(`[COMPLETE] Processed in ${result.processingTime}ms`);
    } catch (error) {
      setStatus(`[ERROR] ${error.message}`);
    }
  };

  // REMOVER TODAS LAS FUNCIONES INTERNAS:
  // - processFileWithMetrics() 
  // - initializeAudioEngineWrapper()
  // - Todas las llamadas directas a murmuraba
};
```

#### C. Simplificar Estados del Componente
```typescript
// ESTADOS SIMPLIFICADOS - menos lógica interna
const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
const [processedAudioUrl, setProcessedAudioUrl] = useState<string | null>(null);
const [transcriptionText, setTranscriptionText] = useState<string>('');
const [vadAnalysis, setVadAnalysis] = useState<VADAnalysisResult | null>(null);
const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
const [status, setStatus] = useState<string>('[SYSTEM] Ready');

// REMOVER ESTADOS COMPLEJOS que ahora maneja useSusurro:
// - isEngineInitialized (viene del hook)
// - engineError (viene del hook)  
// - processingMetrics (viene del resultado)
```

### Fase 3: Implementación Interna en useSusurro.ts

#### A. Imports y Setup
```typescript
// Importar murmuraba SOLO aquí - ÚNICA fuente de verdad
import { 
  processFileWithMetrics as murmubaraProcess,
  initializeAudioEngine as murmubaraInit,
  analyzeVAD as murmubaraVAD,
  processStreamChunked as murmubaraStreamChunked // Para streaming
} from 'murmuraba';
import type { ProcessingMetrics, MurmurabaChunk } from 'murmuraba';

// Ya existente
import { useWhisperDirect } from './useWhisperDirect';
```

#### B. Estados Adicionales
```typescript
const useSusurro = (options: UseSusurroOptions = {}) => {
  // Estados existentes del hook...
  
  // NUEVOS ESTADOS
  const [isEngineInitialized, setIsEngineInitialized] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [isInitializingEngine, setIsInitializingEngine] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentChunks, setCurrentChunks] = useState<SusurroChunk[]>([]);
  
  // Usar hook existente para Whisper
  const {
    transcribe,
    modelReady,
    loadingProgress,
    isTranscribing,
    // ... otros métodos existentes
  } = useWhisperDirect(options);
```

#### C. Método Principal para Archivos
```typescript
const processAndTranscribeFile = useCallback(async (file: File): Promise<CompleteAudioResult> => {
  const startTime = performance.now();
  
  try {
    // Asegurar que engines estén listos
    if (!modelReady) {
      throw new Error('Whisper model not ready');
    }
    if (!isEngineInitialized) {
      await initializeAudioEngine();
    }
    
    // 1. Convertir archivo a ArrayBuffer
    const originalBuffer = await file.arrayBuffer();
    
    // 2. Crear URL del audio original
    const originalAudioUrl = URL.createObjectURL(file);
    
    // 3. Procesar con Murmuraba (noise reduction + VAD)
    const processedResult = await murmubaraProcess(originalBuffer, (metrics: ProcessingMetrics) => {
      // Callback para métricas en tiempo real si se necesita
      console.log(`VAD: ${metrics.vad?.toFixed(3)}, Frame: ${metrics.frame}`);
    });
    
    // 4. Crear URL del audio procesado
    const processedBlob = new Blob([processedResult.processedBuffer], { type: 'audio/wav' });
    const processedAudioUrl = URL.createObjectURL(processedBlob);
    
    // 5. Transcribir con Whisper
    const transcriptionResult = await transcribe(processedBlob);
    if (!transcriptionResult) {
      throw new Error('Transcription failed');
    }
    
    // 6. Analizar VAD completo
    const vadAnalysis = await analyzeVAD(originalBuffer);
    
    // 7. Extraer metadata
    const metadata: AudioMetadata = {
      duration: calculateDuration(originalBuffer),
      sampleRate: 44100, // Extraer del buffer real
      channels: 2, // Extraer del buffer real  
      fileSize: file.size,
      processedSize: processedResult.processedBuffer.byteLength
    };
    
    // 8. Compilar resultado completo
    return {
      originalAudioUrl,
      processedAudioUrl,
      transcriptionText: transcriptionResult.text,
      transcriptionSegments: transcriptionResult.segments,
      vadAnalysis,
      metadata,
      processingTime: performance.now() - startTime
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Processing failed';
    throw new Error(`Audio processing failed: ${errorMessage}`);
  }
}, [modelReady, isEngineInitialized, transcribe, initializeAudioEngine, analyzeVAD]);
```

#### D. Métodos Auxiliares
```typescript
const initializeAudioEngine = useCallback(async (config?: AudioEngineConfig) => {
  if (isInitializingEngine) return;
  
  setIsInitializingEngine(true);
  try {
    await murmubaraInit({
      enableVAD: true,
      enableNoiseSuppression: true,
      enableEchoCancellation: true,
      ...config
    } as any);
    
    setIsEngineInitialized(true);
    setEngineError(null);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Engine initialization failed';
    setEngineError(errorMsg);
    throw error;
  } finally {
    setIsInitializingEngine(false);
  }
}, [isInitializingEngine]);

const analyzeVAD = useCallback(async (buffer: ArrayBuffer): Promise<VADAnalysisResult> => {
  const result = await murmubaraVAD(buffer);
  
  // Procesar resultados para encontrar voice segments
  const voiceSegments: VoiceSegment[] = [];
  // ... lógica para detectar segmentos de voz
  
  return {
    averageVad: result.average || 0,
    vadScores: result.scores || [],
    metrics: result.metrics || [],
    voiceSegments
  };
}, []);
```

### Fase 4: Return y Auto-inicialización

#### A. Return del Hook Extendido
```typescript
return {
  // MÉTODOS EXISTENTES de useWhisperDirect
  transcribe,
  clearTranscript,
  modelReady,
  loadingProgress,
  isTranscribing,
  transcript,
  error,
  isLoadingFromCache,
  
  // NUEVOS MÉTODOS PRINCIPALES
  processAndTranscribeFile,        // TODO en uno para archivos
  
  // Audio engine
  initializeAudioEngine,
  isEngineInitialized,
  engineError,
  isInitializingEngine,
  
  // Recording (Fase 2)
  startRecording,
  stopRecording,
  isRecording,
  currentChunks,
  
  // Métodos auxiliares (opcionales de exponer)
  analyzeVAD,
  convertBlobToBuffer: (blob: Blob) => blob.arrayBuffer(),
};
```

#### B. Auto-inicialización
```typescript
// Auto-inicializar Murmuraba cuando Whisper esté listo
useEffect(() => {
  if (modelReady && !isEngineInitialized && !isInitializingEngine && !engineError) {
    initializeAudioEngine({
      enableVAD: true,
      enableNoiseSuppression: true,
      enableEchoCancellation: true
    }).catch(error => {
      console.warn('Auto-initialization of audio engine failed:', error.message);
      // No throw - permitir uso manual
    });
  }
}, [modelReady, isEngineInitialized, isInitializingEngine, engineError, initializeAudioEngine]);

// Cleanup URLs cuando el componente se desmonte
useEffect(() => {
  return () => {
    // Cleanup de URLs creadas con URL.createObjectURL
    // Se manejará en el componente que usa el hook
  };
}, []);
```

## Uso Simplificado en Componente

### Para Archivos (whisper-matrix-terminal)
```typescript
const WhisperMatrixTerminal = () => {
  const { processAndTranscribeFile, modelReady, isEngineInitialized } = useSusurro();
  
  const handleFileUpload = async (file: File) => {
    try {
      // UN SOLO MÉTODO - TODO INCLUIDO
      const result = await processAndTranscribeFile(file);
      
      // result contiene:
      // - originalAudioUrl (para reproducir/descargar original)
      // - processedAudioUrl (para reproducir/descargar procesado)  
      // - transcriptionText (texto completo)
      // - vadAnalysis (métricas VAD completas)
      // - metadata (duración, tamaño, etc.)
      // - processingTime (tiempo total)
      
      updateUI(result);
    } catch (error) {
      showError(error.message);
    }
  };
};
```

### Para whisper-matrix-terminal - Chunks Flotantes
```typescript
const WhisperMatrixTerminal = () => {
  const { startRecording, stopRecording, isRecording } = useSusurro();
  const [liveChunks, setLiveChunks] = useState<SusurroChunk[]>([]);
  const [savedChunks, setSavedChunks] = useState<SusurroChunk[]>([]);
  
  const handleStartRecording = async () => {
    setLiveChunks([]); // Reset chunks flotantes
    
    // CALLBACK que se ejecuta por cada chunk (cada 3 segundos)
    const onNewChunk = (chunk: SusurroChunk) => {
      console.log('🎤 Nuevo chunk:', chunk.transcriptionText);
      
      // 1. Agregar chunk flotante a la UI
      setLiveChunks(prev => [...prev, chunk]);
      
      // 2. Auto-guardar chunk (en BD, localStorage, etc.)
      saveChunkToStorage(chunk);
      
      // 3. Opcional: Limpiar chunks viejos después de X tiempo
      setTimeout(() => {
        setLiveChunks(prev => prev.filter(c => c.id !== chunk.id));
        setSavedChunks(prev => [...prev, chunk]); // Mover a "guardados"
      }, 10000); // Desaparece después de 10 segundos
    };
    
    // Iniciar recording con callback
    await startRecording(onNewChunk, {
      chunkDuration: 3, // Cada 3 segundos aparece un chunk
      vadThreshold: 0.5,
      enableRealTimeTranscription: true,
      enableNoiseReduction: true
    });
  };
  
  const handleStopRecording = async () => {
    const allChunks = await stopRecording();
    
    // Mover chunks restantes a guardados
    setLiveChunks([]);
    setSavedChunks(prev => [...prev, ...allChunks]);
    
    console.log(`✅ Recording finalizado. ${allChunks.length} chunks guardados.`);
  };
  
  const saveChunkToStorage = async (chunk: SusurroChunk) => {
    // Guardar en localStorage, IndexedDB, o enviar a servidor
    try {
      const chunkData = {
        id: chunk.id,
        text: chunk.transcriptionText,
        timestamp: chunk.timestamp,
        vadScore: chunk.vadScore,
        // audioBlob se puede convertir a base64 si es necesario
      };
      localStorage.setItem(`chunk_${chunk.id}`, JSON.stringify(chunkData));
      console.log('💾 Chunk guardado:', chunk.id.substring(0, 12));
    } catch (error) {
      console.error('Error guardando chunk:', error);
    }
  };
  
  return (
    <div>
      {/* Chunks flotantes mientras hablas */}
      <div className="live-chunks">
        {liveChunks.map(chunk => (
          <div key={chunk.id} className="floating-chunk">
            <span className="timestamp">{new Date(chunk.timestamp).toLocaleTimeString()}</span>
            <span className="text">{chunk.transcriptionText}</span>
            <span className="vad">VAD: {chunk.vadScore.toFixed(2)}</span>
            {chunk.isVoiceActive && <span className="voice-active">🎤</span>}
          </div>
        ))}
      </div>
      
      {/* Controles */}
      <button onClick={handleStartRecording} disabled={isRecording}>
        {isRecording ? 'Recording...' : 'Start Recording'}
      </button>
      <button onClick={handleStopRecording} disabled={!isRecording}>
        Stop Recording
      </button>
      
      {/* Chunks guardados */}
      <div className="saved-chunks">
        <h3>Saved Chunks ({savedChunks.length})</h3>
        {savedChunks.map(chunk => (
          <div key={chunk.id}>{chunk.transcriptionText}</div>
        ))}
      </div>
    </div>
  );
};
```

### Para conversational-chat-feed - Chat en Tiempo Real
```typescript
const ConversationalChatFeed = () => {
  const { startRecording, stopRecording, isRecording } = useSusurro();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  interface ChatMessage {
    id: string;
    text: string;
    timestamp: number;
    type: 'user' | 'assistant';
    vadScore?: number;
    audioBlob?: Blob;
  }

  const handleStartRecording = async () => {
    setCurrentMessage(''); // Reset mensaje actual
    setIsTyping(true);
    
    // CALLBACK conversacional - chunks se agregan al mensaje actual
    const onNewChunk = (chunk: SusurroChunk) => {
      console.log('🎤 Nuevo chunk conversacional:', chunk.transcriptionText);
      
      if (chunk.isVoiceActive && chunk.transcriptionText.trim()) {
        // Agregar chunk al mensaje actual (concatenar)
        setCurrentMessage(prev => {
          const newText = prev + ' ' + chunk.transcriptionText.trim();
          return newText.trim();
        });
        
        // Auto-scroll al final
        scrollToBottom();
        
        // Guardar chunk individual para referencia
        saveChunkReference(chunk);
      }
    };
    
    // Configuración para conversación fluida
    await startRecording(onNewChunk, {
      chunkDuration: 2, // Chunks más frecuentes para conversación
      vadThreshold: 0.3, // Más sensible para capturar susurros
      enableRealTimeTranscription: true,
      enableNoiseReduction: true
    });
  };
  
  const handleStopRecording = async () => {
    const allChunks = await stopRecording();
    setIsTyping(false);
    
    // Crear mensaje final del usuario
    if (currentMessage.trim()) {
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        text: currentMessage.trim(),
        timestamp: Date.now(),
        type: 'user',
        vadScore: calculateAverageVAD(allChunks),
        audioBlob: combineChunkAudio(allChunks) // Opcional: audio completo
      };
      
      setMessages(prev => [...prev, userMessage]);
      setCurrentMessage('');
      
      // Auto-generar respuesta del asistente (opcional)
      generateAssistantResponse(userMessage.text);
      
      console.log(`✅ Mensaje conversacional creado: "${userMessage.text}"`);
    }
  };
  
  const generateAssistantResponse = async (userText: string) => {
    // Simular respuesta del asistente
    setIsTyping(true);
    
    try {
      // Aquí iría tu lógica de IA/LLM
      const response = await getAIResponse(userText);
      
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        text: response,
        timestamp: Date.now(),
        type: 'assistant'
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      scrollToBottom();
    } catch (error) {
      console.error('Error generando respuesta:', error);
    } finally {
      setIsTyping(false);
    }
  };
  
  const saveChunkReference = (chunk: SusurroChunk) => {
    // Guardar referencia del chunk para debugging/analytics
    const chunkRef = {
      id: chunk.id,
      text: chunk.transcriptionText,
      timestamp: chunk.timestamp,
      vadScore: chunk.vadScore
    };
    localStorage.setItem(`chunk_ref_${chunk.id}`, JSON.stringify(chunkRef));
  };
  
  const calculateAverageVAD = (chunks: SusurroChunk[]): number => {
    if (!chunks.length) return 0;
    const sum = chunks.reduce((acc, chunk) => acc + chunk.vadScore, 0);
    return sum / chunks.length;
  };
  
  const combineChunkAudio = (chunks: SusurroChunk[]): Blob => {
    // Combinar audio de todos los chunks en un solo blob
    const audioData: BlobPart[] = [];
    chunks.forEach(chunk => audioData.push(chunk.audioBlob));
    return new Blob(audioData, { type: 'audio/wav' });
  };
  
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const getAIResponse = async (text: string): Promise<string> => {
    // Mock de respuesta de IA - aquí iría tu integración real
    await new Promise(resolve => setTimeout(resolve, 1000));
    return `Entiendo que dijiste: "${text}". ¿Cómo puedo ayudarte más?`;
  };
  
  return (
    <div className="chat-container">
      {/* Feed de mensajes */}
      <div className="messages-feed">
        {messages.map(message => (
          <div key={message.id} className={`message ${message.type}`}>
            <div className="message-header">
              <span className="sender">{message.type === 'user' ? 'Tú' : 'Asistente'}</span>
              <span className="timestamp">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
              {message.vadScore && (
                <span className="vad-score">VAD: {message.vadScore.toFixed(2)}</span>
              )}
            </div>
            <div className="message-text">{message.text}</div>
            {message.audioBlob && (
              <audio controls className="message-audio">
                <source src={URL.createObjectURL(message.audioBlob)} type="audio/wav" />
              </audio>
            )}
          </div>
        ))}
        
        {/* Mensaje actual siendo escrito */}
        {isRecording && currentMessage && (
          <div className="message user current">
            <div className="message-header">
              <span className="sender">Tú</span>
              <span className="recording-indicator">🎤 Grabando...</span>
            </div>
            <div className="message-text">{currentMessage}</div>
          </div>
        )}
        
        {/* Indicador de typing del asistente */}
        {isTyping && !isRecording && (
          <div className="message assistant typing">
            <div className="message-header">
              <span className="sender">Asistente</span>
            </div>
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>
      
      {/* Controles de grabación */}
      <div className="recording-controls">
        <button 
          onClick={handleStartRecording} 
          disabled={isRecording}
          className="record-button"
        >
          {isRecording ? '🎤 Grabando...' : '🎤 Hablar'}
        </button>
        <button 
          onClick={handleStopRecording} 
          disabled={!isRecording}
          className="stop-button"
        >
          ⏹️ Enviar
        </button>
        {currentMessage && (
          <div className="current-message-preview">
            Mensaje actual: "{currentMessage}"
          </div>
        )}
      </div>
    </div>
  );
};
```

## Beneficios de Esta Refactorización

### 1. **Separación de Responsabilidades**
- **Componentes**: Solo UI y UX, usan useSusurro
- **useSusurro**: Toda la lógica de audio (Whisper + Murmuraba)
- **Murmuraba**: Solo usado internamente por useSusurro

### 2. **API Simplificada**
- **Para archivos**: `processAndTranscribeFile()` - UN método, TODO incluido
- **Para recording**: `startRecording()` + `stopRecording()` - retorna chunks listos
- **Estados claros**: `modelReady`, `isEngineInitialized`, `isRecording`

### 3. **Resultados Completos**
- **Archivos**: URLs de audio original Y procesado + transcripción + VAD
- **Recording**: Chunks con audio + transcripción + VAD por chunk
- **Metadata**: Información completa de procesamiento

### 4. **Mantenibilidad**
- Un solo punto de verdad para audio
- Cambios en murmuraba solo afectan useSusurro
- Testing simplificado (mock solo useSusurro)

### 5. **Reutilización**
- Cualquier componente puede usar los mismos métodos
- API consistente en toda la aplicación
- Lógica centralizada

## Archivos a Modificar

### Fase 1: Implementación
1. **`packages/susurro/src/hooks/useSusurro.ts`**
   - Agregar nuevos métodos y estados
   - Implementar `processAndTranscribeFile()`
   - Wrapper para murmuraba

2. **`packages/susurro/src/lib/types.ts`**
   - Agregar nuevos tipos (`CompleteAudioResult`, `SusurroChunk`, etc.)

### Fase 2: Limpieza
3. **`src/features/audio-processing/components/whisper-matrix-terminal/whisper-matrix-terminal.tsx`**
   - Remover imports de murmuraba
   - Simplificar lógica usando solo useSusurro
   - Actualizar estados y manejo de resultados

## Cronograma de Implementación

### Sprint 1: Core Implementation
- [ ] Extender useSusurro con nuevos tipos y métodos
- [ ] Implementar `processAndTranscribeFile()`
- [ ] Testing básico del nuevo método

### Sprint 2: Component Refactoring  
- [ ] Limpiar whisper-matrix-terminal
- [ ] Remover todas las llamadas directas a murmuraba
- [ ] Actualizar UI para mostrar resultados completos

### Sprint 3: Recording Support (Fase 2)
- [ ] Implementar `startRecording()` y `stopRecording()`
- [ ] Agregar soporte para SusurroChunks
- [ ] Integrar recording con transcripción en tiempo real

## Notas de Implementación
- Mantener compatibilidad backwards con API existente
- Todos los métodos de murmuraba son async
- Manejar errores consistentemente  
- Logging centralizado en useSusurro
- URLs creados con `URL.createObjectURL()` deben ser liberados