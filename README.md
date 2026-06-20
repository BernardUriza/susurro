# susurro

A single self-owned **STT / TTS gateway**. One endpoint, one key per app, usage metered
per key. The voice engine behind it (Azure OpenAI today, self-hosted later) is an
implementation detail — consumers only ever talk to susurro.

**Live:** https://sus.bernarduriza.com · [docs](https://sus.bernarduriza.com/docs) ·
[admin](https://sus.bernarduriza.com/admin)

## Why

So every app/agent calls *one* place for speech instead of holding a vendor SDK + key.
Swap the engine underneath without touching a single consumer.

## API

All `/v1/*` calls send `Authorization: Bearer <token>`.

| Endpoint | Does |
|---|---|
| `GET /health` | liveness + version (keyless) |
| `GET /ready` | real upstream probe — 503 if voice can't serve |
| `GET /v1/discovery` | machine-readable contract for agent self-onboarding |
| `POST /v1/tts` | `{input, voice?, format?}` → audio bytes |
| `POST /v1/stt?language=es` | raw audio body → `{transcript, engine}` (`?engine=whisper\|deepgram`) |
| `POST /v1/refine` | `{web_speech_text, deepgram_text}` → `{refined}` (Claude) |
| `POST /v1/claim` | redeem a one-time claim code → token shown once |

### Azure OpenAI compatible

susurro is a drop-in for the Azure OpenAI audio API. Point an Azure-OpenAI-shaped client's
endpoint at `https://sus.bernarduriza.com` and use your susurro token as the `api-key` —
zero code change:

- `POST /openai/deployments/{deployment}/audio/speech`
- `POST /openai/deployments/{deployment}/audio/transcriptions`

### Admin (gated by `ADMIN_TOKEN`)

`GET /admin/keys` · `GET /admin/usage` · `POST /admin/keys` · `POST /admin/keys/{token}/revoke`
· `POST /admin/claims` · `GET /admin/claims` · `DELETE /admin/claims/{code}`

## Onboarding a new app

1. In `/admin`, "Onboard a new app" → creates a one-time **claim link**.
2. Send the link to the app owner. They open it at `/claim`, the token is shown **once**, and
   the link burns. You never handle the token in plaintext.
3. The app's usage and cost then show under its name in `/admin`.

The token on `/docs` is a rate-limited **demo** token (try the API), not production onboarding.

## Architecture

- `api/` — FastAPI gateway on **Azure Container Apps** (`susurro-gateway`, rg `insult-rg`),
  proxying a dedicated Azure OpenAI resource (`susurro-openai`). Per-key metering in Azure
  Table Storage. Serves the SPA statically.
- `web` (`src/`) — Vite + React 19: `/` and `/docs` (public), `/admin` (gated), `/claim`.

## Deploy

```bash
az acr build --registry insultacr --image susurro-gateway:vN --file api/Dockerfile api/
az containerapp update -n susurro-gateway -g insult-rg \
  --image insultacr.azurecr.io/susurro-gateway:vN --set-env-vars GATEWAY_VERSION=vN
```

Secrets (`ADMIN_TOKEN`, `AZURE_OPENAI_KEY`, `TABLES_CONN`, …) are set out-of-band via
`az containerapp secret set`, never in the image. See `api/main.py` for the full env contract.

## Roadmap

See `ROADMAP.html`. Next: migrate remaining consumers, then swap the engine to self-hosted
Whisper + Kokoro/Piper (the contract doesn't change).

## License

MIT
