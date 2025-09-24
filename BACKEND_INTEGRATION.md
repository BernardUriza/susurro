# Backend Integration Guide

This guide shows how to integrate the Whisper backend with your existing Susurro frontend.

## Quick Integration

### 1. Environment Setup

Add to your `.env` file:

```env
# Backend Configuration
VITE_WHISPER_BACKEND_URL=https://your-backend.onrender.com
VITE_FORCE_BACKEND=false    # Set to 'true' to force backend usage
VITE_FORCE_CLIENT=false     # Set to 'true' to force client-side processing
```

### 2. Update Your App Component

Replace your existing WhisperProvider with the EnhancedWhisperProvider:

```tsx
// src/App.tsx
import { EnhancedWhisperProvider } from './contexts/EnhancedWhisperContext';

function App() {
  return (
    <EnhancedWhisperProvider
      initialModel="tiny"
      defaultTranscriptionMethod="auto"
      onWhisperProgressLog={(message, type) => {
        console.log(`[${type}] ${message}`);
      }}
    >
      {/* Your existing app content */}
      <YourExistingComponents />
    </EnhancedWhisperProvider>
  );
}

export default App;
```

### 3. Update Components Using Whisper

In any component that uses transcription:

```tsx
// Before
import { useWhisper } from './contexts/WhisperContext';

// After
import { useEnhancedWhisper } from './contexts/EnhancedWhisperContext';

function TranscriptionComponent() {
  // Replace useWhisper with useEnhancedWhisper
  const {
    transcribeWithEnhancedWhisper,  // New enhanced method
    backendStatus,                   // Backend availability status
    transcriptionMethod,             // Current transcription method
    setTranscriptionMethod,          // Switch between methods
    // ... all other existing methods remain the same
    isRecording,
    startRecording,
    stopRecording,
    transcriptions
  } = useEnhancedWhisper();

  const handleTranscribe = async (audioBlob: Blob) => {
    try {
      const result = await transcribeWithEnhancedWhisper(audioBlob, {
        language: 'es',
        responseFormat: 'detailed',
        onProgress: (progress) => {
          console.log(`Transcription progress: ${progress}%`);
        }
      });

      if (result) {
        console.log('Transcribed:', result.text);
        console.log('Segments:', result.segments);
      }
    } catch (error) {
      console.error('Transcription failed:', error);
    }
  };

  return (
    <div>
      <div>
        <strong>Backend Status:</strong> {backendStatus}
      </div>
      <div>
        <strong>Method:</strong> {transcriptionMethod.description}
      </div>

      {/* Optional: Method selector */}
      <select
        value={transcriptionMethod.type}
        onChange={(e) => setTranscriptionMethod(e.target.value as any)}
      >
        <option value="auto">Auto-detect best method</option>
        <option value="client">Client-side only</option>
        <option value="backend">Backend only</option>
      </select>

      {/* Your existing transcription UI */}
      <button
        onClick={handleTranscribe}
        disabled={!audioBlob}
      >
        Transcribe Audio
      </button>
    </div>
  );
}
```

## Advanced Usage

### File Processing with Backend

For processing uploaded audio files:

```tsx
import { useEnhancedWhisper } from './contexts/EnhancedWhisperContext';

function FileProcessor() {
  const { transcribeWithEnhancedWhisper } = useEnhancedWhisper();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Convert file to blob
      const audioBlob = new Blob([await file.arrayBuffer()], { type: file.type });

      // Transcribe with progress tracking
      const result = await transcribeWithEnhancedWhisper(audioBlob, {
        language: 'auto', // Auto-detect language
        responseFormat: 'detailed',
        onProgress: (progress) => {
          console.log(`Processing: ${progress}%`);
          // Update your UI progress bar
        }
      });

      console.log('File transcribed:', result.text);
    } catch (error) {
      console.error('File processing failed:', error);
    }
  };

  return (
    <input
      type="file"
      accept="audio/*"
      onChange={handleFileUpload}
    />
  );
}
```

### Backend Health Monitoring

Add a component to monitor backend health:

