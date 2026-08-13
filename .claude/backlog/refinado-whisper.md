# Refinado Whisper — segunda pasada que corrige el ticker en vivo

Status: Proposed
Proposed: 2026-08-13 by Bernard (dictado en vivo, sesión `en-vivo-20260813`)

## What it is

El motor de escucha hoy transcribe cada utterance con `hear` (rápido, en vivo,
a veces tonto: "cienas" por "quisieras"). Bernard dictó el diseño de la segunda
capa, textual: *"de unos cinco segmentos de audio, mandar el audio ya compuesto
y si quieres ya sin ruido utilizando el VAD, y se lo mandas directo a Whisper
para que responda ya la puntuación y las palabras más adecuadas que él encontró,
y corrijas los pequeños detalles que pudiste haber escuchado mal con el
transcriptor activo de la computadora."*

Pipeline: cada ~5 utterances → concatenar los wavs (ya vienen limpios del VAD
del segmentador) → una sola pasada por Whisper (más lento, menos tonto) →
reconciliar: la versión Whisper corrige palabras y puntuación del transcript
de hear, marcando el bloque como refinado. hear = ticker en vivo; Whisper =
acta oficial.

## Canonical path to reuse (Art. 6)

- El motor: `escucha/motor.py` — agregar un hilo refinador que consuma los wavs
  ya escritos en el dir de sesión (no tocar el segmentador).
- Whisper local ya instalado: `mlx_whisper` (~/.local/bin). Alternativa: el
  gateway `/v1/stt` que ya es tier 2 — pero el gateway es el MISMO Azure
  Whisper, así que el refinado local con mlx_whisper evita red y costo.
- Concatenación: `ffmpeg concat` o pegado directo de PCM (mismo formato
  16k/mono/s16le — es trivial).
- El transcript refinado reemplaza/anota las líneas `**[hora]**` del bloque en
  el `transcripcion.md` de la sesión.

## The decision that's the owner's

- Si el refinado corre EN VIVO (hilo dentro del motor, el transcript se
  auto-corrige durante la sesión) o POST-SESIÓN (al cerrar, una pasada final).
  El dictado sugiere en vivo ("cada cinco"), pero el post-sesión es más simple
  y no compite por CPU con hear.
- Umbral: ¿5 utterances fijos, o por tiempo (~1 min de audio compuesto)?

## Status / next step

No construido. Desbloquea: greenlight de Bernard sobre en-vivo vs post-sesión.
