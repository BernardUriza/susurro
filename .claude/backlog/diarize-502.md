# `/v1/diarize` responde 502 desde el 2026-10-27

Status: Proposed
Proposed: 2026-10-27 by Claude

## Qué es

Toda sesión de `dictar` con 2+ frases termina con `⚠ diarize: HTTP Error 502: Bad Gateway`. La ruta
(`api/main.py`, `_diarize_window`) convierte en 502 cualquier respuesta no-200 del LLM de Azure
(`DIARIZE_OPENAI_ENDPOINT` / deployment `gpt-4.1` / api-version `2024-02-15-preview`) y pone el
código y el cuerpo del upstream en `detail`.

## Causa (leída el 2026-10-27 con la llave de proyecto `thinkpad-escucha`)

    POST /v1/diarize → HTTP 502 en 0.48 s
    detail: Diarize LLM 401: {"error":{"code":"401","message":"Access denied due to invalid
    subscription key or wrong API endpoint. Make sure to provide a valid key for an active
    subscription and use a correct regional API endpoint for your resource."}}

El recurso de Azure OpenAI rechaza la credencial: `DIARIZE_OPENAI_KEY` caducó o fue rotada, o
`DIARIZE_OPENAI_ENDPOINT` apunta a otro recurso/región. No es el deployment (sería 404) ni cuota
(sería 429). El `/health` del gateway sigue diciendo `"diarize": true` porque sólo mira que las
variables estén puestas, no que autentiquen.

## Siguiente paso

Arreglo de configuración del Container App, no de código: `az containerapp secret set` con la llave
vigente del recurso de Azure OpenAI (o el endpoint correcto) y nueva revisión. `az` no está en la
ThinkPad; se hace desde la Mac. Recibo: la misma llamada de arriba devolviendo 200 con `speakers`.

## Decisión de Bernard

Qué recurso de Azure OpenAI (endpoint + llave) debe usar la diarización hoy.
