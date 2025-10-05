# 🚀 Render.com Deployment Guide

Este documento explica cómo usar Susurro con backends desplegados en Render.com.

## Configuración Local para Render

Para usar tus backends de Render.com en desarrollo local, simplemente ejecuta:

```bash
npm run dev:onrender
```

Este comando:
- ✅ Configura automáticamente las URLs de Render.com
- ✅ Solo ejecuta el frontend (no backends locales)
- ✅ Usa `VITE_USE_RENDER=true` internamente

## URLs de Backend Configuradas

### Whisper Backend
- **Local**: `http://localhost:8000`
- **Render**: `https://susurro-whisper-backend.onrender.com`

### Deepgram Backend
- **Local**: `http://localhost:8001`
- **Render**: `https://susurro-deepgram-backend.onrender.com`

## Scripts Disponibles

```bash
# Desarrollo local completo (con backends locales)
npm run dev

# Desarrollo con Deepgram por defecto y backend local
npm run dev:mvp

# Desarrollo usando backends de Render.com
npm run dev:onrender

# Solo frontend (sin backends)
npm run dev:simple
```

## Configuración Automática

El sistema detecta automáticamente el entorno:

- **`dev:onrender`**: Usa backends de Render.com
- **`dev` normal**: Usa backends locales
- **Frontend**: Cambia automáticamente según el entorno

## Verificación de Estado

El componente `BackendStatus` muestra:
- 🟢 **Online**: Backend funcionando correctamente
- 🔴 **Offline**: Backend no disponible
- 🟡 **Checking**: Verificando conexión

## Deepgram como Predeterminado

Cuando usas `dev:onrender`, Deepgram se selecciona automáticamente por defecto para la mejor experiencia con backends remotos.

## Troubleshooting

### Backend no responde
- Verifica que tus servicios en Render.com estén activos
- Los servicios gratuitos de Render pueden tardar ~30 segundos en "despertar"

### CORS Issues
- Los backends incluyen configuración CORS para desarrollo local
- Render.com maneja HTTPS automáticamente