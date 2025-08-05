# 🎯 Susurro Audio - Production Examples

Real-world examples showing how to build voice-powered applications with Susurro Audio.

## Table of Contents
- [Quick Start](#quick-start)
- [Production Patterns](#production-patterns)
- [Advanced Use Cases](#advanced-use-cases)
- [Integration Examples](#integration-examples)
- [Performance Tips](#performance-tips)

## Quick Start

### Minimal Setup (3 lines!)

```typescript
import { useSusurro } from 'susurro-audio';

// That's it. You're recording with AI transcription.
const { startRecording } = useSusurro({
  conversational: { onChunk: chunk => console.log(chunk) }
});
```

## Production Patterns

### 1. The ChatGPT Pattern

This is how we build ChatGPT-style voice interfaces in production:

```typescript
import { useSusurro, SusurroChunk } from 'susurro-audio';
import { useState, useCallback } from 'react';

export function ChatGPTVoice() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleChunk = useCallback(async (chunk: SusurroChunk) => {
    // 1. Add user message immediately
    const userMsg: Message = {
      id: chunk.id,
      role: 'user',
      content: chunk.transcript,
      audioUrl: chunk.audioUrl,
      timestamp: chunk.startTime,
      vadScore: chunk.vadScore
    };
    
    setMessages(prev => [...prev, userMsg]);
    
    // 2. Get AI response
    if (chunk.transcript.trim()) {
      setIsProcessing(true);
      
      try {
        const response = await fetch('/api/openai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMsg].map(m => ({
              role: m.role,
              content: m.content
            }))
          })
        });
        
        const data = await response.json();
        
        // 3. Add AI response
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.content,
          timestamp: Date.now()
        }]);
        
        // 4. Optional: Convert AI response to speech
        if (data.audioUrl) {
          const audio = new Audio(data.audioUrl);
          await audio.play();
        }
      } finally {
        setIsProcessing(false);
      }
    }
  }, [messages]);
  
  const {
    isRecording,
    startRecording,
    stopRecording,
    whisperReady
  } = useSusurro({
    chunkDurationMs: 3000, // 3s chunks for conversational flow
    conversational: {
      onChunk: handleChunk,
      enableInstantTranscription: true,
      chunkTimeout: 2000
    }
  });
  
  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isProcessing && <TypingIndicator />}
      </div>
      
      <VoiceButton
        isRecording={isRecording}
        isReady={whisperReady}
        onToggle={isRecording ? stopRecording : startRecording}
      />
    </div>
  );
}
```

### 2. The Real-Time Transcription Pattern

Perfect for live captioning, meeting notes, or accessibility:

```typescript
import { useSusurro } from 'susurro-audio';

export function LiveTranscription() {
  const [fullTranscript, setFullTranscript] = useState('');
  const [currentSegment, setCurrentSegment] = useState('');
  const [speakers, setSpeakers] = useState<Map<string, string>>(new Map());
  
  const {
    isRecording,
    startRecording,
    stopRecording,
    averageVad
  } = useSusurro({
    chunkDurationMs: 2000, // 2s for near real-time
    conversational: {
      onChunk: (chunk) => {
        // Detect speaker changes based on silence gaps
        const speakerId = detectSpeaker(chunk);
        
        // Update current segment
        setCurrentSegment(chunk.transcript);
        
        // Append to full transcript with speaker labels
        setFullTranscript(prev => {
          const speaker = speakers.get(speakerId) || `Speaker ${speakerId}`;
          return `${prev}\n[${speaker}]: ${chunk.transcript}`;
        });
        
        // Optional: Send to backend for storage
        saveTranscriptSegment({
          speakerId,
          text: chunk.transcript,
          timestamp: chunk.startTime,
          audioUrl: chunk.audioUrl
        });
      },
      enableInstantTranscription: true
    }
  });
  
  return (
    <div className="transcription-app">
      <div className="live-indicator">
        {isRecording && (
          <>
            <span className="recording-dot" />
            LIVE • VAD: {(averageVad * 100).toFixed(0)}%
          </>
        )}
      </div>
      
      <div className="current-segment">
        {currentSegment || 'Waiting for speech...'}
      </div>
      
      <div className="full-transcript">
        <pre>{fullTranscript}</pre>
      </div>
      
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop' : 'Start'} Transcription
      </button>
    </div>
  );
}
```

### 3. The Voice Command Pattern

Build Siri/Alexa-style voice assistants:

```typescript
import { useSusurro } from 'susurro-audio';

const WAKE_WORDS = ['hey susurro', 'okay susurro', 'susurro'];
const COMMANDS = {
  'play music': () => playSpotify(),
  'what time is it': () => speakTime(),
  'turn on lights': () => smartHome.lights.on(),
  'send message': (params) => sendMessage(params)
};

export function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState('');
  
  const {
    startRecording,
    stopRecording
  } = useSusurro({
    chunkDurationMs: 1500, // Short chunks for commands
    conversational: {
      onChunk: async (chunk) => {
        const text = chunk.transcript.toLowerCase();
        
        // Check for wake word
        if (!isListening) {
          const hasWakeWord = WAKE_WORDS.some(word => 
            text.includes(word)
          );
          
          if (hasWakeWord) {
            setIsListening(true);
            playSound('listening.mp3');
            return;
          }
        }
        
        // Process command
        if (isListening) {
          const command = parseCommand(text);
          
          if (command && COMMANDS[command.action]) {
            setLastCommand(command.action);
            await COMMANDS[command.action](command.params);
            setIsListening(false);
            playSound('success.mp3');
          } else if (text.includes('cancel')) {
            setIsListening(false);
            playSound('cancelled.mp3');
          }
        }
      },
      enableInstantTranscription: true,
      chunkTimeout: 1000 // Fast timeout for commands
    }
  });
  
  // Auto-start listening
  useEffect(() => {
    startRecording();
    return () => stopRecording();
  }, []);
  
  return (
    <div className="voice-assistant">
      <div className={`orb ${isListening ? 'listening' : 'idle'}`} />
      <p>{isListening ? 'Listening...' : 'Say "Hey Susurro"'}</p>
      {lastCommand && <p>Last: {lastCommand}</p>}
    </div>
  );
}
```

### 4. The Voice Notes Pattern

Like Apple's Voice Memos but with automatic transcription:

```typescript
import { useSusurro, SusurroChunk } from 'susurro-audio';

interface VoiceNote {
  id: string;
  title: string;
  audioUrl: string;
  transcript: string;
  duration: number;
  createdAt: Date;
  tags: string[];
}

export function VoiceNotes() {
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [recording, setRecording] = useState<Partial<VoiceNote>>({});
  const [chunks, setChunks] = useState<SusurroChunk[]>([]);
  
  const {
    isRecording,
    startRecording,
    stopRecording
  } = useSusurro({
    chunkDurationMs: 30000, // 30s chunks for long notes
    conversational: {
      onChunk: (chunk) => {
        // Accumulate chunks
        setChunks(prev => [...prev, chunk]);
        
        // Update recording transcript
        setRecording(prev => ({
          ...prev,
          transcript: (prev.transcript || '') + ' ' + chunk.transcript
        }));
      },
      enableInstantTranscription: true
    }
  });
  
  const handleStart = () => {
    setRecording({
      id: crypto.randomUUID(),
      createdAt: new Date()
    });
    setChunks([]);
    startRecording();
  };
  
  const handleStop = async () => {
    stopRecording();
    
    // Merge all audio chunks
    const audioBlob = await mergeAudioChunks(chunks);
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Auto-generate title from first sentence
    const title = recording.transcript?.split('.')[0] || 'Untitled Note';
    
    // Extract tags from transcript
    const tags = extractTags(recording.transcript || '');
    
    const note: VoiceNote = {
      ...recording as VoiceNote,
      title,
      audioUrl,
      duration: chunks.reduce((acc, c) => acc + (c.endTime - c.startTime), 0),
      tags
    };
    
    // Save note
    setNotes(prev => [note, ...prev]);
    await saveToCloud(note);
    
    // Reset
    setRecording({});
    setChunks([]);
  };
  
  return (
    <div className="voice-notes">
      <RecordButton
        isRecording={isRecording}
        onStart={handleStart}
        onStop={handleStop}
      />
      
      {isRecording && (
        <div className="recording-preview">
          <Waveform />
          <p>{recording.transcript || 'Start speaking...'}</p>
        </div>
      )}
      
      <NotesList notes={notes} />
    </div>
  );
}
```

## Advanced Use Cases

### WebSocket Streaming

Stream chunks to other users in real-time:

```typescript
import { useSusurro } from 'susurro-audio';
import { useWebSocket } from 'react-use-websocket';

export function LiveBroadcast() {
  const { sendMessage, lastMessage } = useWebSocket('wss://api.example.com/broadcast');
  
  const { startRecording, stopRecording } = useSusurro({
    conversational: {
      onChunk: (chunk) => {
        // Stream to all connected clients
        sendMessage(JSON.stringify({
          type: 'audio_chunk',
          chunk: {
            audioUrl: chunk.audioUrl,
            transcript: chunk.transcript,
            timestamp: chunk.startTime,
            speakerId: getUserId()
          }
        }));
      },
      enableInstantTranscription: true
    }
  });
  
  // Handle incoming chunks from other users
  useEffect(() => {
    if (lastMessage) {
      const data = JSON.parse(lastMessage.data);
      if (data.type === 'audio_chunk' && data.speakerId !== getUserId()) {
        addRemoteChunk(data.chunk);
      }
    }
  }, [lastMessage]);
  
  return <BroadcastUI />;
}
```

### Multi-Modal AI Integration

Combine voice with vision AI:

```typescript
import { useSusurro } from 'susurro-audio';
import { useCamera } from './hooks/useCamera';

export function MultiModalAssistant() {
  const { captureImage } = useCamera();
  
  const { startRecording, stopRecording } = useSusurro({
    conversational: {
      onChunk: async (chunk) => {
        // Detect intent
        if (chunk.transcript.includes('what do you see')) {
          const image = await captureImage();
          const visionResponse = await analyzeImage(image);
          
          // Combine voice and vision context
          const response = await generateResponse({
            voiceInput: chunk.transcript,
            visionContext: visionResponse,
            audioUrl: chunk.audioUrl
          });
          
          speak(response);
        }
      }
    }
  });
  
  return <AssistantUI />;
}
```

### Accessibility Features

Make your app accessible with voice:

```typescript
import { useSusurro } from 'susurro-audio';

export function AccessibleForm() {
  const [formData, setFormData] = useState({});
  const [currentField, setCurrentField] = useState('name');
  
  const { startRecording } = useSusurro({
    conversational: {
      onChunk: (chunk) => {
        const text = chunk.transcript;
        
        // Voice navigation
        if (text.includes('next field')) {
          navigateToNextField();
        } else if (text.includes('previous field')) {
          navigateToPreviousField();
        } else if (text.includes('submit form')) {
          submitForm();
        } else {
          // Fill current field
          setFormData(prev => ({
            ...prev,
            [currentField]: text
          }));
        }
        
        // Announce changes for screen readers
        announceChange(`${currentField} set to ${text}`);
      }
    }
  });
  
  return <VoiceEnabledForm />;
}
```

## Integration Examples

### With Vercel AI SDK

```typescript
import { useSusurro } from 'susurro-audio';
import { useChat } from 'ai/react';

export function VercelAIVoice() {
  const { messages, append } = useChat();
  
  const { startRecording, stopRecording } = useSusurro({
    conversational: {
      onChunk: async (chunk) => {
        await append({
          role: 'user',
          content: chunk.transcript,
          metadata: { audioUrl: chunk.audioUrl }
        });
      }
    }
  });
  
  return <ChatUI messages={messages} />;
}
```

### With Supabase

```typescript
import { useSusurro } from 'susurro-audio';
import { supabase } from './lib/supabase';

export function SupabaseVoice() {
  const { startRecording } = useSusurro({
    conversational: {
      onChunk: async (chunk) => {
        // Upload audio to Supabase Storage
        const audioBlob = await fetch(chunk.audioUrl).then(r => r.blob());
        const { data: audioData } = await supabase.storage
          .from('voice-chunks')
          .upload(`${chunk.id}.webm`, audioBlob);
        
        // Save transcript to database
        await supabase.from('transcripts').insert({
          id: chunk.id,
          text: chunk.transcript,
          audio_url: audioData?.path,
          vad_score: chunk.vadScore,
          created_at: new Date(chunk.startTime)
        });
      }
    }
  });
  
  return <VoiceRecorder />;
}
```

### With Firebase

```typescript
import { useSusurro } from 'susurro-audio';
import { db, storage } from './lib/firebase';

export function FirebaseVoice() {
  const { startRecording } = useSusurro({
    conversational: {
      onChunk: async (chunk) => {
        // Upload to Firebase Storage
        const audioBlob = await fetch(chunk.audioUrl).then(r => r.blob());
        const storageRef = ref(storage, `audio/${chunk.id}.webm`);
        await uploadBytes(storageRef, audioBlob);
        const downloadUrl = await getDownloadURL(storageRef);
        
        // Save to Firestore
        await addDoc(collection(db, 'voiceChunks'), {
          transcript: chunk.transcript,
          audioUrl: downloadUrl,
          timestamp: serverTimestamp(),
          vadScore: chunk.vadScore
        });
      }
    }
  });
  
  return <VoiceChat />;
}
```

## Performance Tips

### 1. Optimize Chunk Size

```typescript
// For real-time chat: 2-3 seconds
const chatConfig = { chunkDurationMs: 2500 };

// For transcription: 5-10 seconds
const transcriptionConfig = { chunkDurationMs: 7500 };

// For voice notes: 15-30 seconds
const notesConfig = { chunkDurationMs: 20000 };
```

### 2. Handle Errors Gracefully

```typescript
const { startRecording } = useSusurro({
  conversational: {
    onChunk: async (chunk) => {
      try {
        await processChunk(chunk);
      } catch (error) {
        console.error('Chunk processing failed:', error);
        // Show user-friendly error
        showToast('Processing delayed, will retry');
        // Queue for retry
        queueForRetry(chunk);
      }
    }
  }
});
```

### 3. Implement Debouncing

```typescript
import { debounce } from 'lodash';

const debouncedSave = debounce(async (transcript) => {
  await saveTranscript(transcript);
}, 1000);

const { startRecording } = useSusurro({
  conversational: {
    onChunk: (chunk) => {
      updateUI(chunk); // Immediate
      debouncedSave(chunk.transcript); // Debounced
    }
  }
});
```

### 4. Memory Management

```typescript
export function LongRecordingSession() {
  const [recentChunks, setRecentChunks] = useState<SusurroChunk[]>([]);
  
  const { startRecording } = useSusurro({
    conversational: {
      onChunk: (chunk) => {
        // Keep only last 10 chunks in memory
        setRecentChunks(prev => [...prev.slice(-9), chunk]);
        
        // Clean up old audio URLs
        if (prev.length > 10) {
          URL.revokeObjectURL(prev[0].audioUrl);
        }
        
        // Stream to backend for permanent storage
        streamToBackend(chunk);
      }
    }
  });
  
  return <RecordingUI chunks={recentChunks} />;
}
```

### 5. Parallel Processing

```typescript
const { startRecording } = useSusurro({
  conversational: {
    onChunk: async (chunk) => {
      // Process in parallel, don't await sequentially
      await Promise.all([
        saveToDatabase(chunk),
        sendToAnalytics(chunk),
        updateUIState(chunk),
        triggerNotifications(chunk)
      ]);
    }
  }
});
```

## Testing

### Unit Testing with Vitest

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useSusurro } from 'susurro-audio';
import { vi } from 'vitest';

describe('useSusurro', () => {
  it('should handle chunks correctly', async () => {
    const onChunk = vi.fn();
    
    const { result } = renderHook(() => 
      useSusurro({
        conversational: { onChunk }
      })
    );
    
    await act(async () => {
      await result.current.startRecording();
    });
    
    // Simulate chunk arrival
    await act(async () => {
      await simulateAudioChunk();
    });
    
    expect(onChunk).toHaveBeenCalledWith(
      expect.objectContaining({
        audioUrl: expect.any(String),
        transcript: expect.any(String)
      })
    );
  });
});
```

---

**Ready to build?** Check out our [API Reference](./README.md#api-reference) or join our [Discord](https://discord.gg/susurro) for help!