# `/v1/diarize` responde 502 desde el 2026-10-27

Status: In progress (sólo falta el secret)
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

## Decisión (Bernard, 2026-10-27): la puerta OpenAI de AIRE, no Azure

El recurso que autenticaba `DIARIZE_OPENAI_KEY` era `insult-openai` (insult-rg), borrado el
2026-10-16 con todo el resource group; por eso el 401. No se repone en Azure: la diarización sale
por la puerta OpenAI de AIRE (backlog AIRE #51), `https://gate.bernarduriza.com/openai/v1/chat/completions`,
forma OpenAI pura (Bearer, `"model": "gpt-5.4-mini"`), llave invitada `susurro-diarize` con techo
5.00 USD (`~/.secrets/aire-key-susurro-diarize.txt`).

Hecho (commit `4c92edf`, CD verde, `/health` reporta ese SHA):

- `api/main.py` `_diarize_window`: URL fija `{DIARIZE_OPENAI_ENDPOINT}/chat/completions`, header
  `Authorization: Bearer`, `model` en el body, `max_completion_tokens` (gpt-5.x rechaza
  `max_tokens` con 400, medido contra la puerta), `temperature 0.1` se queda (aceptada).
  `DIARIZE_DEPLOYMENT` / `DIARIZE_API_VERSION` eliminados; `engine` ahora `aire-gpt-5.4-mini`.
- Container App: `DIARIZE_OPENAI_ENDPOINT=https://gate.bernarduriza.com/openai/v1`,
  `DIARIZE_MODEL=gpt-5.4-mini`, `DIARIZE_DEPLOYMENT` removido.
- Recibo de la forma contra la puerta (18:0xZ): HTTP 200, `gpt-5.4-mini-2026-03-17`, 160 tokens,
  4 segmentos Hablante 1/2 correctos sobre un diálogo de prueba.

Falta: el valor del secret `diarize-openai-key` del Container App (la sesión de Claude no puede
escribir secret stores; lo corre Bernard):

    az containerapp secret set -n susurro-gateway -g susurro-rg --secrets "diarize-openai-key=$(grep -oE '^AIRE_KEY_SUSURRO_DIARIZE=.+$' ~/.secrets/aire-key-susurro-diarize.txt | cut -d= -f2-)" && az containerapp update -n susurro-gateway -g susurro-rg --set-env-vars DIARIZE_MODEL=gpt-5.4-mini -o none

Recibo de cierre: `POST /v1/diarize` en `sus.bernarduriza.com` devolviendo 200 con `speakers`
(hoy devuelve 502 "Diarize LLM 401: AIRE: unknown key", que ya es la puerta nueva hablando).
