# `/v1/diarize` responde 502 desde el 2026-10-27

Status: Proposed
Proposed: 2026-10-27 by Claude

## Qué es

Toda sesión de `dictar` con 2+ frases termina con `⚠ diarize: HTTP Error 502: Bad Gateway`. La ruta
(`api/main.py`, `_diarize_window`) convierte en 502 cualquier respuesta no-200 del LLM de Azure
(`DIARIZE_OPENAI_ENDPOINT` / deployment `gpt-4.1` / api-version `2024-02-15-preview`) y pone el
código y el cuerpo del upstream en `detail`. El detalle no se pudo leer el 27-oct: el token de
onboarding agotó sus 50 peticiones del día (`429 Daily limit reached`).

## Siguiente paso

Con la llave de proyecto (`~/.secrets/susurro-gateway-key.txt`), una sola llamada:

    curl -s -X POST https://sus.bernarduriza.com/v1/diarize -H "Authorization: Bearer $SUSURRO_KEY"       -H "Content-Type: application/json" -d '{"transcript":"Hola.
Hola, soy Ana."}'

El `detail` dirá si el deployment `gpt-4.1` ya no existe (404), si la llave `DIARIZE_OPENAI_KEY` caducó
(401) o si es cuota (429). El arreglo es de configuración del Container App (`az containerapp secret
set` / env), no de código; `az` no está en la ThinkPad.

## Decisión de Bernard

Qué deployment y recurso de Azure debe usar la diarización hoy.
