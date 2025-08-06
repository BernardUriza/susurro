# Issue: Problemas de Inicialización de Whisper y Murmuraba 

## 🚨 Problema Identificado

Basado en los logs de error proporcionados, se ha identificado un problema crítico de **timeout de conexión CDN** que afecta la inicialización tanto del modelo Whisper como posiblemente de la biblioteca Murmuraba WASM.

### Síntomas Observados

```log
[00:43:57] 🔍 Verificando modelo Whisper BASE...
[00:43:57] 📊 Buscando en caché local o descargando desde Hugging Face CDN
[00:44:07] ⏳ Conectando con CDN... (10s)
[00:44:17] ⏳ Conectando con CDN... (20s)
[00:44:27] ⏳ Conexión lenta - descargando... (30s)
...
[00:45:57] ❌ Timeout: El modelo tardó demasiado en cargar
[00:45:57] ❌ Error al cargar modelo: Worker timeout after 2 minutes
```

## 🔍 Análisis de Causas Raíz

### 1. Problemas de Conexión CDN de Hugging Face

Según la investigación web realizada, los problemas de timeout con Hugging Face CDN son **comunes y recurrentes** en 2025:

- **HTTPSConnectionPool(host='cdn-lfs.hf.co', port=443): Read timed out** es un error reportado frecuentemente
- Muchos usuarios experimentan `ReadTimeoutError` al cargar modelos grandes
- Las instancias de GPU en cloud e intranets suelen tener firewall que bloquea conexiones externas
- El timeout por defecto de 10 segundos es **insuficiente** para modelos como Whisper Base (74MB)

### 2. Problemas de WebAssembly (Murmuraba)

Los problemas de inicialización WASM en contextos de audio son **complejos**:

- **AudioWorklet + WASM**: wasm-pack no soporta AudioWorklets con targets actuales
- **Inicialización asíncrona**: Los módulos WASM requieren `WebAssembly.compileStreaming` antes del `postMessage`
- **Contexto de Worker**: Los AudioWorklet no tienen acceso a todas las APIs del browser que esperan los wrappers JS

### 3. Arquitectura Actual Problemática

El código actual tiene varios puntos de fallo:

```typescript
// PROBLEMA: Timeout fijo de 2 minutos
} else if (progressCheckCount < 24) { // 24 * 5s = 120s total
```

```javascript
// PROBLEMA: No manejo de CDN offline
env.allowLocalModels = false;
env.allowRemoteModels = true;
```

## 🛠️ Plan de Solución Inmediata

### Fase 1: Configuración Adaptiva de CDN

```typescript
// 1. Implementar fallback de CDN múltiples
const CDN_MIRRORS = [
  'https://huggingface.co',
  'https://cdn-lfs.hf.co', 
  'https://cdn.jsdelivr.net/npm/@xenova/transformers'
];

// 2. Timeout dinámico basado en tamaño del modelo
const getTimeoutForModel = (modelSize: string) => {
  const sizeMap = {
    'tiny': 60000,   // 39MB - 1 min
    'base': 180000,  // 74MB - 3 min  
    'small': 300000, // 244MB - 5 min
    'medium': 600000 // 769MB - 10 min
  };
  return sizeMap[modelSize] || 120000;
};
```

### Fase 2: Detección de Conectividad

```typescript
// Ping de conectividad antes de descargas grandes
const testCDNConnectivity = async () => {
  try {
    const response = await fetch('https://huggingface.co/api/models', { 
      method: 'HEAD',
      timeout: 5000 
    });
    return response.ok;
  } catch {
    return false;
  }
};
```

### Fase 3: Mode Offline Inteligente

```typescript
// Auto-fallback a modo offline si CDN falla
if (!connectivity) {
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  // Mostrar UI para selección de archivo local
}
```

## 🏗️ Refactoring Arquitectónico Requerido

### 1. Separación de Responsabilidades

```typescript
interface ModelLoader {
  loadModel(id: string, options: LoadOptions): Promise<Model>;
  checkCache(id: string): boolean;
  downloadWithProgress(url: string, onProgress: ProgressCallback): Promise<Blob>;
}

interface AudioEngine {
  initializeWasm(wasmPath: string): Promise<void>;
  startWorklet(): Promise<AudioWorkletNode>;
}
```

### 2. Estado de Inicialización Mejorado

```typescript
type InitializationState = 
  | { status: 'idle' }
  | { status: 'checking-connectivity' }
  | { status: 'loading-wasm', progress: number }
  | { status: 'loading-model', model: string, progress: number }
  | { status: 'ready', model: string }
  | { status: 'error', error: string, recovery?: RecoveryAction };
```

## 🚀 Configuración de Emergencia

### Configuración Inmediata en Worker

```javascript
// whisper-pipeline.worker.js
import { pipeline, env } from '@xenova/transformers';

// CONFIGURACIÓN DE EMERGENCIA
env.backends.onnx.wasm.numThreads = 1; // Reducir threads
env.backends.onnx.wasm.simd = false;   // Deshabilitar SIMD si causa problemas

// Timeout extendido para conexiones lentas
const EXTENDED_TIMEOUT = 10 * 60 * 1000; // 10 minutos

// Retry con exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
      if (i === maxRetries - 1) throw error;
    }
  }
};
```

## 📊 Métricas y Monitoreo

### Telemetría de Inicialización

```typescript
interface InitializationMetrics {
  connectivityCheck: number;      // ms
  wasmLoadTime: number;          // ms  
  modelDownloadTime: number;     // ms
  totalInitTime: number;         // ms
  cacheHitRate: number;          // %
  cdnFailureRate: number;        // %
  retryCount: number;
}
```

## 🎯 Prioridades de Implementación

### P0 - Crítico (Esta Semana)
- [ ] Aumentar timeout de modelo BASE a 5 minutos
- [ ] Implementar retry con exponential backoff
- [ ] Agregar detección de conectividad CDN

### P1 - Alto (Próxima Semana)  
- [ ] Implementar modo offline con carga de archivos locales
- [ ] Separar inicialización de Whisper y Murmuraba
- [ ] Mejorar mensajes de error con acciones de recuperación

### P2 - Medio (Próximas 2 Semanas)
- [ ] Implementar CDN mirrors/fallbacks
- [ ] Cache inteligente con compresión
- [ ] Telemetría completa de inicialización

## 🔧 Configuración de Desarrollo

### Variables de Entorno para Testing

```bash
# .env.development
WHISPER_CDN_TIMEOUT=600000      # 10 min para desarrollo
WHISPER_FORCE_LOCAL=false       # true para modo offline
MURMURABA_WASM_PATH=/wasm/      # path local de WASM files
DEBUG_INITIALIZATION=true       # logs detallados
```

## 📝 Notas de Implementación

1. **Compatibilidad**: Mantener backward compatibility con configuración actual
2. **UX**: Mostrar progreso granular y opciones de cancelación
3. **Performance**: Priorizar modelos en cache sobre descargas nuevas  
4. **Error Handling**: Cada fallo debe tener una acción de recuperación clara

---

**Estado**: 🔴 Crítico - Requiere atención inmediata  
**Asignado**: Equipo de Audio Processing  
**Estimación**: 3-5 días para solución básica, 2-3 semanas para refactor completo