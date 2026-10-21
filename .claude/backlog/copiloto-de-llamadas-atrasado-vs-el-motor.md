# El copiloto de llamadas se quedó 13 commits atrás del motor

Status: Proposed
Proposed: 2026-08-17 por Bernard (*"ahí dejamos un uso continuo nuevo, no se consolidó bien o qué"*)

## Qué es

`escucha/` (la SSOT del motor de voz) avanzó **13 commits entre el 13 y el 15 de
agosto de 2026**. `escucha/dictar.py` los consumió. El otro consumidor —el copiloto de
llamadas, `~/Documents/compras/llamadas/escucha.py`— **no recibió ninguno**: su mtime
es del 13-ago 11:39, anterior a todo el trabajo del 15.

Es el consumidor que corre bajo presión (Bernard en vivo con un asesor al teléfono) y
es el que quedó con la versión vieja.

### Lo que le falta, con su commit

| Falta | Commit | Qué le daría |
|---|---|---|
| `instrumentacion.py` (JSONL) | `a022dc2`, `94cdcdf` | nació porque *"con un .md no se puede depurar nada"*. `dictar.py` la importa (líneas 81-83); el copiloto no |
| vúmetro RMS en vivo (`on_rms`) | `ead9202` | que Bernard VEA que el micro lo oye, sin preguntar |
| `voz.py` — Bernard / bocina / música | `df11d91`, `3ee1d43` | en altavoz, distinguir su voz de la del asesor |
| `lexico.py` — corpus de alucinaciones | `90042c2` | correcciones auditables sobre lo que suelta `hear` |
| corte en el valle de energía | `770a244` | fin de los utterances cortados a media palabra |
| SIGTERM/SIGHUP drenan con FIN · `$ESCUCHA_LANG` | `e7110e9` | cierre limpio e idioma no hardcodeado |
| `conversacion.py` (RESONANCE) | `a618984` | su propio docstring: *"autocontenido y **NO está cableado a nada**"* |

## Los dos defectos que esto destapó el 2026-08-17

Bernard iba a llamar a DHL con el copiloto y **no salió una sola línea en 13 minutos**.

1. 🟢 **RESUELTO — stdout con buffer de bloque.** Lanzado en background, `fd 1` no es
   TTY, así que Python bufferizaba 8 KB y **todo el stdout salió de golpe al matar el
   proceso**. El motor estaba sano todo el tiempo: el transcript en disco tenía las
   frases. Fix aplicado en el copiloto: `sys.stdout.reconfigure(line_buffering=True)`
   justo después de los imports — sirve con y sin TTY, no depende de cómo se lance.
   Verificado en vivo: el banner ya aterriza al instante sin `PYTHONUNBUFFERED`.

2. 🔴 **ABIERTO — `RMS_MIN` fijo no sobrevive un cambio de cuarto.** Los 57 chunks de
   esa corrida cortaron **todos** por `UTT_MAX_MS` (13.5–14.9 s), ninguno por silencio:
   el VAD nunca vio los 500 ms de silencio porque el piso de ruido está muy por encima
   del umbral. Medido sobre 9,337 frames de ambiente real:

   | | RMS |
   |---|---|
   | Silencio real (p1 / p50 / p90) | 42 / 60 / 107 |
   | Bernard hablando (p50 de chunk) | 111 – 273 |
   | `RMS_MIN` por default | **15** |

   Parche vigente: lanzarlo con `RMS_MIN=80`. **Es un parche, no el fix**: un número fijo
   va a volver a estar mal en otro cuarto, en la calle, o con otro micrófono.

## Canonical path to reuse (Art. 6)

El fix de verdad es **auto-calibración en el arranque**, dentro de `motor.py` (la SSOT),
no en cada consumidor: al iniciar, medir ~1.5 s de ambiente, tomar el p90 de esos frames
y fijar el umbral en ~1.5× ese valor, con `RMS_MIN` del entorno como override manual.
Emitir el valor elegido por `instrumentacion` (`evento("vad.calibracion", piso=…,
umbral=…)`) para que quede medido y no se vuelva a diagnosticar a mano.

Con eso los dos consumidores lo heredan y nadie vuelve a adivinar un número.

## La decisión que es de Bernard

Ninguna de arquitectura. La única pregunta abierta es si `conversacion.py` (la máquina
de turnos RESONANCE) se cablea al copiloto de llamadas o se queda para el modo
conversación con bocina — son usos distintos y el copiloto hoy no habla, solo escucha.

## Status / next step

No construido. Lo desbloquea: cerrar la llamada a DHL del 17-ago y entonces (1) cablear
`instrumentacion` al copiloto, (2) construir la auto-calibración en `motor.py` con su
prueba, (3) subir los demás commits del motor al copiloto.

Ver [[escucha-feedback-vivo-y-diarizacion]] (el vúmetro que `dictar` ya tiene y el
copiloto no) y, en compras, `.claude/rules/llamadas-de-compras.md`.
