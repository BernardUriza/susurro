# @susurro/core 🎵

**Real-Time AI Conversational Audio Processing — El Murmullo del Futuro**

Audio processing and transcription library for web applications with ChatGPT-style real-time chunk interaction.

## 🚀 Next Evolution: Conversational Chunks

Transform audio into interactive conversations. Each whisper becomes a complete message with both clean audio and AI transcription, ready for reactive UIs.

**No more post-processing, no more waiting**: Each chunk is a complete response, like ChatGPT messages but with real audio.

## Installation

```bash
npm install @susurro/core
```

## Peer Dependencies

```bash
npm install react murmuraba @xenova/transformers
```

## 🎯 Real-Time Usage (Future Implementation)

```typescript
import { useSusurro } from '@susurro/core';

function ConversationalApp() {
  const {
    isRecording,
    startRecording,
    stopRecording,
    onChunk // 🆕 Real-time chunk callback
  } = useSusurro({
    onChunk: (chunk: SusurroChunk) => {
      // Each chunk arrives with BOTH audio and transcript ready
      console.log('New conversation chunk:', {
        audio: chunk.audioUrl,      // Clean neural-processed audio
        text: chunk.transcript,     // AI transcription
        timing: `${chunk.startTime}-${chunk.endTime}ms`,
        confidence: chunk.vadScore
      });
      
      // Add to UI immediately - ChatGPT style
      addMessageToChat({
        type: 'audio-message',
        audioUrl: chunk.audioUrl,
        text: chunk.transcript,
        timestamp: new Date()
      });
    }
  });

  return (
    <div>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop Conversation' : 'Start Conversation'}
      </button>
      
      {/* Real-time chat-like interface */}
      <ConversationFeed />
    </div>
  );
}
```

## 🔄 The Conversational Flow

```
🎤 Audio Input → 🧠 Murmuraba (Neural Clean) → 🤖 Whisper (AI Transcribe) → ✨ SusurroChunk → 💬 UI Update
```

Each chunk is a complete conversational unit:

```typescript
type SusurroChunk = {
  id: string;                // Unique identifier
  audioUrl: string;          // Clean neural-processed audio (Blob URL)
  transcript: string;        // AI-transcribed text 
  startTime: number;         // Start time in ms
  endTime: number;           // End time in ms
  vadScore: number;          // Voice activity confidence
  isComplete: boolean;       // Both audio + transcript ready
}
```

## Current Implementation

```typescript
import { useSusurro } from '@susurro/core';

function App() {
  const {
    isRecording,
    isProcessing,
    transcriptions,
    audioChunks,
    startRecording,
    stopRecording,
    processAudioFile
  } = useSusurro({
    chunkDurationMs: 8000,
    enableVAD: true,
    whisperConfig: {
      model: 'Xenova/whisper-tiny',
      language: 'en'
    }
  });

  const handleFileUpload = async (file: File) => {
    await processAudioFile(file);
  };

  return (
    <div>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop' : 'Start'} Recording
      </button>
      
      {transcriptions.map((t, i) => (
        <div key={i}>{t.text}</div>
      ))}
    </div>
  );
}
```

## 🌟 Features

### Current Features
- 🎙️ **Audio recording** from microphone
- 📁 **File processing** with automatic chunking
- 🔊 **Voice Activity Detection (VAD)**
- 🤖 **Whisper-based AI transcription**
- ⚡ **Real-time processing** status
- 🔧 **TypeScript** full support

### 🚀 Next Evolution Features (Coming Soon)
- 🎯 **Conversational chunks** - ChatGPT-style real-time responses
- 🧠 **Neural noise reduction** - Professional audio quality with RNNoise
- ⚡ **Zero MediaRecorder** - Complete abstraction from manual recording
- 💬 **Chat-like UX** - Each chunk as a complete message
- 🔄 **Real-time callbacks** - Instant UI updates per chunk
- 🎨 **Extensible processing** - Hooks for translation, enrichment

## API Reference

### `useSusurro(options?)`

#### Options
- `chunkDurationMs?: number` - Duration of each audio chunk in milliseconds (default: 8000)
- `enableVAD?: boolean` - Enable Voice Activity Detection (default: true)
- `whisperConfig?: object` - Whisper configuration
  - `model?: string` - Whisper model to use (default: 'Xenova/whisper-tiny')
  - `language?: string` - Language for transcription (default: 'en')
- `onChunk?: (chunk: SusurroChunk) => void` - **🆕 Real-time chunk callback** (coming soon)

#### Returns
- `isRecording: boolean` - Recording state
- `isProcessing: boolean` - Processing state
- `transcriptions: TranscriptionResult[]` - Array of transcription results
- `audioChunks: AudioChunk[]` - Array of processed audio chunks
- `processingStatus: ProcessingStatus` - Detailed processing status
- `startRecording: () => Promise<void>` - Start recording from microphone
- `stopRecording: () => void` - Stop recording
- `pauseRecording: () => void` - Pause recording
- `resumeRecording: () => void` - Resume recording
- `clearTranscriptions: () => void` - Clear all transcriptions
- `processAudioFile: (file: File) => Promise<void>` - Process an audio file

## 🔮 Migration Roadmap

### Phase 1: Murmuraba v3 Integration (Current)
- Replace singleton with hooks
- Neural noise reduction with RNNoise
- Eliminate MediaRecorder boilerplate

### Phase 2: Conversational Chunks (Next)
- Real-time chunk emission with `onChunk` callback
- Synchronized audio + transcript delivery
- Chat-like UX patterns
- Complete MediaRecorder abstraction

## Publishing

```bash
cd packages/susurro
npm publish --access public
```

---

**El Murmullo del Futuro** - Where every whisper becomes an intelligent conversation. 🎵✨