```tsx
import { useEnhancedWhisper } from './contexts/EnhancedWhisperContext';
import { useEffect, useState } from 'react';

function BackendStatus() {
  const {
    backendStatus,
    backendHealth,
    checkBackendHealth,
    isBackendAvailable
  } = useEnhancedWhisper();

  const [isChecking, setIsChecking] = useState(false);

  const refreshStatus = async () => {
    setIsChecking(true);
    await checkBackendHealth();
    setIsChecking(false);
  };

  return (
    <div className="backend-status">
      <h3>Backend Status</h3>

      <div>
        <strong>Status:</strong>
        <span className={`status ${backendStatus}`}>
          {backendStatus}
        </span>
      </div>

      {backendHealth && (
        <div>
          <div><strong>Model:</strong> {backendHealth.model_size}</div>
          <div><strong>Implementation:</strong> {backendHealth.implementation}</div>
          <div><strong>Optimized:</strong> {backendHealth.memory_optimized ? 'Yes' : 'No'}</div>
        </div>
      )}

      <button
        onClick={refreshStatus}
        disabled={isChecking}
      >
        {isChecking ? 'Checking...' : 'Refresh Status'}
      </button>

      <style jsx>{`
        .status {
          padding: 4px 8px;
          border-radius: 4px;
          margin-left: 8px;
        }
        .status.available { background: #d4edda; color: #155724; }
        .status.unavailable { background: #f8d7da; color: #721c24; }
        .status.checking { background: #fff3cd; color: #856404; }
        .status.unknown { background: #e2e3e5; color: #383d41; }
      `}</style>
    </div>
  );
}
```

## Deployment Configuration

### Netlify

Update your `netlify.toml`:

```toml
[build.environment]
  VITE_WHISPER_BACKEND_URL = "https://your-backend.onrender.com"
  VITE_FORCE_BACKEND = "false"
```

### Vercel

Update your `vercel.json` or environment variables in dashboard:

```json
{
  "env": {
    "VITE_WHISPER_BACKEND_URL": "https://your-backend.onrender.com",
    "VITE_FORCE_BACKEND": "false"
  }
}
```

## Error Handling

Implement comprehensive error handling:

```tsx
import { WhisperBackendError } from '../services/whisper-backend';

function TranscriptionWithErrorHandling() {
  const { transcribeWithEnhancedWhisper } = useEnhancedWhisper();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTranscribe = async (audioBlob: Blob) => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await transcribeWithEnhancedWhisper(audioBlob, {
        language: 'es',
        responseFormat: 'detailed',
        onProgress: (progress) => {
          // Update progress UI
        }
      });

      console.log('Success:', result.text);
    } catch (err) {
      if (err instanceof WhisperBackendError) {
        switch (err.status) {
          case 413:
            setError('File too large. Please use a smaller audio file (max 25MB).');
            break;
          case 408:
            setError('Request timed out. Please try again.');
            break;
          case 503:
            setError('Backend service is starting up. Please wait and try again.');
            break;
          default:
            setError(`Backend error: ${err.message}`);
        }
      } else {
        setError('Transcription failed. Please try again.');
      }
      console.error('Transcription error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {isLoading && (
        <div className="loading">
          🔄 Transcribing audio...
        </div>
      )}

      {/* Your transcription UI */}
    </div>
  );
}
```

## Migration Checklist

- [ ] Backend deployed to Render.com
- [ ] Environment variables configured
- [ ] Frontend updated to use EnhancedWhisperProvider
- [ ] Components updated to use useEnhancedWhisper
- [ ] Error handling implemented
- [ ] Backend health monitoring added
- [ ] Testing completed (local and production)
- [ ] Monitoring/alerts configured

## Testing

### Local Testing

1. **Start backend locally:**
   ```bash
   cd backend
   python main.py
   ```

2. **Set environment variable:**
   ```bash
   VITE_WHISPER_BACKEND_URL=http://localhost:8000
   ```

3. **Test your frontend:**
   ```bash
   npm run dev
   ```

### Production Testing

1. **Deploy backend to Render**
2. **Update frontend environment variables**
3. **Deploy frontend**
4. **Test end-to-end functionality**

## Performance Tips

### Optimization

- **File Size**: Keep audio files under 10MB for best performance
- **Format**: WAV files generally process faster than compressed formats
- **Language**: Specify language when known (faster than auto-detect)
- **Method**: Use 'auto' mode to automatically choose the best transcription method

### Monitoring

- Monitor backend response times
- Track error rates and types
- Set up alerts for backend downtime
- Implement fallback UI for when backend is unavailable

## Troubleshooting

### Common Issues

1. **CORS Errors**: Verify backend FRONTEND_URL matches your domain
2. **Timeout Errors**: Implement proper timeout handling and user feedback
3. **File Size Errors**: Validate file size before sending to backend
4. **Backend Unavailable**: Ensure fallback to client-side processing works

### Debug Mode

Add debug logging:

```typescript
// Enable debug logging
localStorage.setItem('susurro-debug', 'true');

// Check logs in browser console
```

This integration provides seamless fallback between backend and client-side processing, ensuring your app works reliably regardless of backend availability.