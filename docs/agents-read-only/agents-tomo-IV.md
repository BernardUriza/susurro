# 📕 AGENTS – TOMO IV  
## ⚙️ PERFORMANCE DESPIADADA: TIEMPO, MEMORIA Y COMPLEJIDAD

---

## 🎯 PROPÓSITO DEL TOMO

Tu código **NO es aceptable** si:

- 🐌 Tarda más de lo necesario
- 🧠 Consume más memoria de la que debería
- 🪢 Tiene complejidad innecesaria

**Este tomo existe para garantizar que cada función:**

- **Corre rápido**
- **Escala bien**
- **Consume lo mínimo**
- **Es sencilla de analizar**

---

## 🔥 LEY DEL RENDIMIENTO BRUTAL

> “**Una función lenta es un bug**. Una función que escala mal es una bomba.”

Cada función se mide con las 3 S:

| Métrica | Qué mide | Límite brutal |
|--------|----------|----------------|
| Speed  | ms por ejecución | < 100ms por operación estándar |
| Size   | RAM usada       | < 50MB por proceso activo |
| Steps  | Complejidad algorítmica | O(n log n) o mejor (salvo pruebas) |

---

## 🧪 MONITOREO OBLIGATORIO

```ts
const start = performance.now()
// Ejecutar función
const result = doHeavyThing()
const end = performance.now()

console.log(`⏱️ Tardó: ${end - start}ms`)
````

En tests automatizados:

```ts
expect(end - start).toBeLessThan(100)
expect(process.memoryUsage().heapUsed).toBeLessThan(50 * 1024 * 1024)
```

---

## 🧠 COMPLEJIDAD ALGORÍTMICA - TU NUEVO DIOS

> ¿Tu función pasa los tests pero es O(n²)?
> Tu código no es aceptable.

### ¿Qué hacer?

* Cambia loops anidados por estructuras más eficientes
* Usa hashes y sets en vez de arrays cuando busques cosas
* Usa `Map` para búsquedas, no `array.find`

---

## 🚫 COSAS QUE NUNCA DEBES HACER

### ❌ Repetir `.map().filter().reduce()` en cadena

* Componlos en una sola pasada

### ❌ Recalcular datos en cada llamada

* Memoriza resultados si no cambian

### ❌ Hacer `.sort()` innecesarios

* Evita reordenar si ya está ordenado o no importa

---

## 🔧 PATRONES EFICIENTES

### ✅ Map Indexing

```ts
const map = new Map()
for (const user of users) {
  map.set(user.id, user)
}

// En vez de array.find(x => x.id === id) en cada iteración
```

### ✅ Lazy Evaluation

```ts
function* lazyFilter(arr, predicate) {
  for (const x of arr) {
    if (predicate(x)) yield x
  }
}
```

### ✅ Batching

Divide operaciones pesadas en bloques más pequeños para evitar bloqueos:

```ts
for (let i = 0; i < items.length; i += 50) {
  await processBatch(items.slice(i, i + 50))
}
```

---

## 💾 USO DE MEMORIA: LIMPIEZA OBLIGATORIA

1. **Evita referencias retenidas**

   * Cierra websockets, borra timers

2. **Limpia arrays, maps, sets que ya no usas**

```ts
array.length = 0
map.clear()
set.clear()
```

3. **No mantengas buffers abiertos**

   * Libera blobs, lectores, streams

4. **Controla blobs y buffers manualmente**

```ts
URL.revokeObjectURL(blobURL)
reader.releaseLock()
```

---

## 🧨 MEDIR TODO (MÉTRICAS REALES)

```ts
interface PerformanceMetrics {
  execTimeMs: number        // < 100ms
  heapUsed: number          // < 50MB
  throughput: number        // req/s
  latency: number           // avg + p95
  memoryLeakedMB: number    // debe ser 0
}
```

---

## 🧬 RENDIMIENTO EN PRUEBAS

```ts
describe('⚙️ Performance Test', () => {
  it('procesa archivos < 3s y < 50MB RAM', async () => {
    const start = performance.now()
    const memStart = process.memoryUsage().heapUsed

    const result = await analyzeAudio('big.wav')

    const duration = performance.now() - start
    const memUsed = process.memoryUsage().heapUsed - memStart

    expect(duration).toBeLessThan(3000)
    expect(memUsed).toBeLessThan(50 * 1024 * 1024)
    expect(result.success).toBe(true)
  })
})
```

---

## 🧼 LIMPIEZA Y REUSO

Nunca desperdicies:

* Buffers que puedes reutilizar
* Objetos que puedes clonar en vez de mutar
* Instancias que puedes mantener vivas y limpiar

---

## 🧯 GUÍA DE OPTIMIZACIÓN

| Síntoma            | Diagnóstico       | Solución                       |
| ------------------ | ----------------- | ------------------------------ |
| Latencia alta      | I/O bloqueante    | Async + throttling             |
| RAM sube sin parar | Memory leak       | Revisa referencias circulares  |
| CPU al 100%        | Loop innecesario  | Early returns, break, debounce |
| Lags aleatorios    | Garbage Collector | Reduce objetos temporales      |

---

## 🧪 BENCHMARKS COMO RUTINA

Usa esto para validar mejoras:

```bash
time node script.js  # evalúa tiempo
```

O usa `benchmark.js`, `hyperfine`, `perf_hooks`, `clinic.js`, etc.

---

## 📋 CHECKLIST BRUTAL DE PERFORMANCE

* [ ] ¿Tu función es O(n log n) o mejor?
* [ ] ¿Evitas loops anidados innecesarios?
* [ ] ¿Mediste el tiempo de ejecución?
* [ ] ¿Mediste el uso de memoria?
* [ ] ¿Reusas buffers o estructuras?
* [ ] ¿Estás liberando recursos manualmente?
* [ ] ¿Hay control sobre blobs, URLs, lectores?
* [ ] ¿Tus tests miden latencia o memoria?
* [ ] ¿Hay benchmarks reales y actualizados?
* [ ] ¿Tu app escala x10 sin morir?

---

## 🏁 MANTRA DE PERFORMANCE

> "El mejor código no solo funciona.
> Funciona rápido, ligero, y en silencio."

---

## 🏴 JURAMENTO DE OPTIMIZACIÓN

```ts
const PERFORMANCE_OATH = `
  Juro que nunca entregaré código sin medir su performance.
  Juro que cada MB de RAM será justificado.
  Juro que si mi algoritmo es lento, no lo esconderé con caching.
  Juro que si mi código hace más de lo que debe, lo amputaré.
  Y si fallo, merezco que mis procesos se congelen y mis usuarios se larguen.
`
```

---

## 🔜 SIGUIENTE TOMO: `agents-tomo-V.md`

El capítulo final: **"Automatización Brutal, Repos Limpios, Pipelines que Gritan"**
CI/CD, scripts implacables, quality gates, y guerra total contra la complacencia.

---

```
OPTIMIZADO. BENCHMARKEADO. DESTRUIDO Y REESCRITO HASTA BRILLAR:
THE ULTIMATE BRUTAL QUALITY ENFORCER
```

