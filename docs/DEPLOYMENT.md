# Susurro Whisper Backend - Deployment Guide

Complete deployment guide for the Susurro Whisper backend on Render.com's free tier, optimized for 512MB RAM limit.

## Overview

This backend provides Whisper speech-to-text transcription as a REST API, specifically optimized for Render.com's free tier constraints:

- **Model**: Whisper Tiny (~39MB, multilingual)
- **Memory Usage**: ~150-200MB including Python overhead
- **Response Time**: ~2-8 seconds for typical audio files
- **Supported Formats**: WAV, MP3, M4A, FLAC, OGG, WebM
- **Max File Size**: 25MB

## Prerequisites

Before deploying, ensure you have:

1. **GitHub Account** - Code repository
2. **Render.com Account** - Free tier deployment platform
3. **Netlify/Vercel Account** - For frontend hosting (optional)

## Step 1: Prepare Your Repository

### 1.1 Repository Structure

Ensure your repository has this structure:

```
your-repo/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   ├── Dockerfile           # Container configuration
│   ├── render.yaml          # Render deployment config
│   ├── .env.example         # Environment variables template
│   ├── .gitignore           # Git ignore rules
│   └── DEPLOYMENT.md        # This file
└── (rest of your frontend code)
```

### 1.2 Environment Configuration

1. Copy `.env.example` to `.env` (for local development):
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Update the environment variables:
   ```env
   PORT=8000
   FRONTEND_URL=https://your-frontend-domain.netlify.app
   MODEL_DIR=./models
   LOG_LEVEL=INFO
   ```

### 1.3 Push to GitHub

Commit and push all backend files to your GitHub repository:

```bash
git add backend/
git commit -m "Add Whisper backend for Render deployment"
git push origin main
```

## Step 2: Deploy to Render.com

### 2.1 Manual Deployment (Recommended)

