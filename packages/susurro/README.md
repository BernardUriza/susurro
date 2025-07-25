# @susurro/core

Hook minimalista para procesamiento de audio y transcripción.

## Instalación

```bash
npm install @susurro/core murmuraba @xenova/transformers
```

## Uso

```tsx
import { useSusurro } from '@susurro/core'

function AudioProcessor() {
  const { cleanAudio, transcribe, cleaning, transcribing, error } = useSusurro()
  
  const handleFile = async (file: File) => {
    // Paso 1: Limpiar audio
    const { blob, vadScore } = await cleanAudio(file)
    console.log(`VAD Score: ${vadScore}`)
    
    // Paso 2: Transcribir
    const text = await transcribe(blob)
    console.log(`Transcripción: ${text}`)
  }
  
  return (
    <div>
      {cleaning && <p>Limpiando audio...</p>}
      {transcribing && <p>Transcribiendo...</p>}
      {error && <p>Error: {error.message}</p>}
    </div>
  )
}
```

## API

### `useSusurro(config?)`

#### Config
- `whisperModel?: string` - Modelo de Whisper (default: 'Xenova/whisper-tiny')
- `language?: string` - Idioma para transcripción (default: 'english')

#### Returns
- `cleanAudio: (file: File) => Promise<{ blob: Blob, vadScore: number }>` - Limpia audio con Murmuraba
- `transcribe: (blob: Blob) => Promise<string>` - Transcribe con Whisper
- `cleaning: boolean` - Estado de limpieza
- `transcribing: boolean` - Estado de transcripción
- `error: Error | null` - Error si existe