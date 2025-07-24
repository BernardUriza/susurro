# Susurro - Whisper AI Voice Transcription

A sleek, Matrix-themed web application for real-time voice transcription using OpenAI's Whisper model through Transformers.js.

**Working Commit ID**: `f8d559d3d7c3c69fde502fa48ac3ea94ad03402b`

## 🎯 Features

- **WAV file upload and processing** support
- **Matrix-inspired cyberpunk UI** with green-on-black aesthetics
- **Direct Whisper model implementation** (no workers needed)
- **Multiple language support** (configured for English by default)
- **Smooth animations and transitions**
- **Progressive model loading** with visual feedback

## 🚀 Technology Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety and better DX
- **Transformers.js** - Run Whisper AI models directly in the browser
- **SweetAlert2** - Beautiful alert dialogs
- **CSS-in-JS** - Custom Matrix-themed styling

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

```tsx
import { useWhisper } from 'susurro-whisper-nextjs'
import 'susurro-whisper-nextjs/dist/styles.css'

function MyComponent() {
  const { 
    transcribeAudio, 
    isTranscribing, 
    modelReady 
  } = useWhisper({ language: 'english' })

  const handleFileUpload = async (file: File) => {
    const result = await transcribeAudio(file)
    if (result) {
      console.log('Transcription:', result.text)
    }
  }

  return (
    <div>
      {modelReady ? 'Ready to transcribe!' : 'Loading model...'}
    </div>
  )
}
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

## 🔧 Configuration

The application uses the `Xenova/whisper-tiny` model for fast performance. You can modify the language settings in:

```typescript
// app/page.tsx
const { transcribeAudio } = useWhisper({ language: 'english' })
```

## 🏗️ Project Structure

```
susurro/
├── app/
│   ├── page.tsx          # Main application page
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── src/
│   ├── components/
│   │   ├── WhisperRecorder.tsx    # Recording component
│   │   └── styles.css             # Component styles
│   ├── hooks/
│   │   └── useWhisperDirect.ts    # Whisper hook implementation
│   └── lib/
│       └── types.ts               # TypeScript types
├── public/
│   └── sample.wav                 # Sample audio file
└── package.json
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

## 🙏 Acknowledgments

- OpenAI for the Whisper model
- Xenova for Transformers.js
- The Matrix for the UI inspiration

---

Made with 💚