1. **Sign up/Login** to [Render.com](https://render.com/)

2. **Create New Web Service**:
   - Click "New +" → "Web Service"
   - Select "Build and deploy from a Git repository"
   - Connect your GitHub account and select your repository

3. **Configure Service Settings**:
   ```
   Name: susurro-whisper-backend
   Environment: Python 3
   Region: Oregon (or closest to your users)
   Branch: main
   Root Directory: backend
   ```

4. **Build & Deploy Commands**:
   ```
   Build Command: pip install -r requirements.txt
   Start Command: python main.py
   ```

5. **Environment Variables** (Add these in Render dashboard):
   ```
   PYTHON_VERSION = 3.11.0
   PORT = 8000
   MODEL_DIR = ./models
   FRONTEND_URL = https://your-actual-frontend-domain.com
   LOG_LEVEL = INFO
   ```

6. **Plan Selection**:
   - Choose **"Free"** plan (512MB RAM, sleeps after inactivity)

7. **Deploy**: Click "Create Web Service"

### 2.2 Infrastructure as Code (Alternative)

If you prefer using the included `render.yaml`:

1. Update `render.yaml` with your repository URL and frontend domain
2. In Render dashboard, go to "Blueprint" and connect your repository
3. Select the `render.yaml` file for automatic deployment

### 2.3 Monitor Deployment

1. **Build Logs**: Watch the build process in Render dashboard
2. **First Deployment**: Takes 3-5 minutes (model download)
3. **Health Check**: Verify at `https://your-backend-url.onrender.com/health`

Expected response:
```json
{
  "status": "healthy",
  "model_status": "loaded",
  "implementation": "faster-whisper",
  "model_size": "tiny",
  "memory_optimized": true
}
```

## Step 3: Test the Backend

### 3.1 API Endpoints

Your deployed backend will have these endpoints:

- `GET /` - API information and status
- `GET /health` - Health check (used by Render monitoring)
- `POST /transcribe` - Audio transcription (main endpoint)
- `GET /models` - Available models information

### 3.2 Test Transcription

Using curl:

```bash
# Test with audio file
curl -X POST "https://your-backend-url.onrender.com/transcribe" \
  -F "audio=@test-audio.wav" \
  -F "language=es" \
  -F "response_format=detailed"
```

Using JavaScript (fetch):

```javascript
const formData = new FormData();
formData.append('audio', audioBlob, 'audio.wav');
formData.append('language', 'es');
formData.append('response_format', 'detailed');

const response = await fetch('https://your-backend-url.onrender.com/transcribe', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result.text); // Transcribed text
```

### 3.3 Performance Notes

**Free Tier Limitations**:
- Cold starts: 30-60 seconds after inactivity
- Processing time: 2-8 seconds for typical audio
- Concurrent requests: 1 (single worker)

**Optimization Tips**:
- Keep requests under 25MB
- Use health checks to keep service warm
- Implement proper error handling in frontend

## Step 4: Frontend Integration

### 4.1 Environment Variables

Add to your frontend `.env` file:

```env
VITE_WHISPER_BACKEND_URL=https://your-backend-url.onrender.com
VITE_FORCE_BACKEND=false  # true to force backend usage
VITE_FORCE_CLIENT=false   # true to force client-side processing
```

### 4.2 Update Frontend Code

The frontend integration is provided through two files:

1. **Backend Service** (`src/services/whisper-backend.ts`)
   - Handles API communication
   - Provides error handling and retry logic
   - Manages file size validation

2. **Enhanced Context** (`src/contexts/EnhancedWhisperContext.tsx`)
   - Extends existing WhisperContext
   - Auto-detects backend availability
   - Provides fallback to client-side processing

### 4.3 Usage Example

Replace your existing WhisperProvider with EnhancedWhisperProvider:

```jsx
// Before
import { WhisperProvider } from './contexts/WhisperContext';

// After
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
      <YourAppComponents />
    </EnhancedWhisperProvider>
  );
}
```

Then use the enhanced hook:

```jsx
import { useEnhancedWhisper } from './contexts/EnhancedWhisperContext';

function TranscriptionComponent() {
  const {
    transcribeWithEnhancedWhisper,
    backendStatus,
    transcriptionMethod,
    setTranscriptionMethod
  } = useEnhancedWhisper();

  const handleTranscribe = async (audioBlob) => {
    try {
      const result = await transcribeWithEnhancedWhisper(audioBlob, {
        language: 'es',
        responseFormat: 'detailed',
        onProgress: (progress) => console.log(`Progress: ${progress}%`)
      });

      console.log('Transcription:', result.text);
    } catch (error) {
      console.error('Transcription failed:', error);
    }
  };

  return (
    <div>
      <p>Backend Status: {backendStatus}</p>
      <p>Method: {transcriptionMethod.description}</p>

      <select onChange={(e) => setTranscriptionMethod(e.target.value)}>
        <option value="auto">Auto-detect</option>
        <option value="client">Client-side only</option>
        <option value="backend">Backend only</option>
      </select>

      {/* Your transcription UI */}
    </div>
  );
}
```

## Step 5: Production Deployment

### 5.1 Domain Configuration

**Backend Domain**:
- Use the provided Render domain: `https://your-service-name.onrender.com`
- Optional: Configure custom domain in Render settings

**Frontend Domain**:
- Deploy to Netlify/Vercel with your backend URL configured
- Update CORS settings in backend if needed

### 5.2 CORS Configuration

The backend automatically allows these origins:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (Alternative dev server)
- `https://*.netlify.app` (Netlify deployments)
- `https://*.vercel.app` (Vercel deployments)
- Your custom `FRONTEND_URL` from environment variables

### 5.3 Monitoring

**Render Dashboard**:
- Monitor CPU/Memory usage
- Check deployment logs
- Set up notification alerts

**Health Monitoring**:
- Endpoint: `https://your-backend-url.onrender.com/health`
- Use external monitoring service (UptimeRobot, etc.)
- Configure frontend to check backend availability

### 5.4 Scaling Considerations

**Free Tier Limits**:
- 512MB RAM (sufficient for tiny model)
- Sleeps after 15 minutes of inactivity
- 750 hours/month runtime

**Upgrade Path**:
- **Starter Plan ($7/month)**: No sleep, faster response
- **Professional Plan ($25/month)**: More resources, better performance

## Step 6: Troubleshooting

### 6.1 Common Issues

**"Model not initialized" Error**:
- Wait 30-60 seconds after cold start
- Check health endpoint for model status
- Review build logs for download issues

**CORS Errors**:
- Verify `FRONTEND_URL` environment variable
- Check frontend domain matches CORS settings
- Ensure HTTPS is used in production

**Memory Errors**:
- Confirmed using tiny model (not base/small)
- Monitor memory usage in Render dashboard
- Restart service if needed

**Timeout Errors**:
- Free tier has 60-second request timeout
- Large files may need compression
- Implement proper error handling in frontend

### 6.2 Debug Commands

**Local Testing**:
```bash
# Run locally
cd backend
pip install -r requirements.txt
python main.py

# Test endpoints
curl http://localhost:8000/health
```

**Production Debugging**:
```bash
# Check logs in Render dashboard
# Monitor metrics
# Test with curl
curl https://your-backend-url.onrender.com/health
```

### 6.3 Performance Optimization

**Backend**:
- Use health checks to prevent cold starts
- Implement request queuing if needed
- Monitor and optimize memory usage

**Frontend**:
- Implement proper loading states
- Add timeout handling
- Use appropriate file size limits

## Step 7: Maintenance

### 7.1 Updates

**Backend Updates**:
1. Update code in repository
2. Push to main branch
3. Render automatically redeploys
4. Monitor deployment logs

**Dependency Updates**:
```bash
# Update requirements.txt
pip list --outdated
pip install --upgrade package-name
pip freeze > requirements.txt
```

### 7.2 Monitoring

**Key Metrics**:
- Response time (target: <10 seconds)
- Error rate (target: <5%)
- Memory usage (target: <400MB)
- Uptime (target: >99%)

**Alerts**:
- Set up Render notifications
- Monitor with external services
- Implement frontend fallback logic

### 7.3 Backup & Recovery

**Code Backup**:
- Repository is the source of truth
- Tag releases for rollback capability
- Document configuration changes

**Service Recovery**:
- Render handles infrastructure
- Service auto-restarts on failure
- Manual restart available in dashboard

## Conclusion

Your Susurro Whisper backend is now deployed and ready to handle transcription requests! The setup provides:

- ✅ Optimized for Render.com free tier
- ✅ Automatic model loading and caching
- ✅ Proper error handling and timeouts
- ✅ CORS configuration for web apps
- ✅ Health monitoring and status checks
- ✅ Frontend integration with fallback support

For questions or issues, check the troubleshooting section or review the deployment logs in your Render dashboard.

**Next Steps**:
1. Test your deployed backend thoroughly
2. Integrate with your frontend application
3. Monitor performance and usage
4. Consider upgrading to paid plan for production use