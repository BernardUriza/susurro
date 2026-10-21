# Backlog — susurro

- [El copiloto de llamadas se quedó 13 commits atrás del motor](copiloto-de-llamadas-atrasado-vs-el-motor.md) — **Proposed** · consolidar instrumentación/vúmetro/léxico en `compras/llamadas/escucha.py` + auto-calibrar el VAD en `motor.py` (el `RMS_MIN=15` fijo no ve el piso de ruido real, medido en 60) (2026-08-17)
- [Implement the Whisper stream in useTripleTranscription](triple-whisper-stream.md) — **Proposed** · el tercer stream del hook (2026-06-20) *(faltaba en este índice; añadido el 2026-08-17)*
- [refinado-whisper](refinado-whisper.md) — **Proposed** · segunda pasada Whisper sobre ~5 utterances compuestos que corrige puntuación y palabras del ticker de hear (dictado por Bernard, 2026-08-13)
- [Escucha: feedback vivo + diarización](escucha-feedback-vivo-y-diarizacion.md) — **Done** (2026-08-13) · vúmetro RMS en vivo en dictar.py + diarización al cierre vía gateway `/v1/diarize`, con Hablante A/B en el transcript
