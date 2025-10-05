# 📱 Susurro PWA - Progressive Web App

## ✨ Instalación en Chrome/Edge

### Desktop (Windows/Mac/Linux)

1. **Abre la app en Chrome/Edge:**
   ```
   https://tu-dominio.com
   ```

2. **Busca el icono de instalación** en la barra de direcciones (⊕)

3. **Haz clic en "Instalar Susurro"**

4. **¡Listo!** La app se abrirá en su propia ventana

### Método alternativo (Chrome)

1. Haz clic en el menú **⋮** (tres puntos)
2. Selecciona **"Instalar Susurro..."** o **"Crear acceso directo..."**
3. Marca **"Abrir como ventana"**

### Mobile (Android)

1. Abre en **Chrome móvil**
2. Toca el menú **⋮** (tres puntos)
3. Selecciona **"Instalar app"** o **"Agregar a pantalla de inicio"**
4. La app aparecerá en tu cajón de aplicaciones

### iOS (iPhone/iPad)

1. Abre en **Safari**
2. Toca el botón **Compartir** (□↑)
3. Selecciona **"Agregar a pantalla de inicio"**
4. Personaliza el nombre si deseas
5. Toca **"Agregar"**

## ✅ Características PWA

- ✨ **Instalable**: Funciona como app nativa
- 🚀 **Rápida**: Carga instantánea con caché
- 📱 **Responsive**: Adapta a cualquier pantalla
- 🎙️ **Permisos de micrófono**: Acceso persistente
- 🌐 **Funciona offline**: Caché de recursos estáticos

## 🔧 Configuración Técnica

### Manifest (`public/manifest.json`)
```json
{
  "name": "Susurro - Neural Transcription Studio",
  "short_name": "Susurro",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#00ff41",
  "background_color": "#000000",
  "display": "standalone"
}
```

### Service Worker (`public/sw.js`)
- **Cache estrategia**: Network-first con fallback
- **Recursos precacheados**: HTML, manifest, assets críticos
- **Runtime cache**: Assets dinámicos

### Vite Build Config
```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      assetFileNames: (assetInfo) => {
        // PWA icons mantienen su nombre para el manifest
        if (assetInfo.name?.includes('icon-')) {
          return '[name][extname]';
        }
        return 'assets/[name]-[hash][extname]';
      }
    }
  }
}
```

## 🚀 Despliegue

### Build para producción
```bash
npm run build
```

### Generar iconos PWA
```bash
npm run generate:icons
```

### Preview local
```bash
npm run preview
```

## 🧪 Testing PWA

### Chrome DevTools

1. Abre **DevTools** (F12)
2. Ve a **Application** tab
3. Revisa:
   - **Manifest**: Verifica configuración
   - **Service Workers**: Estado activo
   - **Storage**: Cache API
   - **Lighthouse**: Auditoría PWA

### Lighthouse Score

Ejecuta auditoría PWA:
```bash
npx lighthouse https://tu-dominio.com --view
```

Target mínimo: **90+ PWA Score**

## 📊 Métricas PWA

- ✅ **Installable**: Manifest + Service Worker
- ✅ **Fast**: First Contentful Paint < 2s
- ✅ **Reliable**: Funciona offline
- ✅ **Engaging**: Full-screen, responsive

## 🔒 Permisos Requeridos

- 🎙️ **Micrófono**: Para transcripción en tiempo real
- 📦 **Storage**: Para caché y datos offline

## 📝 Notas

- **HTTPS requerido**: Service Workers solo en HTTPS
- **Cross-Origin headers**: Configurados para WASM/WebGPU
- **iOS limitations**: Safari tiene limitaciones con Service Workers

## 🐛 Troubleshooting

### "No se puede instalar"
- Verifica HTTPS
- Asegura manifest.json válido
- Service Worker registrado correctamente

### "Icons no aparecen"
- Verifica rutas en manifest.json
- Regenera iconos: `npm run generate:icons`
- Limpia caché del navegador

### "Service Worker error"
- Revisa consola del navegador
- Verifica sw.js en DevTools > Application
- Desregistra y vuelve a registrar SW
