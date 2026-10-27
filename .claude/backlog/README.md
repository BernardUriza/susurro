# Backlog — susurro

- [El copiloto de llamadas se quedó 13 commits atrás del motor](copiloto-de-llamadas-atrasado-vs-el-motor.md) — **Proposed** · consolidar instrumentación/vúmetro/léxico en `compras/llamadas/escucha.py` + auto-calibrar el VAD en `motor.py` (el `RMS_MIN=15` fijo no ve el piso de ruido real, medido en 60) (2026-08-17)
- [Implement the Whisper stream in useTripleTranscription](triple-whisper-stream.md) — **Proposed** · el tercer stream del hook (2026-06-20) *(faltaba en este índice; añadido el 2026-08-17)*
- [refinado-whisper](refinado-whisper.md) — **Proposed** · segunda pasada Whisper sobre ~5 utterances compuestos que corrige puntuación y palabras del ticker de hear (dictado por Bernard, 2026-08-13)
- [Escucha: feedback vivo + diarización](escucha-feedback-vivo-y-diarizacion.md) — **Done** (2026-08-13) · vúmetro RMS en vivo en dictar.py + diarización al cierre vía gateway `/v1/diarize`, con Hablante A/B en el transcript
- [El loopback debe seguir al dispositivo de salida cuando Windows lo cambia](loopback-sigue-al-dispositivo-de-salida.md) — **Proposed** · hoy se ata a la bocina default del arranque; si cambia (Bluetooth, dock) el motor oye silencio sin avisar (2026-10-27, /cruel-critic #4)
- [Antieco: alinear mic y bocina por reloj](antieco-alineacion-fina.md) — **Proposed** · en vivo el AEC baja el eco 4× pero los picos siguen cortando utterances falsos de BERNARD; audífonos siguen siendo la recomendación (2026-10-27)
- [`/v1/diarize` responde 502](diarize-502.md) — **Proposed** · causa leída 27-oct: el LLM de Azure OpenAI devuelve 401 (llave o endpoint de `DIARIZE_OPENAI_*` inválidos); arreglo de secretos del Container App desde la Mac (2026-10-27)
