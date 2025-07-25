# @susurro/core

Audio processing and transcription library for web applications.

## Installation

```bash
npm install @susurro/core
```

## Peer Dependencies

```bash
npm install react murmuraba @xenova/transformers
```

## Usage

```typescript
import { useSusurro } from '@susurro/core';

function App() {
  const {
    isRecording,
    isProcessing,
    transcriptions,
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

## Features

- Audio recording from microphone
- File processing with automatic chunking
- Voice Activity Detection (VAD)
- Whisper-based transcription
- Real-time processing status
- TypeScript support

## API

### `useSusurro(options?)`

#### Options
- `chunkDurationMs?: number` - Duration of each audio chunk in milliseconds (default: 8000)
- `enableVAD?: boolean` - Enable Voice Activity Detection (default: true)
- `whisperConfig?: object` - Whisper configuration
  - `model?: string` - Whisper model to use (default: 'Xenova/whisper-tiny')
  - `language?: string` - Language for transcription (default: 'en')

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

## Publishing

```bash
cd packages/susurro
npm publish --access public
```