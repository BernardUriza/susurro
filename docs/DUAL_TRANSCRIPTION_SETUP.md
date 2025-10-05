# Sistema de Transcripción Dual - Configuración

Sistema de transcripción paralela con Web Speech API + Deepgram + refinamiento con Claude AI.

## 🎯 Arquitectura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Web Speech    │────▶│  Transcripción   │────▶│   Claude AI     │
│   API (Browser) │     │  en Paralelo     │     │   Refinamiento  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        ▲                        ▲                        │
        │                        │                        ▼
    INSTANTÁNEO              PRECISO               TEXTO LIMPIO
    (0ms latencia)         (Deepgram API)        (Combinado y refinado)
```

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend-deepgram

# Crear archivo .env
cat > .env << EOF
DEEPGRAM_API_KEY=tu_api_key_aqui
ANTHROPIC_API_KEY=tu_api_key_aqui
PORT=8001
EOF

# Instalar dependencias
pip install -r requirements.txt

# Iniciar servidor
python server.py
```

El servidor estará disponible en `http://localhost:8001`

### 2. Frontend Setup

```bash
# Instalar dependencias (si no lo has hecho)
npm install

# Iniciar modo desarrollo
npm run dev
```

### 3. Usar el componente demo

```tsx
import { DualTranscriptionDemo } from './features/audio-processing/components/dual-transcription-demo/dual-transcription-demo';

function App() {
  return (
    <NeuralProvider>
      <DualTranscriptionDemo />
    </NeuralProvider>
  );
}
```

## 🔧 Uso Programático

### Opción 1: Hook useDualTranscription

```tsx
import { useDualTranscription } from '@susurro/core';
import { useNeural } from './contexts/NeuralContext';

function MyComponent() {
  const neural = useNeural();
  const dual = useDualTranscription({
    language: 'es-ES',
    autoRefine: true,
    claudeConfig: {
      enabled: true,
      apiUrl: 'http://localhost:8001/refine',
    },
    onResult: (result) => {
      console.log('Web Speech:', result.webSpeechText);
      console.log('Deepgram:', result.deepgramText);
      console.log('Refinado:', result.refinedText);
    },
  });

  const handleRecord = async () => {
    // 1. Iniciar Web Speech
    dual.startTranscription();

    // 2. Iniciar Deepgram streaming
    await neural.startStreamingRecording(
      (chunk) => {
        // Actualizar texto de Deepgram
        console.log('Chunk:', chunk.transcriptionText);
      },
      { chunkDuration: 2 }
    );
  };

  const handleStop = async () => {
    await neural.stopStreamingRecording();
    const result = await dual.stopTranscription();

    // result contiene:
    // - webSpeechText: Transcripción instantánea
    // - deepgramText: Transcripción precisa
    // - refinedText: Texto limpio combinado por Claude
  };

  return (
    <div>
      <button onClick={handleRecord}>Grabar</button>
      <button onClick={handleStop}>Detener</button>

      <div>Web Speech: {dual.webSpeechText}</div>
      <div>Deepgram: {dual.deepgramText}</div>
      <div>Refinado: {dual.refinedText}</div>
    </div>
  );
}
```

### Opción 2: Hooks Individuales

```tsx
import { useWebSpeech } from '@susurro/core';

function QuickTranscription() {
  const webSpeech = useWebSpeech({
    language: 'es-ES',
    continuous: true,
    interimResults: true,
  });

  return (
    <div>
      <button onClick={webSpeech.startListening}>Start</button>
      <button onClick={webSpeech.stopListening}>Stop</button>

      <p>Final: {webSpeech.finalTranscript}</p>
      <p>Interim: {webSpeech.interimTranscript}</p>
    </div>
  );
}
```

## 📡 API Endpoints

### POST /refine

Refina dos transcripciones en texto limpio usando Claude AI.

**Request:**
```json
{
  "web_speech_text": "hola como estas",
  "deepgram_text": "Hola, ¿cómo estás?",
  "language": "es"
}
```

**Response:**
```json
{
  "success": true,
  "refined_text": "Hola, ¿cómo estás?",
  "confidence": 0.85,
  "model": "claude-3-5-sonnet-20241022",
  "usage": {
    "input_tokens": 150,
    "output_tokens": 20
  }
}
```

