# Susurro - Neural Audio Intelligence Platform

A next-generation conversational AI platform combining Murmuraba's neural audio processing with Whisper's transcription capabilities for ChatGPT-style real-time voice conversations.

**Working Commit ID**: `f8d559d3d7c3c69fde502fa48ac3ea94ad03402b`

## 🎯 Features

### Core Audio Processing
- **Murmuraba Neural Audio Processing** - Advanced noise reduction and audio enhancement
- **Real-time Voice Activity Detection (VAD)** - Smart chunk segmentation
- **Multi-format audio support** - WAV, MP3, and more
- **Whisper AI Transcription** - OpenAI's state-of-the-art speech-to-text

### Conversational Intelligence
- **🚀 NEW: SusurroChunk System** - Real-time audio-transcript pairs
- **ChatGPT-style Conversations** - Instant audio message processing
- **Dual Async Processing** - Parallel audio enhancement + transcription
- **<300ms Latency** - Ultra-fast audio-to-text pipeline
- **Memory Efficient** - Smart chunk cleanup and optimization

### Developer Experience
- **TypeScript First** - Full type safety and IntelliSense
- **React Hooks** - Simple, powerful API
- **Progressive Model Loading** - Visual feedback and caching
- **Matrix-themed UI** - Cyberpunk aesthetics (optional)

## 🚀 Technology Stack

- **Vite + React 18** - Modern build system and framework
- **TypeScript** - Full type safety and developer experience
- **Murmuraba v2** - Neural audio processing engine
- **Transformers.js** - Client-side Whisper AI models
- **Advanced Audio APIs** - Web Audio API, MediaRecorder, AudioWorklet

## 📦 Installation

### As NPM Package

```bash
npm install susurro-whisper-nextjs
# or
yarn add susurro-whisper-nextjs
# or
pnpm add susurro-whisper-nextjs
```

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/susurro.git
cd susurro

# Install dependencies
npm install

# Build the library
npm run build-lib

# Run development server (for demo)
npm run dev
```

## 🚀 Quick Start

### Basic File Processing

```tsx
import { useSusurro } from 'susurro'

function AudioProcessor() {
  const { 
    processAudioFile, 
    transcriptions, 
    isProcessing,
    whisperReady 
  } = useSusurro()

  const handleFileUpload = async (file: File) => {
    await processAudioFile(file)
    // Transcriptions will be available in the transcriptions array
  }

  return (
    <div>
      {whisperReady ? 'Ready to process!' : 'Loading models...'}
      {transcriptions.map((t, i) => (
        <p key={i}>{t.text}</p>
      ))}
    </div>
  )
}
```

### 🆕 ChatGPT-Style Conversational Mode

```tsx
import { useSusurro, SusurroChunk } from 'susurro'

