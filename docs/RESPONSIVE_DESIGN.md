# 📱 Responsive Design Guide

## Overview

Susurro está completamente optimizado para dispositivos móviles con soporte PWA, touch interactions, y diseño adaptativo.

## 🎯 Breakpoints

### Desktop (>1200px)
- Grid de 2 columnas (transcripción + controles)
- Waveform separado en panel inferior
- Configuración en panel lateral

### Tablet (768px - 1200px)
- Grid de 1 columna apilada
- Todos los paneles en vertical
- Altura adaptativa automática

### Mobile (480px - 768px)
- Layout compacto vertical
- Botones de 56px+ para touch
- Fuentes ajustadas: 1rem base
- Padding reducido: 8-12px

### Small Mobile (<480px)
- Layout ultra-compacto
- Botones full-width
- Fuentes: 0.95rem
- Padding mínimo: 6-10px

## 📐 Touch Optimization

### Touch Target Sizes (WCAG AA)
```css
button: min-height: 44px (desktop)
button: min-height: 48px (mobile <480px)
button: min-height: 56px (primary actions mobile)
```

### Features Implementadas
✅ **Tap Highlight Removal**: `-webkit-tap-highlight-color: transparent`
✅ **Active State Feedback**: `transform: scale(0.98)` en `:active`
✅ **Smooth Scrolling**: `-webkit-overflow-scrolling: touch`
✅ **Prevent Double-Tap Zoom**: `user-select: none` en botones
✅ **Safe Area Insets**: Soporte para notches (iPhone X+)

## 🎨 Simple Mode Responsive

### Desktop (1200px+)
```css
.simpleMode {
  height: calc(100vh - 150px);
  gap: 20px;
}
.simpleTextbox {
  font-size: 1.2rem;
  padding: 25px;
}
```

### Mobile (768px)
```css
.simpleMode {
  height: calc(100vh - 100px);
  gap: 15px;
}
.simpleTextbox {
  font-size: 1rem;
  padding: 15px;
}
```

### Small Mobile (480px)
```css
.simpleMode {
  height: calc(100vh - 80px);
  gap: 12px;
}
.simpleTextbox {
  font-size: 0.95rem;
  padding: 12px;
}
.simpleControls {
  flex-direction: column; /* Botones apilados */
}
.liveIndicators {
  position: static; /* Mueve arriba del textarea */
}
```

## 🌐 Viewport Configuration

```html
<meta name="viewport"
  content="width=device-width,
           initial-scale=1.0,
           maximum-scale=5.0,
           user-scalable=yes,
           viewport-fit=cover">
```

### Características:
- `viewport-fit=cover`: Soporte para notches
- `maximum-scale=5.0`: Permite zoom para accesibilidad
- `user-scalable=yes`: No bloquea zoom (importante para WCAG)

## 🔧 Touch Interaction Classes

### `.touch-feedback`
```css
.touch-feedback:active {
  opacity: 0.7;
  transition: opacity 0.1s ease;
}
```

### `.swipeable`
```css
.swipeable {
  touch-action: pan-y; /* Solo scroll vertical */
}
```

### `.no-select`
```css
.no-select {
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
```

## 📱 Platform-Specific Fixes

### iOS Safari
```css
input, textarea {
  -webkit-appearance: none;
  font-size: 16px !important; /* Previene zoom automático */
}

button {
  -webkit-appearance: none;
}
```

### Android Chrome
```css
body {
  overscroll-behavior-y: contain; /* Desactiva pull-to-refresh */
}
```

## 🎯 Safe Area Insets (Notched Devices)

```css
@supports (padding: max(0px)) {
  .safe-area-top {
    padding-top: max(20px, env(safe-area-inset-top));
  }

  .safe-area-bottom {
    padding-bottom: max(20px, env(safe-area-inset-bottom));
  }
}
```

## ♿ Accessibility Features

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### High Contrast
```css
@media (prefers-contrast: high) {
  * {
    border-width: 2px !important;
  }
}
```

### Hover Detection (Solo Desktop)
```css
@media (hover: hover) and (pointer: fine) {
  button:hover {
    transform: translateY(-2px);
  }
}

@media (hover: none) and (pointer: coarse) {
  button:hover {
    transform: none; /* Desactiva hover en touch */
  }
}
```

## 🧪 Testing Responsive

### Chrome DevTools
1. F12 → Toggle Device Toolbar (Ctrl+Shift+M)
2. Test devices:
   - iPhone SE (375x667)
   - iPhone 12 Pro (390x844)
   - iPad Air (820x1180)
   - Samsung Galaxy S20 (360x800)

### Viewport Sizes
```bash
# Desktop
1920x1080 (Full HD)
1440x900 (MacBook)

# Tablet
1024x768 (iPad)
768x1024 (iPad Portrait)

# Mobile
414x896 (iPhone 11 Pro Max)
375x667 (iPhone SE)
360x640 (Android Small)
```

### Test Checklist
- ✅ Botones accesibles con pulgar
- ✅ Texto legible sin zoom
- ✅ No overflow horizontal
- ✅ Scroll suave
- ✅ Indicadores visibles
- ✅ Teclado no cubre inputs
- ✅ Landscape mode funcional

## 📊 Performance Metrics

### Target LCP (Largest Contentful Paint)
- Desktop: <2.5s
- Mobile: <4s

### Target FID (First Input Delay)
- All devices: <100ms

### Touch Response Time
- Target: <100ms para feedback visual

## 🚀 Production Build

```bash
npm run build    # Genera build optimizado
npm run preview  # Test local del build
```

Build size:
- CSS: ~38KB (8.35KB gzipped)
- Touch optimizations: +5.5KB CSS

## 📝 CSS Files

1. **`reset.css`**: Base reset
2. **`tokens.css`**: Variables CSS
3. **`matrix-theme.css`**: Theme colors
4. **`scroll-animations.css`**: Smooth scrolling
5. **`touch-optimized.css`**: ⭐ Mobile touch improvements
6. **`improved-layout.css`**: Layout helpers
7. **Module CSS**: Component-specific styles

## 🐛 Common Issues

### iOS Input Zoom
**Problem**: iOS zooms cuando enfocas input
**Fix**: `font-size: 16px !important` en inputs

### Android Pull-to-Refresh
**Problem**: Pull down recarga página
**Fix**: `overscroll-behavior-y: contain`

### Button Tap Delay
**Problem**: 300ms delay en taps
**Fix**: `touch-action: manipulation`

### Landscape Keyboard
**Problem**: Teclado cubre interfaz
**Fix**: `height: calc(100vh - 80px)` en mobile

## 📖 Resources

- [WCAG Touch Target Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [MDN Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)
- [Safe Area Insets](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
