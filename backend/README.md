# Susurro Whisper Backend

FastAPI backend for Whisper speech-to-text transcription, optimized for Render.com's free tier (512MB RAM limit).

## Features

- **Whisper Tiny Model**: Ultra-fast, multilingual transcription (~39MB model)
- **Memory Optimized**: Uses faster-whisper with int8 quantization (~150-200MB total RAM)
- **Free Tier Ready**: Specifically designed for Render.com's 512MB limit
- **Auto CORS**: Preconfigured for Netlify, Vercel, and custom domains
- **Health Monitoring**: Built-in health checks and status endpoints
- **Error Handling**: Robust error handling with detailed error messages
- **File Format Support**: WAV, MP3, M4A, FLAC, OGG, WebM (up to 25MB)

## Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Run the server:**
   ```bash
   python main.py
   ```

3. **Test the API:**
   ```bash
   # Health check
   curl http://localhost:8000/health

   # Test transcription
   curl -X POST "http://localhost:8000/transcribe" \
     -F "audio=@test.wav" \
     -F "language=es"
   ```

### Deploy to Render.com

1. **Push code to GitHub**
2. **Create new Web Service on Render**
3. **Configure:**
   - Environment: Python 3
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `python main.py`
   - Root Directory: `backend`

4. **Set Environment Variables:**
   ```
   PYTHON_VERSION=3.11.0
   FRONTEND_URL=https://your-frontend.netlify.app
   ```

5. **Deploy** and wait 3-5 minutes for model download

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## API Endpoints

### `GET /`
API information and status
```json
{
  "name": "Susurro Whisper Backend",
  "version": "1.0.0",
  "model": "whisper-tiny",
  "endpoints": { ... },
  "supported_formats": ["wav", "mp3", "m4a", "flac", "ogg", "webm"],
  "max_file_size": "25MB"
}
```

### `GET /health`
Health check for monitoring
```json
{
  "status": "healthy",
  "model_status": "loaded",
  "implementation": "faster-whisper",
  "model_size": "tiny",
  "memory_optimized": true
}
```

### `POST /transcribe`
Transcribe audio file

**Parameters:**
- `audio` (file): Audio file to transcribe
- `language` (optional): Language code (e.g., 'en', 'es', 'fr') or auto-detect
- `response_format` (optional): 'text' or 'detailed' (default)

**Response:**
```json
{
  "text": "Transcribed text here",
  "segments": [
    {
      "start": 0.0,
      "end": 2.5,
      "text": "Hello world"
    }
  ],
  "language": "en",
  "language_probability": 0.95,
  "duration": 5.2,
  "model": "whisper-tiny"
}
```

### `GET /models`
Available models information
```json
{
  "current_model": "tiny",
  "available_models": ["tiny"],
  "model_info": {
    "tiny": {
      "size": "~39MB",
      "parameters": "39M",
      "relative_speed": "~32x",
      "multilingual": true
    }
  }
}
```

## Performance

### Benchmarks (Render.com Free Tier)
- **Cold Start**: 30-60 seconds (after inactivity)
- **Model Loading**: 1-2 minutes (first deployment)
- **Transcription**: 2-8 seconds (typical audio files)
- **Memory Usage**: 150-200MB peak
- **Supported Languages**: 100+ (Whisper multilingual)

### Optimization Features
- **faster-whisper**: 4-8x less memory, 2-4x faster than openai-whisper
- **int8 quantization**: ~75% memory reduction
- **Single worker**: Memory-optimized for free tier
- **Background cleanup**: Automatic garbage collection
- **VAD filtering**: Voice activity detection for better accuracy

## Frontend Integration

Use the provided frontend service to integrate with your React app:

```javascript
// Install and import
import { whisperBackend, transcribeAudio } from './services/whisper-backend';

// Auto-detect and transcribe
const result = await transcribeAudio(audioBlob, {
  language: 'es',
  responseFormat: 'detailed',
  onProgress: (progress) => console.log(`${progress}%`)
});

console.log(result.text); // Transcribed text
```

Or use the Enhanced Context for seamless integration:

```jsx
import { EnhancedWhisperProvider, useEnhancedWhisper } from './contexts/EnhancedWhisperContext';

function App() {
  return (
    <EnhancedWhisperProvider defaultTranscriptionMethod="auto">
      <TranscriptionComponent />
    </EnhancedWhisperProvider>
  );
}

function TranscriptionComponent() {
  const { transcribeWithEnhancedWhisper, backendStatus } = useEnhancedWhisper();

  const handleAudio = async (audioBlob) => {
    const result = await transcribeWithEnhancedWhisper(audioBlob, {
      language: 'es',
      responseFormat: 'detailed'
    });
    console.log(result.text);
  };

  return <div>Backend: {backendStatus}</div>;
}
```

## Testing

Test your deployment:

```bash
# Test local backend
python test_backend.py --local

# Test remote backend
python test_backend.py https://your-backend.onrender.com
```

## Troubleshooting

### Common Issues

**"Model not initialized"**
- Wait 30-60 seconds after cold start
- Check `/health` endpoint for model status

**CORS errors**
- Verify `FRONTEND_URL` environment variable
- Ensure your domain is properly configured

**Memory errors**
- Confirm using tiny model (not larger ones)
- Restart service if needed

**Timeout errors**
- Free tier has 60-second timeout
- Implement proper error handling in frontend

### Debug Mode

Add environment variables for debugging:
```
LOG_LEVEL=DEBUG
PYTHONUNBUFFERED=1
```

## Monitoring

### Health Checks
- Endpoint: `https://your-backend.onrender.com/health`
- Use UptimeRobot or similar for monitoring
- Render provides built-in health monitoring

### Metrics to Track
- Response time (target: <10s)
- Error rate (target: <5%)
- Memory usage (target: <400MB)
- Cold start frequency

### Keeping Warm
Prevent cold starts with periodic health checks:
```bash
# Every 10 minutes (add to your frontend or external service)
curl https://your-backend.onrender.com/health
```

## Scaling

### Free Tier Limits
- 512MB RAM (perfect for tiny model)
- Sleeps after 15 minutes of inactivity
- 750 hours/month runtime
- Single concurrent request

### Upgrade Path
- **Starter ($7/month)**: No sleep, 512MB persistent
- **Professional ($25/month)**: More CPU/RAM, better performance

## Security

### Environment Variables
Never commit sensitive data. Use Render's environment variable system:
- `FRONTEND_URL`: Your frontend domain
- `API_KEY`: Optional API key for authentication
- `LOG_LEVEL`: Control logging verbosity

### CORS Security
The backend allows these origins by default:
- Development servers (localhost)
- Netlify deployments (*.netlify.app)
- Vercel deployments (*.vercel.app)
- Your configured `FRONTEND_URL`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Test your changes locally
4. Submit a pull request

## License

This project is part of the Susurro ecosystem. See the main repository for license information.

## Support

- 📖 [Full Deployment Guide](DEPLOYMENT.md)
- 🧪 [Test Script](test_backend.py)
- 🐛 Issues: Open an issue in the main repository
- 💬 Discussions: Use GitHub Discussions for questions