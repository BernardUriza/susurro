# 🚀 Netlify Deployment Guide

Complete guide to deploy Susurro Transcription Studio on Netlify with serverless backend.

## 📋 Prerequisites

- Netlify account ([sign up here](https://app.netlify.com/signup))
- GitHub repository with your code
- Deepgram API key ([get one here](https://console.deepgram.com/))
- Anthropic (Claude) API key (optional, [get one here](https://console.anthropic.com/))

## 🎯 Quick Deploy

### Option 1: Deploy Button (Easiest)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy)

### Option 2: Manual Deployment

1. **Connect Repository**
   ```bash
   # Push your code to GitHub
   git add .
   git commit -m "Ready for Netlify deployment"
   git push origin main
   ```

2. **Create New Site on Netlify**
   - Go to [Netlify Dashboard](https://app.netlify.com/)
   - Click "Add new site" → "Import an existing project"
   - Choose GitHub and select your repository
   - Netlify will auto-detect the configuration from `netlify.toml`

3. **Configure Environment Variables**

   Go to Site Settings → Environment Variables and add:

   | Variable Name | Value | Required |
   |--------------|-------|----------|
   | `VITE_DEEPGRAM_API_KEY` | Your Deepgram API key | ✅ Yes |
   | `VITE_ANTHROPIC_API_KEY` | Your Claude API key | ⚠️ Optional |
   | `NODE_VERSION` | `20.19.0` | ✅ Yes |

4. **Deploy!**
   - Click "Deploy site"
   - Wait for build to complete (~3-5 minutes)
   - Your site is live! 🎉

## 🔧 Configuration Details

### Build Settings

The `netlify.toml` file configures:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20.19.0"
```

### Headers Configuration

Critical headers for WebGPU and security:

- **CORS for WebGPU**: `Cross-Origin-Embedder-Policy` and `Cross-Origin-Opener-Policy`
- **Security**: X-Frame-Options, CSP, etc.
- **Performance**: Cache control for static assets
- **Permissions**: Microphone access policy

### Serverless Functions

Two Netlify Functions are deployed:

#### 1. `/.netlify/functions/deepgram-transcribe`
Proxies audio to Deepgram API for transcription.

**Request**:
```bash
POST /.netlify/functions/deepgram-transcribe
Content-Type: audio/wav

<binary audio data>
```

**Response**:
```json
{
  "success": true,
  "transcript": "Hola, esto es una prueba.",
  "confidence": 0.95,
  "model": "deepgram-nova-2"
}
```

#### 2. `/.netlify/functions/claude-refine`
Refines dual transcriptions using Claude AI.

**Request**:
```bash
POST /.netlify/functions/claude-refine
Content-Type: application/json

{
  "web_speech_text": "hola esto es una prueba",
  "deepgram_text": "Hola, esto es una prueba.",
  "language": "es"
}
```

**Response**:
```json
{
  "success": true,
  "refined_text": "Hola, esto es una prueba.",
  "confidence": 0.95,
  "model": "claude-3-5-sonnet-20241022"
}
```

## 🌍 Environment Variables

### Development (`.env.local`)

```bash
# Copy the example file
cp .env.example .env.local

# Edit with your keys
VITE_DEEPGRAM_API_KEY=your_key_here
VITE_ANTHROPIC_API_KEY=your_key_here
VITE_DEEPGRAM_BACKEND_URL=http://localhost:8001
```

### Production (Netlify Dashboard)

Set these in Netlify UI → Site Settings → Environment Variables:

```
VITE_DEEPGRAM_API_KEY=dgsk_abc123...
VITE_ANTHROPIC_API_KEY=sk-ant-abc123...
```

**Important**: Do NOT commit `.env.local` to git!

## 🔐 Security Best Practices

### 1. API Key Management

- ✅ **Store in Netlify Environment Variables** - Never in code
- ✅ **Use Netlify Functions** - Hide keys from client
- ✅ **Rotate regularly** - Change keys periodically
- ❌ **Never commit** - Add `.env.local` to `.gitignore`

### 2. Domain Security

```toml
# netlify.toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    Content-Security-Policy = "default-src 'self'; ..."
```

### 3. Rate Limiting

Consider adding rate limiting to Netlify Functions:

```typescript
// netlify/functions/deepgram-transcribe.ts
import rateLimit from 'lambda-rate-limiter';

const limiter = rateLimit({
  interval: 60000, // 1 minute
  uniqueTokenPerInterval: 500,
});

export const handler = async (event) => {
  try {
    await limiter.check(100, event.headers['x-forwarded-for']);
    // ... rest of function
  } catch {
    return { statusCode: 429, body: 'Rate limit exceeded' };
  }
};
```

## 🚀 Performance Optimization

### 1. Asset Caching

Static assets are cached for 1 year:

```toml
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### 2. WASM Optimization

WASM files (Murmuraba) are cached and served with correct MIME type:

```toml
[[headers]]
  for = "/wasm/*.wasm"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
    Content-Type = "application/wasm"
```

### 3. Code Splitting

Vite automatically splits code into optimized chunks:
- `react-*.js` - React library
- `transformers-*.js` - Transformers.js
- `murmuraba-*.js` - Audio engine

### 4. PWA Support

Service Worker caches assets for offline use:
- First load: Downloads all assets
- Subsequent loads: Instant from cache
- Updates: Background sync

## 📊 Monitoring & Analytics

### Build Status

Monitor builds at: `https://app.netlify.com/sites/YOUR_SITE/deploys`

### Performance Monitoring

Netlify automatically runs Lighthouse checks:
- Performance score
- Accessibility
- Best practices
- SEO
- PWA score

### Function Logs

View serverless function logs:
```bash
netlify functions:log deepgram-transcribe
netlify functions:log claude-refine
```

## 🐛 Troubleshooting

### Build Failures

**Problem**: Build fails with "Module not found"
```bash
# Solution: Clear cache and rebuild
netlify build --clear-cache
```

**Problem**: Out of memory during build
```bash
# Solution: Increase Node memory in netlify.toml
[build.environment]
  NODE_OPTIONS = "--max_old_space_size=4096"
```

### Function Errors

**Problem**: "Deepgram API key not configured"
```bash
# Solution: Add environment variable in Netlify UI
VITE_DEEPGRAM_API_KEY=your_key
```

**Problem**: CORS errors
```bash
# Solution: Check headers in netlify.toml
Access-Control-Allow-Origin = "*"
```

### Runtime Errors

**Problem**: WebGPU not working
```bash
# Solution: Ensure COOP/COEP headers are set
Cross-Origin-Embedder-Policy = "credentialless"
Cross-Origin-Opener-Policy = "same-origin"
```

**Problem**: Microphone not accessible
```bash
# Solution: Must use HTTPS (Netlify provides this automatically)
```

## 🔄 CI/CD Workflow

Netlify automatically deploys on:

- **Main branch push** → Production deployment
- **Pull request** → Deploy preview
- **Other branches** → Branch deployment

### Deploy Preview

Every PR gets a unique URL:
```
https://deploy-preview-123--your-site.netlify.app
```

### Rollback

Instant rollback to previous deploy:
```bash
netlify rollback
```

## 📈 Scaling

### Free Tier Limits

- **Bandwidth**: 100GB/month
- **Build minutes**: 300 minutes/month
- **Serverless functions**: 125K requests/month
- **Function duration**: 10 seconds max

### Upgrade Path

For production apps:
- **Pro** ($19/month): 1TB bandwidth, unlimited builds
- **Business** ($99/month): Advanced features, priority support

## 🌐 Custom Domain

### Add Domain

1. Go to Domain Settings
2. Click "Add custom domain"
3. Follow DNS configuration steps
4. Wait for SSL certificate (automatic)

### Example:
```
susurro.yourdomain.com → Netlify site
```

## ✅ Pre-deploy Checklist

- [ ] All tests passing (`npm run test:all`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] Environment variables configured
- [ ] `.gitignore` includes `.env.local`
- [ ] README updated with deployment URL
- [ ] Lighthouse scores > 90

## 📚 Resources

- [Netlify Documentation](https://docs.netlify.com/)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html#netlify)
- [Deepgram API Docs](https://developers.deepgram.com/)
- [Anthropic Claude API](https://docs.anthropic.com/)

---

**Need help?** Open an issue on GitHub or check [Netlify Support](https://www.netlify.com/support/)