function ConversationalApp() {
  const [messages, setMessages] = useState<Array<{
    audioUrl: string
    text: string
    timestamp: number
  }>>([])

  const { processAudioFile } = useSusurro({
    // Enable conversational mode
    conversational: {
      onChunk: (chunk: SusurroChunk) => {
        // Each chunk is a complete audio+transcript message
        setMessages(prev => [...prev, {
          audioUrl: chunk.audioUrl,
          text: chunk.transcript,
          timestamp: chunk.startTime
        }])
      },
      enableInstantTranscription: true, // Real-time processing
      chunkTimeout: 5000 // Max 5s wait for transcript
    }
  })

  return (
    <div className="chat-interface">
      {messages.map((msg, i) => (
        <div key={i} className="message">
          <audio src={msg.audioUrl} controls />
          <p>{msg.text}</p>
          <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
        </div>
      ))}
    </div>
  )
}
```

### Advanced Conversational Configuration

```tsx
const { processAudioFile, conversationalChunks } = useSusurro({
  // Audio processing settings
  chunkDurationMs: 6000,    // 6-second chunks for conversations
  enableVAD: true,          // Voice activity detection
  
  // Whisper configuration
  whisperConfig: {
    language: 'en',
    model: 'whisper-1'
  },
  
  // Conversational features
  conversational: {
    onChunk: (chunk: SusurroChunk) => {
      console.log(`Processing latency: ${chunk.processingLatency}ms`)
      console.log(`VAD confidence: ${chunk.vadScore}`)
      console.log(`Complete: ${chunk.isComplete}`)
      
      // Send to your chat system, AI assistant, etc.
      sendToChatBot(chunk.transcript, chunk.audioUrl)
    },
    enableInstantTranscription: true,
    chunkTimeout: 3000,
    enableChunkEnrichment: true
  }
})
```

Open [http://localhost:3000](http://localhost:3000) to see the demo application

## 🎨 Features Breakdown

### File Upload
- Support for WAV audio files
- Drag-and-drop or click to upload
- Instant transcription processing

### Sample Audio
- Pre-loaded sample.wav for testing
- One-click loading and transcription

## 🔧 Advanced Configuration

### SusurroChunk Interface

```typescript
interface SusurroChunk {
  id: string;                // Unique chunk identifier
  audioUrl: string;          // Clean neural-processed audio (Blob URL)
  transcript: string;        // AI-transcribed text 
  startTime: number;         // Start time in milliseconds
  endTime: number;           // End time in milliseconds
  vadScore: number;          // Voice activity confidence (0-1)
  isComplete: boolean;       // Both audio + transcript ready
  processingLatency?: number; // Time to process in milliseconds
}
```

### Conversational Options

```typescript
interface ConversationalOptions {
  onChunk?: (chunk: SusurroChunk) => void;  // Real-time chunk callback
  enableInstantTranscription?: boolean;     // Transcribe as chunks arrive
  chunkTimeout?: number;                    // Max wait time for transcript (ms)
  enableChunkEnrichment?: boolean;          // Allow processing hooks
}
```

### Performance Optimization

- **Target Latency**: <300ms audio-to-emit
- **Memory Management**: Automatic cleanup of old chunks
- **Parallel Processing**: Audio enhancement + transcription run simultaneously
- **Race Condition Handling**: Safe concurrent operations
- **Timeout Protection**: Configurable chunk emission timeouts

## 🏗️ Architecture

### Dual Async Processing Pipeline

```
Audio File → Murmuraba Processing → Clean Audio Chunks
     ↓              ↓                      ↓
Whisper AI → Transcription Engine → Text Output
     ↓              ↓                      ↓
SusurroChunk Emitter → onChunk Callback → Your App
```

### Package Structure

```
susurro/
├── packages/susurro/          # Core library
│   ├── src/
│   │   ├── hooks/
│   │   │   ├── useSusurro.ts     # Main hook with conversational features
│   │   │   └── useTranscription.ts # Whisper integration
│   │   ├── lib/
│   │   │   ├── types.ts          # SusurroChunk & interfaces
│   │   │   └── murmuraba-singleton.ts # Audio processing
│   │   └── index.ts
│   └── package.json
├── src/                       # Demo application
│   ├── features/
│   │   ├── audio-processing/
│   │   ├── navigation/
│   │   ├── ui/
│   │   └── visualization/
│   └── components/
└── docs/                      # Documentation
```

## 🚢 Deployment

The app is ready for deployment on Vercel:

```bash
# Build for production
npm run build

# Start production server
npm start
```

Or deploy directly to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/susurro)

## 📄 License

MIT License - feel free to use this project for your own purposes.

## 🔮 Use Cases

### Real-time Voice Chat Applications
```tsx
// Process voice messages as they arrive
conversational: {
  onChunk: (chunk) => {
    // Send to WebSocket, store in chat, trigger AI response
    sendVoiceMessage(chunk.audioUrl, chunk.transcript)
  }
}
```

### Voice-to-Text Transcription Services
```tsx
// Batch process audio files with real-time feedback
conversational: {
  onChunk: (chunk) => {
    updateTranscriptionProgress(chunk.startTime, chunk.transcript)
  }
}
```

### AI Voice Assistants
```tsx
// Build ChatGPT-style voice interfaces
conversational: {
  onChunk: async (chunk) => {
    const aiResponse = await openai.chat.completions.create({
      messages: [{ role: 'user', content: chunk.transcript }]
    })
    speakResponse(aiResponse.choices[0].message.content)
  }
}
```

## 🙏 Acknowledgments

- **OpenAI** for the Whisper model architecture
- **Xenova** for Transformers.js browser implementation  
- **Murmuraba** for neural audio processing technology
- **The Matrix** for cyberpunk UI inspiration
- **Web Audio API** community for advanced audio processing

---

Built with 🧠 Neural Intelligence • Made with 💚 Open Source