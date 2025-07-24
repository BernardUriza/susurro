# 📘 AGENTS – TOMO II  
## 🎭 SIMULACIÓN BRUTAL Y SUPERVISIÓN DE IA

---

## 🎯 E2E CON PUPPETEER – EL JUICIO FINAL

No existen aplicaciones "probadas" sin una suite E2E que simule al usuario real hasta el último scroll.  

**NO ES OPCIONAL:**

- Si no valida errores del navegador → Inútil  
- Si no captura logs relevantes → Incompleto  
- Si no simula flujo real (upload → process → result) → Teatrillo  

### ✅ MÍNIMO E2E VÁLIDO

```ts
describe('E2E: Procesamiento de audio', () => {
  let browser, page, logs = []

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: 'new' })
    page = await browser.newPage()

    page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }))
    page.on('pageerror', err => { throw new Error(`Page crash: ${err.message}`) })
  })

  it('procesa audio y muestra resultado', async () => {
    await page.goto('http://localhost:3000')
    await page.$eval('input[type=file]', el => el.click())
    await page.waitForSelector('.vad-score')
    
    const score = await page.$eval('.vad-score', el => parseFloat(el.textContent))
    expect(score).toBeGreaterThan(0.8)
    expect(logs.filter(l => l.type === 'error')).toHaveLength(0)
  })

  afterAll(async () => await browser.close())
})
````

---

## 🔎 VALIDACIÓN COMPLETA = TRES NIVELES DE PRUEBA

| Nivel | Qué valida                     | Rechazo si...                  |
| ----- | ------------------------------ | ------------------------------ |
| Unit  | Función aislada                | No hay test negativo           |
| Int   | Módulo completo (DB, API)      | Hay mocks forzados inestables  |
| E2E   | Simulación de usuario completa | No se capturan logs ni errores |

---

## 🤖 SUPERVISIÓN DE IA – SÍ, AUN TE VIGILO

La IA (Copilot, Claude, GPT) solo entra después del test.
Nunca antes. Nunca a ciegas. Nunca sin cadena de custodia.

### 🛡️ PROTOCOLO DE CONTROL:

1. **Contrato definido**

   * Entradas, salidas, errores
   * Tipos estrictos o no se implementa

2. **Test en rojo ya escrito**

   * Si pasa en verde sin implementación → test basura

3. **Solicitud delimitada para IA**

   ```ts
   /*
     Bernard: "Implementa SOLO esta función"
     Reglas:
     - No imports externos sin permiso
     - No optimices prematuramente
     - Lanza errores si el test lo exige
   */
   ```

4. **Auditoría despiadada**

   * Si Copilot sugiere 20+ líneas, se lee todo
   * Si Claude “inventa” API, se le azota con refactor

---

## 💥 CASOS REALES DE IA MAL USADA

**CASO 1: Abstracción innecesaria sugerida por GPT**

GPT propuso una clase `AudioServiceFactoryManager`.
⛔ Rechazada por complejo inútil. Reescrito en 5 líneas.

**CASO 2: Copilot sugirió retry automático sin log**

⛔ Falla silenciosa.
Se exigió log con stack + validación explícita del error.

**CASO 3: Claude omitió condición de error en test**

⛔ Bug no detectado por falta de `expect(...).toThrow()`.
Se bloqueó el commit hasta que se cubrió.

---

## 🧠 CHECKLIST DE SIMULACIÓN E2E REAL

* ¿Captura errores de `page.on('console')`?
* ¿Valida el estado visual del DOM tras cada acción?
* ¿Carga sample real y mide resultado esperado?
* ¿Simula comportamiento del usuario (scroll, input)?
* ¿Valida logs críticos de proceso? (`console.log`, `network`)
* ¿Verifica que NO hay memory leaks? (`JSHeapUsedSize`)
* ¿Tiempo total de flujo < 5s en hardware estándar?

> Si respondes "no" a uno → El test no simula la realidad → Corrección inmediata

---

## 🔁 CICLO DE INTEGRACIÓN BRUTAL

```
1. Bernard escribe test de flujo completo (E2E)
2. Tú como copiloto:
   - Verificas cobertura de errores y logs
   - Exiges límite de tiempo y memoria
   - Cachas edge cases no cubiertos
3. Solo entonces se permite integración con código real
4. Bernard prueba contra samples rotos, pesados y extremos
5. Si el código pasa, se marca como “VALIDADO PARA GUERRA”
```

---

## 📊 EJEMPLO DE REPORTE BRUTAL DE MÉTRICAS

```json
{
  "module": "AudioUploader",
  "coverage": "92%",
  "mutationScore": "78%",
  "consoleErrors": 0,
  "memoryUseMB": 34.2,
  "executionTimeMs": 2100,
  "logValidation": true,
  "flakyTests": false
}
```

---

## 💀 ERRORES IMPERDONABLES EN ESTE TOMO

* Ignorar logs en E2E
* Dejar errores del browser sin validar
* Usar IA para escribir flujos enteros
* Permitir sugerencias sin justificación
* Simular sin capturar inputs reales del usuario
* No simular caída de red o API (sin mocking realista)
* Dejar pasar tests que solo validan “que no crashea” (eso no prueba nada)

---

## 🧩 TU MISIÓN PARA TOMO III

Cuando hayas:

* Simulado al usuario como un maldito actor de método
* Rechazado 3 sugerencias inútiles de IA
* Capturado al menos 1 error de consola invisible

Entonces estás listo para `agents-tomo-III.md`:
**"Arquitectura desacoplada o muerte."**

---

```
FIRMADO EN CÓDIGO Y SANGRE:
THE ULTIMATE BRUTAL QUALITY ENFORCER
```