### POST /transcribe-chunk

Transcribe un chunk de audio con Deepgram.

**Request:** Multipart form con archivo WAV

**Response:**
```json
{
  "success": true,
  "transcript": "Hola, ¿cómo estás?",
  "confidence": 0.95,
  "model": "deepgram-nova-2"
}
```

## 🐛 Bug Fixes Incluidos

### 1. **Fix: Último chunk se perdía**

**Problema:** En `conversational-chat-feed.tsx`, el último chunk de audio no se incluía en el mensaje final.

**Solución:** Ahora usa `allChunks` de `stopStreamingRecording()` en lugar de solo `currentMessage`:

```tsx
// ANTES (incorrecto)
const finalMessage = currentMessage.trim();

// DESPUÉS (correcto)
const allTranscriptions = allChunks
  .filter(chunk => chunk.isVoiceActive && chunk.transcriptionText.trim())
  .map(chunk => chunk.transcriptionText.trim())
  .join(' ');

const finalMessage = allTranscriptions || currentMessage.trim();
```

Archivo: `src/features/audio-processing/components/conversational-chat-feed/conversational-chat-feed.tsx:243-250`

## 🎨 Flujo de Trabajo

1. **Usuario presiona "Grabar"**
   - ✅ Web Speech API comienza inmediatamente
   - ✅ Deepgram streaming comienza en paralelo

2. **Durante la grabación**
   - 🟡 Web Speech muestra texto instantáneo (puede tener errores)
   - 🔵 Deepgram procesa chunks y muestra texto más preciso

3. **Usuario presiona "Detener"**
   - ⚙️ Se detienen ambos sistemas
   - 🧠 Claude AI recibe ambas transcripciones
   - ✨ Claude genera texto refinado y limpio
   - ✅ Se muestra resultado final

## 📊 Comparación de Métodos

| Característica       | Web Speech API | Deepgram      | Claude Refinado |
|----------------------|----------------|---------------|-----------------|
| Latencia             | 0ms            | ~500ms        | ~1-2s           |
| Precisión            | 70-80%         | 90-95%        | 95-98%          |
| Costo                | Gratis         | $$$           | $$              |
| Offline              | ❌              | ❌             | ❌               |
| Puntuación           | ❌              | ✅             | ✅✅             |
| Capitalización       | Limitada       | ✅             | ✅✅             |
| Corrección errores   | ❌              | Parcial       | ✅✅             |

## 🔑 Variables de Entorno

### Backend (.env)

```bash
# Deepgram API Key (required)
DEEPGRAM_API_KEY=your_deepgram_key_here

# Anthropic/Claude API Key (required para refinamiento)
ANTHROPIC_API_KEY=your_anthropic_key_here

# Puerto del servidor (opcional, default: 8001)
PORT=8001
```

### Frontend

No requiere variables de entorno adicionales. La URL del backend se configura en el hook:

```tsx
claudeConfig: {
  enabled: true,
  apiUrl: 'http://localhost:8001/refine',
}
```

## 🧪 Testing

```bash
# Test Web Speech (requiere browser)
npm run dev
# Navega a http://localhost:5173 y abre consola

# Test Deepgram backend
curl http://localhost:8001/health

# Test Claude refinement
curl -X POST http://localhost:8001/refine \
  -H "Content-Type: application/json" \
  -d '{
    "web_speech_text": "hola mundo",
    "deepgram_text": "Hola mundo.",
    "language": "es"
  }'
```

## 📝 Notas

- Web Speech API solo funciona en Chrome/Edge (Chromium)
- Requiere HTTPS en producción (o localhost para desarrollo)
- Deepgram requiere API key válida
- Claude API tiene rate limits y costos

## 🚀 Próximas Mejoras

- [ ] Soporte para múltiples idiomas automático
- [ ] Cache de resultados de Claude para frases comunes
- [ ] Modo offline con fallback a Web Speech solo
- [ ] Métricas de comparación entre sistemas
- [ ] UI para ver diferencias lado a lado

## 📚 Referencias

- [Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Deepgram API Docs](https://developers.deepgram.com/)
- [Claude API Docs](https://docs.anthropic.com/)
