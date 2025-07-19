# Susurro - Whisper para Next.js con Transformers.js

Transcripción de voz a texto 100% local en el navegador usando Whisper y Transformers.js. Sin servidor, sin API keys, completamente privado.

## Instalación

```bash
npm install @susurro/whisper-nextjs
```

## Características

- 🔒 **100% Privado**: Tu voz nunca sale de tu dispositivo
- ⚡ **Sin latencia**: Procesamiento local instantáneo
- 🌐 **Funciona offline**: No necesita conexión a internet
- 🤖 **Powered by Transformers.js**: Modelos de Hugging Face en el navegador
- 📦 **Fácil integración**: Hook y componente listos para usar

## Uso

### Hook useWhisper

```tsx
import { useWhisper } from '@susurro/whisper-nextjs'

function MyComponent() {
  const {
    isRecording,
    isTranscribing,
    transcript,
    error,
    startRecording,
    stopRecording,
    transcribeAudio,
    clearTranscript
  } = useWhisper({
    language: 'es',
    temperature: 0.2
  })

  return (
    <div>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Detener' : 'Grabar'}
      </button>
      {transcript && <p>{transcript}</p>}
    </div>
  )
}
```

### Componente WhisperRecorder

```tsx
import { WhisperRecorder } from '@susurro/whisper-nextjs'
import '@susurro/whisper-nextjs/styles.css'

function MyApp() {
  return (
    <WhisperRecorder
      config={{
        language: 'es',
        temperature: 0.2
      }}
      onTranscription={(text) => console.log(text)}
    />
  )
}
```

## Configuración

### Next.js Config

Asegúrate de configurar Next.js para soportar Web Workers y WASM:

```javascript
// next.config.js
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    }
    return config
  },
}
```

## API

### WhisperConfig

```typescript
interface WhisperConfig {
  language?: string // Idioma para la transcripción (ej: 'es', 'en')
  model?: string // Modelo a usar (por defecto: 'Xenova/whisper-tiny')
}
```

### useWhisper Return

```typescript
interface UseWhisperReturn {
  isRecording: boolean
  isTranscribing: boolean
  transcript: string | null
  error: Error | null
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  transcribeAudio: (audioBlob: Blob) => Promise<TranscriptionResult | null>
  clearTranscript: () => void
  modelReady: boolean // Indica si el modelo está listo
  loadingProgress: number // Progreso de carga del modelo (0-100)
}
```

## Notas importantes

- La primera vez que uses la aplicación, se descargará el modelo Whisper (~40MB)
- El modelo se guarda en caché del navegador para uso futuro
- Requiere un navegador moderno con soporte para Web Workers y WebAssembly

## Licencia

MIT