# ⚡ Susurro Audio - Quick Start Guide

Get voice transcription working in **under 60 seconds**.

## 🎯 The Fastest Path to Voice

### Step 1: Install (10 seconds)

```bash
npm install susurro-audio react murmuraba @xenova/transformers
```

### Step 2: Copy & Paste (20 seconds)

```tsx
import { useSusurro } from 'susurro-audio';
import { useState } from 'react';

function App() {
  const [messages, setMessages] = useState([]);
  
  const { isRecording, startRecording, stopRecording } = useSusurro({
    conversational: {
      onChunk: (chunk) => {
        // This is where the magic happens!
        setMessages(prev => [...prev, {
          text: chunk.transcript,
          audio: chunk.audioUrl
        }]);
      }
    }
  });

  return (
    <div>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? '🔴 Stop' : '🎙️ Start'} Recording
      </button>
      
      {messages.map((msg, i) => (
        <div key={i}>
          <audio src={msg.audio} controls />
          <p>{msg.text}</p>
        </div>
      ))}
    </div>
  );
}

export default App;
```

### Step 3: Run (30 seconds)

```bash
npm run dev
```

**That's it!** You now have:
- 🎙️ Real-time audio recording
- 🤖 AI transcription with Whisper
- 🧠 Neural audio processing
- ⚡ <300ms latency
- 🎯 Voice Activity Detection

## 🔥 What Just Happened?

You just built what would normally take **500+ lines of code**:

1. **Audio Capture** - No MediaRecorder boilerplate
2. **Neural Processing** - Automatic noise reduction
3. **AI Transcription** - Whisper model running locally
4. **Real-time Streaming** - Chunks arrive as you speak
5. **Memory Management** - Automatic cleanup

## 📚 Next Steps

### Want ChatGPT-style conversations?

```tsx
const { startRecording, stopRecording } = useSusurro({
  conversational: {
    onChunk: async (chunk) => {
      // Send to OpenAI
      const response = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: chunk.transcript })
      });
      const { reply } = await response.json();
      
      // Add both to chat
      addMessage({ role: 'user', content: chunk.transcript });
      addMessage({ role: 'assistant', content: reply });
    }
  }
});
```

### Want live transcription display?

```tsx
const { startRecording, averageVad } = useSusurro({
  chunkDurationMs: 1000, // 1-second chunks
  conversational: {
    onChunk: (chunk) => {
      // Append to live transcript
      setTranscript(prev => prev + ' ' + chunk.transcript);
      
      // Show voice activity
      setVadLevel(chunk.vadScore);
    }
  }
});
```

### Want voice commands?

```tsx
const COMMANDS = {
  'play music': () => spotify.play(),
  'lights on': () => smartHome.lightsOn(),
  'send message': (text) => sms.send(text)
};

const { startRecording } = useSusurro({
  conversational: {
    onChunk: (chunk) => {
      const command = parseCommand(chunk.transcript);
      if (COMMANDS[command]) {
        COMMANDS[command]();
      }
    }
  }
});
```

## 🎨 Minimal Styling

Want it to look good? Here's minimal CSS:

```css
/* App.css */
.app {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

.record-button {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 50px;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.3s;
}

.record-button.recording {
  background: #ef4444;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.message {
  background: #f3f4f6;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
}

.message audio {
  width: 100%;
  margin-top: 0.5rem;
}
```

## 🚨 Common Issues & Solutions

### Issue: "Microphone access denied"

```tsx
const { startRecording } = useSusurro({
  onError: (error) => {
    if (error.name === 'NotAllowedError') {
      alert('Please allow microphone access');
    }
  }
});
```

### Issue: "Whisper model loading slowly"

```tsx
const { whisperReady, whisperProgress } = useSusurro();

// Show loading progress
{!whisperReady && (
  <div>Loading AI model: {(whisperProgress * 100).toFixed(0)}%</div>
)}
```

### Issue: "Chunks not arriving"

```tsx
const { startRecording } = useSusurro({
  conversational: {
    onChunk: (chunk) => console.log('Chunk received:', chunk),
    enableInstantTranscription: true, // Make sure this is true
    chunkTimeout: 5000 // Increase timeout if needed
  },
  debug: true // Enable debug logging
});
```

## 🎯 Configuration Cheat Sheet

```tsx
const { startRecording } = useSusurro({
  // Audio Settings
  chunkDurationMs: 3000,        // How long each chunk is (ms)
  overlapMs: 500,               // Overlap between chunks
  
  // Whisper Settings
  whisperConfig: {
    model: 'Xenova/whisper-tiny', // Model size (tiny/base/small)
    language: 'en',                // Language code
    temperature: 0.2               // Randomness (0-1)
  },
  
  // Conversational Mode (IMPORTANT!)
  conversational: {
    onChunk: (chunk) => {},        // Your callback function
    enableInstantTranscription: true, // Process immediately
    chunkTimeout: 5000,            // Max wait time
    enableChunkEnrichment: false   // Enable middleware
  },
  
  // Voice Activity Detection
  enableVAD: true,                // Enable VAD
  vadThreshold: 0.5               // Sensitivity (0-1)
});
```

## 📊 Performance Tips

### For Chat Apps
```tsx
{ chunkDurationMs: 2000 } // 2-second chunks
```

### For Transcription
```tsx
{ chunkDurationMs: 5000 } // 5-second chunks
```

### For Voice Commands
```tsx
{ chunkDurationMs: 1000 } // 1-second chunks
```

### For Voice Notes
```tsx
{ chunkDurationMs: 15000 } // 15-second chunks
```

## 🔗 Links

- [Full Documentation](./README.md)
- [API Reference](./README.md#api-reference)
- [Examples](./EXAMPLES.md)
- [Contributing](../CONTRIBUTING.md)
- [Discord Community](https://discord.gg/susurro)

## 🎉 You're Ready!

You now have everything you need to build voice-powered apps. 

**What will you build?** 🚀

---

*Stuck? Join our [Discord](https://discord.gg/susurro) for instant help!*