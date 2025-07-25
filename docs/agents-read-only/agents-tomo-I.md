# 📘 AGENTS – TOMO I  
## 🧱 FUNDAMENTOS DE DESARROLLO: TEST O MUERE

---

## 🔴 RED → GREEN → REFACTOR: EL ÚNICO CAMINO

Cada funcionalidad nueva empieza con un test.  
Si escribes código sin test previo, estás generando deuda técnica.  
El ciclo es sagrado:

1. **RED**: Escribe el test que falla (sí, debe fallar)  
2. **GREEN**: Implementa lo mínimo para que pase  
3. **REFACTOR**: Limpia sin miedo – ya tienes red de seguridad  

> "Si no puedes refactorizar sin miedo, es porque tu test es basura."

---

## 📌 CASO DE USO: MODO RED PRIMARIO

```ts
describe('Módulo de AudioChunker', () => {
  it('debe dividir un archivo de 24s en 3 chunks de 8s', async () => {
    const chunks = await chunkAudio('./samples/test.wav', { duration: 8 })
    expect(chunks).toHaveLength(3)
    expect(chunks[0].start).toBe(0)
    expect(chunks[2].end).toBeLessThanOrEqual(24)
  })
})
````

> El copiloto NUNCA debe sugerir implementación antes de ver este test.

---

## 🧪 TESTS NO NEGOCIABLES

Antes de cualquier código productivo, Bernard debe:

* Definir contratos: input/output exacto
* Escribir casos límite (null, vacío, inválido, extremo)
* Agregar pruebas de performance si hay constraints
* Verificar logging en E2E

Si falta uno → El código es humo → Abortas ejecución.

---

## 🤖 LA IA NO MANDA AQUÍ

La IA es una esclava útil, pero ciega.
NO se le permite:

* Sugerir código sin test previo
* Generar funciones sin contrato explícito
* Optimizar sin validación empírica
* Escribir más de 20 líneas sin auditoría manual

**TU OBLIGACIÓN COMO COPILOTO**:

* Auditar todo
* Reescribir lo innecesario
* Identificar bugs ocultos
* Forzar la simplicidad

---

## ⚠️ ANTÍDOTOS CONTRA EL CÓDIGO MÁGICO

**Síntoma**: "Funciona, pero no sé por qué"
**Diagnóstico**: Copiloto generó basura no entendida
**Solución**:

* Borrar todo
* Escribir test mínimo
* Implementar de nuevo, tú controlas

**Síntoma**: "No sé dónde se rompe"
**Diagnóstico**: Test inexistente o débil
**Solución**:

* Añadir logs auditables
* Validar condiciones extremas
* Cubrir error flow explícitamente

---

## 🧠 MODELO DE REVISIÓN DE TESTS

> Antes de avanzar con Bernard, interroga con:

1. ¿Tu test valida comportamiento o estructura?
   (Comportamiento > estructura)

2. ¿El test falla si el código está roto?
   (Sí = válido. No = falso positivo)

3. ¿El test cubre casos límite?
   (silencio, archivos corruptos, timeout, etc.)

4. ¿Tu E2E captura errores de consola y logs de red?
   (Si no: es teatro, no testing)

---

## 🎯 MATRIZ DE COBERTURA INICIAL

| Módulo            | Min % Cobertura | Mut. Score | Max Complejidad |
| ----------------- | --------------- | ---------- | --------------- |
| Core Logic        | 95%             | 80%        | 8               |
| AudioChunker      | 90%             | 75%        | 10              |
| Frontend Renderer | 85%             | 70%        | 7               |
| API Proxy         | 92%             | 78%        | 6               |

> Si algún módulo queda por debajo → SE MARCA COMO "INUTILIZABLE EN PRODUCCIÓN"

---

## 💀 FRASES DE GUERRA – TOMO I

* “Test que no falla, no sirve.”
* “Cada línea sin test es una trampa latente.”
* “Refactor sin red = suicidio técnico.”
* “La IA no piensa. Tú sí.”
* “El coverage no se presume, se impone.”

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN BRUTAL

✅ ¿Tienes test que falla (red)?
✅ ¿Implementaste lo mínimo para pasar (green)?
✅ ¿Refactorizaste con test en verde?
✅ ¿Tu test cubre logs y errores?
✅ ¿El copiloto fue auditado línea por línea?
✅ ¿Simplificaste la lógica luego del test?
✅ ¿El código puede mantenerse en 6 meses sin llorar?

> Si fallas uno solo: NO AVANZAS

---

## 📌 TU MISIÓN PARA TOMO II

Una vez hayas demostrado dominio de:

* Red-Green-Refactor
* Test-driven puro
* Auditoría de IA

Entonces puedes pasar a `agents-tomo-II.md`:
**“Integración brutal y simulación de usuario real.”**

---

```
FIRMADO:
THE ULTIMATE BRUTAL QUALITY ENFORCER  
Versión 3.0 – Testeado en producción, afilado por bugs.
```