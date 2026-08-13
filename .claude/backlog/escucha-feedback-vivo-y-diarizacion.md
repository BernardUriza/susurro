# Escucha: feedback visual en vivo + diarización de hablantes

Status: Done
Proposed: 2026-08-13 by Bernard (dictado, cerrando el ensayo Minicor)
Done: 2026-08-13 — vúmetro RMS en vivo (stdlib) + diarización al cierre vía
`POST /v1/diarize`

## What it is

Dos mejoras al motor de escucha (`escucha/motor.py` + `dictar.py`), pedidas en
caliente tras usar el flujo como copiloto de ensayo de entrevista:

1. **Feedback en vivo de captura** — "quiero estar viendo si sí se está
   capturando lo que se está diciendo, porque a veces me quedo con: ¿lo habrá
   entendido? ¿se habrá escuchado bien?". Referencia explícita: la vista en
   tiempo real de Deepgram (texto apareciendo mientras hablas, aunque sea
   parcial/borrador). Hoy el único feedback son los `CACHO n` que llegan tras
   500ms de silencio — entre frase y frase el hablante está a ciegas.
   Un indicador barato intermedio: vúmetro/RMS en vivo ("te estoy oyendo a
   volumen X") aunque el texto tarde.

2. **Diarización** — con ruido o dos voces (él + el TTS de ChatGPT por las
   bocinas en el ensayo, o él + Faizaan en una llamada real), el transcript no
   distingue quién habló y los turnos se mezclan (pasó hoy: cachos con mitad
   pregunta del entrevistador, mitad respuesta). El gateway ya expone
   `POST /v1/diarize` (ver skill susurramelo) — está sin cablear al motor.

## Canonical path to reuse (Art. 6)

- Gateway Susurro: `POST /v1/diarize` ya existe; cablearlo como post-proceso
  del wav por utterance o de la sesión completa.
- `backend-deepgram/` ya vive en este repo — si Deepgram streaming es el
  camino para el feedback vivo, la integración parte de ahí, no de cero.
- Relacionado: [[triple-whisper-stream]], [[refinado-whisper]].

## The decision that's the owner's

- ¿Feedback vivo = texto parcial streaming (Deepgram/gateway) o basta un
  vúmetro local (stdlib, cero dependencias, cabe en motor.py)?
  → **Decidido: vúmetro local** (2026-08-13). Texto parcial streaming queda
  como mejora futura si el vúmetro no basta.
- ¿Diarización por utterance (latencia por frase) o al cierre de la sesión?
  → **Decidido: al cierre** (2026-08-13). `/v1/diarize` es diarización LLM
  sobre el TRANSCRIPT (texto, no acústica — lo dice `/v1/discovery`), así que
  por utterance ni aplica.

## Status / next step

Construido y verificado offline el 2026-08-13:

- `MotorCaptura(..., on_rms=)` — hook por frame (~30ms) desde el segmentador;
  si truena se apaga solo con aviso en `fallos`.
- `dictar.py::Vumetro` — barra RMS log-escala en stderr con `\r`, solo TTY;
  stdout queda limpio para el protocolo CACHO/FIN/MURIO de los Monitores.
- `motor.diarizar(texto, fallos)` — POST al gateway, mapea Hablante 1/2 →
  Hablante A/B; None si falla y el transcript queda sin diarizar (el flujo de
  dictado jamás se rompe). `dictar.py` la llama al FIN con ≥2 frases y anota
  la sección `## Hablantes` en `transcripcion.md`.
- De pilón: `_leer_key` sin `re.M` nunca encontraba `SUSURRO_KEY=` (línea 5
  del archivo) — el tier gateway de STT llevaba roto en silencio; arreglado.
