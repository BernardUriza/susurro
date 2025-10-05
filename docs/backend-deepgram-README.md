# Deepgram Backend for Susurro

Este backend procesa los chunks de audio WAV generados por Murmuraba usando la API de Deepgram.

## Configuración

### 1. Instalar dependencias

```bash
cd backend-deepgram
pip install -r requirements.txt
```

### 2. Configurar API Key de Deepgram

Crea un archivo `.env` basado en `.env.example`:

```bash
cp .env.example .env
```

Edita `.env` y agrega tu API key de Deepgram:

```env
DEEPGRAM_API_KEY=tu_api_key_aqui
```

**Obtén tu API key gratis:**
- Ve a [https://console.deepgram.com/](https://console.deepgram.com/)
- Crea una cuenta (obtienes $200 USD de crédito gratis)
- Copia tu API key desde el dashboard

### 3. Ejecutar el servidor

```bash
python server.py
```

El servidor correrá en `http://localhost:8001`

## Endpoints

### REST API

- `POST /transcribe-chunk` - Transcribe un archivo WAV
  - Body: multipart/form-data con campo `file`
  - Response: JSON con transcript y confidence

### WebSocket

- `ws://localhost:8001/ws/transcribe` - Transcripción en tiempo real
  - Envía chunks de audio en base64
  - Recibe transcripciones en JSON

### Health Check

- `GET /health` - Estado del servidor
- `GET /models` - Modelos disponibles

## Integración con Frontend

El frontend de Susurro detectará automáticamente cuando selecciones "Deepgram Nova-2" como modelo y enviará los chunks a este backend en lugar de usar Whisper local.

## Arquitectura

```
Frontend (Susurro + Murmuraba)
    ↓
[Genera chunks WAV de 8 segundos]
    ↓
Backend Deepgram (FastAPI)
    ↓
[Procesa con Deepgram API]
    ↓
Transcripción devuelta al frontend
```

## Características

- ✅ Procesa chunks WAV de Murmuraba
- ✅ Soporta español y multilingüe
- ✅ WebSocket y REST API
- ✅ Modelo Nova-2 (más preciso)
- ✅ Smart formatting automático
- ✅ Punctuation automática

## Troubleshooting

### Error: "Deepgram API key not configured"
- Verifica que el archivo `.env` existe y contiene tu API key
- Reinicia el servidor después de agregar la key

### Error de conexión al backend
- Verifica que el servidor esté corriendo en puerto 8001
- Revisa que no haya firewall bloqueando el puerto
- Asegúrate de que CORS esté configurado correctamente

### Transcripciones vacías
- Verifica que los chunks de audio tengan contenido válido
- Revisa los logs del servidor para ver errores de Deepgram
- Asegúrate de que tu API key tenga créditos disponibles