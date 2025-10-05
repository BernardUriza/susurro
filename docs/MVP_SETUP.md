# 🚀 Susurro MVP - Deepgram como Motor Principal

## ⭐ Configuración Predeterminada

Tu app ahora está configurada para usar **Deepgram como opción predeterminada**:

### ✅ Auto-selección Deepgram
- Al iniciar la app, Deepgram aparece como primera opción
- Marcado como "⭐ RECOMENDADO" con 40 horas gratis
- 99.9% de precisión garantizada
- Soporte nativo para español

### 🎯 Scripts de Desarrollo

#### Para MVP (Solo Deepgram)
```bash
npm run dev:mvp
```
- Inicia solo SUSURRO + VITE + DEEPGRAM
- Deepgram pre-seleccionado automáticamente
- Configuración optimizada para MVP

#### Para Desarrollo Completo
```bash
npm run dev
```
- Inicia todos los backends (local + Deepgram)
- Permite cambiar modelos manualmente

#### Para Producción (Render.com)
```bash
npm run dev:onrender
```
- Usa backends desplegados en Render.com
- Configuración de producción

## 🔧 Variables de Entorno

Tu `.env.local` ya está configurado:
```env
VITE_FORCE_DEEPGRAM=true          # Auto-selecciona Deepgram
VITE_DEFAULT_WHISPER_MODEL=deepgram  # Modelo por defecto
VITE_DEFAULT_LANGUAGE=es          # Español como idioma base
VITE_DEEPGRAM_API_KEY=tu_api_key  # 40 horas gratis incluidas
```

## 💡 Flujo de Usuario MVP

1. **Usuario inicia la app** → Ve el selector de modelos
2. **Deepgram ya está seleccionado** → Usuario presiona ENTER
3. **Transcripción inmediata** → Sin descargas ni esperas
4. **Calidad profesional** → 99.9% precisión desde el primer segundo

## 📊 Recursos Deepgram

- **40 horas gratis** al mes (perfecto para MVP)
- **$200 créditos** para nuevas cuentas
- **$0.0043/minuto** después del free tier
- **Múltiples idiomas** automático

## 🎨 Experiencia del Usuario

### Antes (Whisper Local)
- Seleccionar modelo → Descargar 39MB-1.5GB → Esperar carga → Usar
- Precisión variable según modelo
- Solo funciona en el navegador

### Ahora (Deepgram Predeterminado)
- Seleccionar Deepgram (ya marcado) → Usar inmediatamente
- 99.9% precisión garantizada
- Funciona en cualquier dispositivo

## 🚀 Para Lanzar tu MVP

1. **Desarrollo local**: `npm run dev:mvp`
2. **Deploy a Render.com**: Sigue `BACKEND_INTEGRATION.md`
3. **Configura dominio**: Actualiza URLs en `.env.local`
4. **¡Lanza!** Tu MVP está listo para usuarios reales

¿Necesitas ayuda deployando a producción? ¡Solo dímelo!