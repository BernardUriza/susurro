# 📁 Estructura del Proyecto Susurro

## Árbol de Directorios

```
susurro/
│
├── 📦 packages/                    # Paquetes NPM publicables
│   └── susurro/                     # @susurro/core - Biblioteca principal
│       ├── src/
│       │   ├── hooks/               # React Hooks
│       │   │   ├── use-susurro.ts  # Hook principal con Whisper
│       │   │   └── use-latency-monitor.ts
│       │   ├── lib/                 # Utilidades core
│       │   │   ├── audio-engine-manager.ts
│       │   │   ├── backend-whisper.ts
│       │   │   ├── chunk-middleware.ts
│       │   │   ├── dynamic-loaders.ts
│       │   │   └── types.ts
│       │   └── index.ts             # Exports principales
│       ├── tests/                   # Tests unitarios
│       ├── package.json
│       └── tsup.config.ts
│
├── 🎨 src/                          # Aplicación demo/showcase
│   ├── app.tsx                      # Componente principal
│   ├── main.tsx                     # Entry point
│   ├── index.css                    # Estilos globales
│   │
│   ├── contexts/                    # React Contexts
│   │   ├── WhisperContext.tsx      # Contexto singleton para Whisper
│   │   └── EnhancedWhisperContext.tsx
│   │
│   ├── components/                  # Componentes UI reutilizables
│   │   ├── AudioProcessor/
│   │   ├── MatrixNavigation/
│   │   ├── MatrixScrollArea/
│   │   └── StatusIndicator/
│   │
│   ├── features/                    # Módulos de características
│   │   ├── audio-processing/        # Procesamiento de audio
│   │   │   └── components/
│   │   └── visualization/           # Visualización de datos
│   │       └── components/
│   │
│   └── services/                    # Servicios y APIs
│       └── whisper-backend.ts      # Integración con backend
│
├── 🌐 public/                       # Archivos estáticos
│   ├── sample.wav                   # Audio de ejemplo (JFK)
│   └── wasm/                        # WebAssembly files
│       └── rnnoise.wasm            # Reducción de ruido
│
├── 🔙 backend/                      # Backend para Whisper (Deploy en Render)
│   ├── main.py                      # API FastAPI principal
│   ├── requirements.txt             # Dependencias Python
│   ├── Dockerfile                   # Contenedor Docker
│   ├── render.yaml                  # Configuración Render.com
│   ├── README.md                    # Documentación del backend
│   └── .env.example                 # Variables de entorno ejemplo
│
├── 🧪 test/                         # Tests E2E
│   ├── audio-recording.test.ts
│   ├── transcription.test.ts
│   └── whisper-pipeline.test.ts
│
├── 📝 Configuración Root
│   ├── package.json                 # Dependencias y scripts
│   ├── vite.config.ts              # Configuración Vite
│   ├── tsconfig.json               # Configuración TypeScript
│   ├── vitest.config.ts            # Configuración tests
│   ├── .env.example                # Variables de entorno
│   ├── .gitignore
│   └── README.md                   # Documentación principal
│
└── 📚 Documentación
    ├── CLAUDE.md                   # Instrucciones para Claude AI
    ├── PROJECT_STRUCTURE.md       # Este archivo
    └── BACKEND_INTEGRATION.md     # Guía integración backend
```

## 🏗️ Arquitectura

### Frontend (React + Vite)
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **Whisper**: Transformers.js (navegador) o Backend API
- **Audio Engine**: Murmuraba v3 (WebAudio API)

### Backend (Python + FastAPI)
- **Framework**: FastAPI
- **Whisper**: faster-whisper (optimizado para CPU)
- **Deploy**: Render.com (free tier compatible)
- **Modelo**: Whisper Tiny (39MB)

### Paquete NPM (@susurro/core)
- **Publicado en**: NPM Registry
- **Build**: tsup (ESM + CJS)
- **Versión**: 2.1.1

## 📦 Scripts Principales

```bash
# Desarrollo
npm run dev              # Inicia app + watch del paquete

# Build
npm run build           # Build completo (app + lib)
npm run build-lib       # Build solo del paquete NPM

# Testing
npm test                # Ejecuta todos los tests
npm run test:e2e        # Tests end-to-end

# Calidad
npm run lint            # Linting con ESLint
npm run type-check      # Type checking con TypeScript

# Deploy Backend
cd backend
git push origin main    # Deploy automático en Render
```

## 🔧 Configuración Requerida

### Variables de Entorno (.env.local)
```bash
# Opcional: Backend de Whisper
VITE_WHISPER_BACKEND_URL=https://tu-api.onrender.com

# Opcional: Token Hugging Face
VITE_HUGGINGFACE_TOKEN=tu-token
```

### Instalación
```bash
# Instalar dependencias
npm install

# Copiar archivos WASM (automático con npm run dev)
npm run copy:wasm
```

## 🚀 Flujo de Trabajo

1. **Desarrollo Local**: `npm run dev`
2. **Test**: `npm test`
3. **Build**: `npm run build`
4. **Deploy Frontend**: Push a GitHub → Netlify/Vercel
5. **Deploy Backend**: Push a `backend/` → Render.com

## 📝 Notas Importantes

- El modelo Whisper se carga UNA sola vez (singleton pattern)
- WhisperContext debe envolver toda la aplicación
- El backend es opcional (fallback a browser-based)
- WASM files se copian automáticamente en dev/build
- Sample.wav contiene la frase de JFK: "Ask not what your country..."