# Antieco: alinear mic y bocina con reloj, no con una cola, para que el AEC quite el eco y no sólo lo atenúe

Status: Proposed
Proposed: 2026-10-27 by Claude (recibo vivo de la ronda 1 del /schizo-modernizer)

## Qué es

`antieco.py` empareja cada frame del mic con el siguiente frame de la cola `referencia` que llena
`FuenteLoopback`. Medido en vivo con `recibo_antieco.py` (wav por la bocina, mic abierto, buffer
dshow de 30 ms): media del mic durante la bocina 116 rms sin AEC → 28 con AEC, p90 267 → 145, pero los
picos (382) siguen cortando los mismos 2 utterances falsos de BERNARD. En sintético (desfase fijo de
40 ms) el mismo AEC quita 20 dB. La diferencia es el desfase inestable: ~13 % de los frames llegan sin
referencia o se tiran para resincronizar, y AEC3 re-estima el retardo cada vez.

## Camino canónico a reusar

- Sellar cada frame con `time.monotonic()` al salir de ffmpeg y del callback de PortAudio, y emparejar
  por tiempo (el frame de bocina cuyo sello está `delay` ms antes del del mic), con `delay` estimado
  una vez por correlación cruzada al arrancar y pasado como `stream_delay_ms`.
- Sin el silencio inyectado como «frames reales»: en huecos de la bocina alimentar ceros por tiempo,
  no por turno de cola.
- Alternativa sin AEC: marcar como BOCINA el utterance del mic cuyo texto coincide (similitud ≥ 0.8)
  con un `[LLAMADA]` que se traslapa en tiempo; no borra texto, lo etiqueta con la evidencia.

## Decisión de Bernard

Si vale la alineación por reloj o basta con audífonos en llamadas (hoy la recomendación vigente).

## Siguiente paso

Reproducir con `ESCUCHA_AEC=0/1 python -X utf8 escucha/recibo_antieco.py <wav>` y comparar la media
del mic durante la bocina; meta: que no se produzca ningún utterance BERNARD con la bocina sola.
