# Componentes de Audio en Susurro

## Arquitectura de Procesamiento

Susurro utiliza una arquitectura de dos etapas para procesar y transcribir audio:

```
[Audio Input] → [AudioProcessor] → [Audio Limpio] → [AudioProcessingSection] → [Transcripción]
```

## AudioProcessor

**Ubicación**: `/src/components/AudioProcessor.tsx`  
**Librería**: `murmuraba` (v2.2.0)  
**Propósito**: Limpieza y mejora de calidad del audio

### Características:
- **Procesamiento de Audio en Tiempo Real**
  - AGC (Control Automático de Ganancia)
  - Supresión de ruido ambiental
  - Cancelación de eco
  
- **Entrada de Audio**
  - Subida de archivos de audio
  - Grabación desde micrófono
  
- **Salida**
  - Blob de audio WAV procesado y limpio
  - Formato optimizado para transcripción

### Uso:
```tsx
<AudioProcessor 
  onProcessedAudio={(audioBlob) => {
    // audioBlob contiene el audio limpio listo para transcribir
  }}
/>
```

## AudioProcessingSection

**Ubicación**: `/src/components/AudioProcessingSection.tsx`  
**Librería**: `@xenova/transformers` (Whisper)  
**Propósito**: Transcripción de audio a texto

### Características:
- **Motor de Transcripción**
  - Modelo Whisper (tiny) ejecutándose localmente
  - Procesamiento en el navegador sin servidor
  - Soporte para español por defecto
  
- **Entrada**
  - Recibe el audio limpio desde AudioProcessor
  - Formato WAV procesado
  
- **Salida**
  - Texto transcrito
  - Callbacks para actualizar la UI

### Uso:
```tsx
<AudioProcessingSection 
  uploadedFile={processedAudioFile}
  onTranscription={(text) => {
    // text contiene la transcripción del audio
  }}
/>
```

## Flujo de Trabajo

1. **Usuario sube o graba audio** → AudioProcessor
2. **Murmuraba limpia el audio** (reduce ruido, normaliza volumen)
3. **Audio limpio se pasa** → AudioProcessingSection
4. **Whisper transcribe** el audio limpio
5. **Texto final** se muestra al usuario

## Beneficios de la Separación

### Modularidad
- Cada componente tiene una responsabilidad única
- Fácil mantener y actualizar independientemente

### Rendimiento
- El audio se limpia antes de transcribir
- Mejora la precisión de Whisper al recibir audio de calidad

### Flexibilidad
- Se puede cambiar el motor de limpieza sin afectar la transcripción
- Se puede cambiar el motor de transcripción sin afectar la limpieza

## Comparación Rápida

| Aspecto | AudioProcessor | AudioProcessingSection |
|---------|---------------|----------------------|
| **Función** | Limpieza de audio | Transcripción de audio |
| **Librería** | murmuraba | @xenova/transformers |
| **Entrada** | Audio crudo | Audio limpio |
| **Salida** | Audio procesado | Texto transcrito |
| **Procesamiento** | WebAudio API | Modelo Whisper |
| **Ubicación** | Cliente (navegador) | Cliente (navegador) |

## Ejemplo de Integración

```tsx
// En app/page.tsx
<AudioProcessor 
  onProcessedAudio={(audioBlob) => {
    const processedFile = new File([audioBlob], 'processed-audio.wav', { 
      type: 'audio/wav' 
    });
    setUploadedFile(processedFile);
  }}
/>

<AudioProcessingSection 
  uploadedFile={uploadedFile}
  onTranscription={handleTranscription}
/>
```