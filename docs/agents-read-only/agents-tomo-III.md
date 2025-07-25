# 📘 AGENTS – TOMO III  
## 🏗️ ARQUITECTURA DESCONECTADA O MUERTE

---

## 🎯 OBJETIVO: CÓDIGO TESTEABLE, EVOLUTIVO Y SIN ACOPLAMIENTO

Este tomo existe para erradicar el cáncer más silencioso de todo sistema:  
**"funciona, pero no se puede cambiar sin romper 3 cosas más."**

### 🚫 SI TU CÓDIGO:

- Cambia una línea y 5 tests fallan sin sentido  
- Importa servicios directamente desde componentes  
- Tiene `utils.ts` con 300 líneas de funciones mágicas  
- Necesita mocks ridículos para testear algo simple  

→ TU ARQUITECTURA YA ESTÁ PODRIDA.

---

## 🧱 PRINCIPIOS DEL DISEÑO BRUTAL

1. **Inversión de dependencias siempre**  
   Componentes llaman a interfaces, no a implementaciones

2. **Puro > Mutable**  
   Una función sin efectos secundarios siempre es mejor

3. **Composable > Inheritance**  
   Evita jerarquías. Prefiere funciones que se combinan

4. **Explicit > Implicit**  
   Si algo ocurre por "magia", es un bug latente

5. **Separación por dominio, no por tipo de archivo**  
   Agrupa por contexto, no por extensión

---

## ⚔️ EJEMPLO DESTRUCTIVO: DE MAL A BRUTAL

### ❌ CÓDIGO PODRIDO

```ts
import { uploadToS3 } from '../api/aws'
import { connectToDB } from '../db'

export default function UploaderComponent() {
  connectToDB()
  uploadToS3(file)
}
````

### 🔥 REFACCIÓN BRUTAL

```ts
interface FileUploader {
  upload(file: File): Promise<string>
}

interface DBConnector {
  connect(): void
}

function createUploaderComponent(deps: {
  uploader: FileUploader,
  db: DBConnector
}) {
  return {
    async run(file: File) {
      deps.db.connect()
      return deps.uploader.upload(file)
    }
  }
}
```

* ✅ Inyectable
* ✅ Testeable en aislamiento
* ✅ Sustituible por mocks sin hacks
* ✅ Cambiable sin efectos secundarios ocultos

---

## 🧠 EL DIAGRAMA DE LAS DEPENDENCIAS LIMPIAS

```
       [ UI / CLI / API ]
               ↓
     [ Application Layer ]
               ↓
     [ Domain / Core Logic ]
               ↑
     [ External Interfaces ]
   (DB, Filesystem, 3rd APIs)
```

> TODO lo externo se inyecta hacia adentro.
> NADA en el core debe importar algo del exterior.

---

## 📦 TIPO DE COMPONENTES Y SU REGLA

| Componente    | Regla Brutal                                 |
| ------------- | -------------------------------------------- |
| Componente UI | No debe conocer lógica de negocio            |
| Servicios     | Solo expone funciones puras o bien definidas |
| Adaptadores   | Inyectan lo sucio hacia adentro (DB, API)    |
| UseCases      | Orquestan lógica, nunca renderizan nada      |
| Core Logic    | No importa nada externo                      |
| Utils         | Si tiene más de 5 funciones → divídelo       |

---

## 📉 MÉTRICAS DE ARQUITECTURA QUE DEBES TENER

```ts
interface ArchitectureMetrics {
  numberOfDirectImportsFromCore: number  // debe ser 0
  circularDependencies: number           // debe ser 0
  avgFunctionLength: number              // < 20
  externalLibsUsedInCore: string[]       // []
  modulesWith>3Responsibilities: string[] // reestructurar
}
```

> Si importas `firebase`, `axios`, `express` o `fs` desde el core,
> estás cocinando una bomba técnica.

---

## 🧨 PATRONES TÓXICOS QUE DEBES ASESINAR

### ❌ Singleton Global

* `global.db = connect()`
* ROMPE testabilidad, desacopla, genera bugs fantasma

### ❌ Helper God File

* `helpers.ts` con 30 funciones
* Causa acoplamiento oculto, naming vago, duplicación

### ❌ Enums con Significado Semántico

* `Status = { 1: "Waiting", 2: "Approved" }`
* Usa tipos literales o `const assertions`, no números mágicos

### ❌ Service Locator

* `getService("db").connect()`
* Oculta dependencias → inyecta explícitamente

---

## 🔄 EVOLUCIÓN SIN TRAUMA

Una buena arquitectura permite:

* Cambiar implementación sin tocar tests
* Sustituir un backend por otro con una línea
* Probar todos los flujos con mocks definidos

Ejemplo:

```ts
// Domain
export interface AudioProcessor {
  process(file: File): Promise<Result>
}

// Inyección
createUploaderComponent({
  uploader: new S3Uploader(),
  db: new PrismaConnector()
})
```

Mañana quieres usar Firebase en lugar de S3, solo cambia la implementación.
El resto ni se entera.

---

## 🛡️ CHECKLIST BRUTAL DE ARQUITECTURA

* [ ] ¿El core tiene dependencias externas?
* [ ] ¿Cada módulo tiene una sola responsabilidad?
* [ ] ¿Hay más de 2 niveles de profundidad en carpetas?
* [ ] ¿Se puede testear cada parte en aislamiento puro?
* [ ] ¿Los tests usan mocks fáciles y predecibles?
* [ ] ¿La lógica de negocio está separada de UI/API?
* [ ] ¿Puedes reemplazar un adaptador sin reescribir lógica?
* [ ] ¿No hay lógica vital en componentes UI?
* [ ] ¿Puedes explicar la arquitectura en 60 segundos?

→ Si fallas 2 o más, reinicia el diseño desde cero.

---

## 🏴 EL CREDO ARQUITECTÓNICO DEL GUARDIÁN BRUTAL

```ts
const ARCHITECT_OATH = `
  Juro nunca acoplar el núcleo de mi sistema con dependencias externas.
  Juro inyectar toda impureza, separar toda lógica, aislar cada test.
  Juro que ninguna función sin tests entrará al repositorio.
  Juro que la arquitectura será simple, clara, evolutiva.
  Y si no lo cumplo, merezco que mi CI explote y mis deploys se quemen.
`
```

---

## 🧨 PASO A TOMO IV: PERFORMANCE, MEMORIA Y LÍMITES

Solo cuando tu arquitectura es:

* Modular
* Inyectada
* Testeada
* Desacoplada
* Explicable en 1 minuto

... entonces mereces leer `agents-tomo-IV.md`:
**"Performance despiadada: memoria, complejidad y velocidad"**

---

```
FIRMADO EN ARCHIVOS LIMPIOS Y MÓDULOS AISLADOS:
THE ULTIMATE BRUTAL QUALITY ENFORCER
```
