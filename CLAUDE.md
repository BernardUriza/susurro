# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Two things live in this repo:

1. A Vite + React 19 demo app (`src/`) on top of a publishable core library
   (`packages/susurro`, published as `susurro-audio`). Audio is denoised/VAD'd in-browser by
   the vendored **Murmuraba v3** engine, then transcribed through up to four tiers
   (Web Speech → local Whisper → Deepgram → Claude refinement).
2. The **Susurro Voice Gateway** (`api/`) — a FastAPI service hosted on **Azure Container
   Apps** that is Bernard's single self-owned STT/TTS provider for all his apps. Consumers
   present a bearer `SUSURRO_KEY`; the gateway holds the upstream Azure OpenAI key so no
   consumer ever sees it. This is the strategic core; the demo app is the showcase.

## Commands

```bash
npm i                      # installs root + all workspaces
npm run dev                # FULL stack: package watch + Vite + python backends + test watch (5 panes)
npm run dev:no-backend     # package watch + Vite only — use this if you don't have the python backends
npm run dev:simple         # Vite only (copy:wasm + vite)
npm run dev:onrender        # Vite against the Render-hosted python backend (VITE_USE_RENDER=true)

npm run build              # copy:wasm + generate icons + vite build → dist/
npm run copy:wasm          # copies rnnoise.wasm into public/wasm (REQUIRED before any dev/build)

npm run type-check         # tsc --noEmit
npm run lint               # eslint, --max-warnings 0 (warnings fail)
npm run lint:fix
npm run analyze:dead-code  # knip (config/knip.config.ts)
```

### Tests (Vitest)

```bash
npm test                                   # vitest run (everything once)
npm run test:watch                         # watch, dot reporter
npm run test:unit                          # packages/susurro/tests only
npm run test:integration                   # test/integration (backend API, needs a backend up)
npm run test:e2e                           # test/e2e (Puppeteer-driven full pipeline)
npm run test:all                           # unit → integration → e2e in sequence
npx vitest run test/e2e/whisper-pipeline.test.ts   # a single test file
npx vitest run -t "name of the test"               # a single test by name
```

## Critical gotchas (verified, not in the README)

- **`api/*.py` are gitignored except by force.** The repo-wide `.gitignore` has `*.py`; the
  gateway (`api/main.py`) is committed via a negation (`!api/main.py`). The legacy
  `backend/main.py` / `backend-deepgram/server.py` referenced by `npm run dev` are NOT in the
  repo (only requirements/Dockerfile/render.yaml), so `npm run dev` will fail its `🎙️ WHISPER`
  and `🌊 DEEPGRAM` panes on a fresh clone — use `npm run dev:no-backend`, or point
  `VITE_DEEPGRAM_BACKEND_URL` at the deployed gateway.
- **Production transcription/synthesis now goes through the Azure gateway (`api/`), not
  Netlify.** Netlify was removed. See the gateway section below.
- **`copy:wasm` must run before dev/build** (it's baked into the `dev*`/`build` scripts). It
  copies `packages/murmuraba/dist/rnnoise.wasm` → `public/wasm/`. If the murmuraba package
  hasn't been built/installed, this step fails and the engine won't init.
- **COOP/COEP headers are required** for `onnxruntime-web` (SharedArrayBuffer). The Vite dev
  server sets `Cross-Origin-Embedder-Policy`/`Cross-Origin-Opener-Policy` (vite.config.ts),
  and `netlify.toml` sets `credentialless` for prod. A host that strips these breaks Whisper.
- The **gateway** deploys to **Azure Container Apps** (`susurro-gateway` in `insult-rg` /
  `insult-env`, image in `insultacr`). The demo frontend is a static Vite build (host
  anywhere). README still says Vercel/Netlify — it's wrong, ignore it.

## The Voice Gateway (`api/`)

A single FastAPI service (`api/main.py`) that is Bernard's self-owned STT/TTS provider. All
his apps call it instead of holding Azure/Deepgram/Anthropic keys directly.

| Route | Auth | Does |
|---|---|---|
| `GET /health` | none | liveness + `version` (Container Apps probe; keep keyless) |
| `GET /ready` | none | real 1-char TTS probe of the upstream → 503 if voice can't serve |
| `GET /v1/discovery` | none | machine-readable contract (incl. the Azure-compat endpoints) |
| `POST /v1/stt` | `Bearer` | audio body → `{transcript}`. `?engine=whisper`(default)`\|deepgram`, `?language=` |
| `POST /v1/tts` | `Bearer` | `{input, voice?, format?}` → audio bytes |
| `POST /v1/refine` | `Bearer` | `{web_speech_text, deepgram_text}` → `{refined}` (Claude) |
| `POST /v1/claim` | none | redeem a one-time claim code → token shown once, claim burns |
| `POST /openai/deployments/{d}/audio/speech` | `api-key` or Bearer | Azure-OpenAI-compat TTS shim |
| `POST /openai/deployments/{d}/audio/transcriptions` | `api-key` or Bearer | Azure-compat STT (multipart → `{text}`) |
| `GET /admin/keys` `GET /admin/usage` | `Bearer ADMIN_TOKEN` | list keys + per-key/aggregate usage |
| `POST /admin/keys` `POST /admin/keys/{t}/revoke` | `ADMIN_TOKEN` | mint / revoke a project key |
| `POST /admin/claims` `GET /admin/claims` `DELETE /admin/claims/{code}` | `ADMIN_TOKEN` | manage one-time claim links |

- **Auth model:** each app has its OWN named project key (kind `project`, unlimited) — minted
  via the claim flow, identified by `name` in `/admin`, usage metered per key in Azure Tables.
  The public onboarding token (kind `onboarding`, `/docs`) is a rate-limited DEMO token, not
  production onboarding. The upstream Azure key is a Container App secret (`azure-openai-key`),
  never leaves the gateway. Keys consumers hold are in `~/.secrets/susurro-key-<app>.txt`.
- **Onboarding = claim flow:** admin creates a claim in `/admin` → shareable `/claim#code` URL
  → app owner redeems once → token revealed to them → claim burns. Admin never sees the token.
- **Engine is swappable:** STT/TTS proxy the **dedicated `susurro-openai`** Azure resource
  (`susurro-rg`, deployments `tts`/`whisper`) — NOT insult-openai (its voice deployments were
  deleted). The `/v1/*` + Azure-compat contract is the stable interface; the engine can be
  swapped to self-hosted Whisper/TTS later with zero consumer change.
- **Run locally:** `cd api && pip install -r requirements.txt && uvicorn main:app --reload`,
  with the `AZURE_OPENAI_*` and `SUSURRO_KEYS` env vars set (see `.env.example`).
- **Build & deploy:** `az acr build --registry insultacr --image susurro-gateway:vN --file
  api/Dockerfile api/`, then `az containerapp update -n susurro-gateway -g insult-rg --image
  insultacr.azurecr.io/susurro-gateway:vN`. Secrets are set out-of-band with
  `az containerapp secret set` (never in the image). Local `az acr build` needs working
  pyexpat — if it errors, see the expat relink fix in `~/CLAUDE.md`.

## Architecture

### Workspaces (npm `workspaces: packages/*`)

| Package | Dir | Role |
|---|---|---|
| `susurro-audio` (alias `@susurro/core`) | `packages/susurro` | The publishable hook library — all transcription logic lives here |
| `murmuraba` v3 | `packages/murmuraba` | Vendored neural audio engine (RNNoise denoise + VAD), `file:` dep |
| `@jitsi/rnnoise-wasm` | `packages/rnnoise-wasm` | RNNoise WASM binary |

The Vite alias `@susurro/core → packages/susurro/src` means the demo app consumes the
library **source directly** — no library build needed for dev, edits hot-reload across the
workspace boundary.

### The hook layer (`packages/susurro/src`) — NOT a singleton anymore

The old "singleton AudioEngineManager" is gone (`index.ts`: *"Singleton patterns eliminated -
replaced with hook-based architecture"*). The engine lifecycle is now owned by Murmuraba's own
`useMurmubaraEngine`, wrapped by `useSusurro`. Key hooks:

- `use-susurro.ts` — the main entry; wires Murmuraba (denoise/VAD/streaming chunks) to the
  transcription backends, emits `SusurroChunk`s (`audioUrl` + `transcript` + VAD score).
- `use-dual-transcription.ts` / `use-triple-transcription.ts` — orchestrate multiple
  transcription sources (Web Speech, Whisper, Deepgram) + optional Claude refinement.
- `use-web-speech.ts`, `use-transcription-worker.ts`, `use-audio-worker.ts`,
  `use-model-cache.ts`, `use-latency-monitor.ts` — supporting concerns (worker offload,
  model caching, <300ms latency tracking).
- `lib/chunk-middleware.ts` — `ChunkMiddlewarePipeline`: per-chunk transform hooks
  (translation/sentiment/intent/quality) that enrich `chunk.metadata`.
- `lib/backend-deepgram.ts`, `lib/backend-whisper.ts`, `lib/dynamic-loaders.ts` — backend
  adapters; Transformers.js / Murmuraba are **dynamically imported** so they're code-split
  into `vendor-transformers` / `vendor-murmuraba` chunks (see `manualChunks` in vite.config).

### The demo app (`src/`)

- `contexts/NeuralContext.tsx` — `NeuralProvider` instantiates **one** `useSusurro` instance
  (default `initialModel: 'deepgram'`, 20s chunks, `BALANCED` engine preset) and exposes it
  via `useNeural()`. **Consume audio through `useNeural()`, not a fresh `useSusurro()`** — a
  second `useSusurro` spins up a second Murmuraba engine. This is the reason for the rule, not
  a singleton class.
- `services/whisper-backend.ts` — client for the transcription backend; resolves the URL from
  `VITE_DEEPGRAM_BACKEND_URL` (localhost:8001 in dev → python; `/.netlify/functions` in prod),
  exposes health checks surfaced as `backendStatus`/`backendHealth` on the context.
- `features/audio-processing`, `features/visualization` — the UI feature modules.

### Transcription tiers (data flow)

```
mic → Murmuraba (RNNoise denoise + VAD) → clean SusurroChunk
   ├─ Web Speech API        (browser-native, instant, VITE_ENABLE_WEB_SPEECH)
   ├─ Whisper               (Transformers.js, fully in-browser, WebGPU, q4 quantized)
   ├─ Deepgram              (via backend proxy — python dev / Netlify fn prod)
   └─ Claude refinement     (netlify/functions/claude-refine.ts, VITE_ENABLE_CLAUDE_REFINEMENT)
```

## Environment

Copy `.env.example` → `.env.local`. Notable vars: `VITE_DEEPGRAM_API_KEY`,
`VITE_ANTHROPIC_API_KEY`, `VITE_DEEPGRAM_BACKEND_URL`, and feature flags
`VITE_ENABLE_WEB_SPEECH` / `VITE_ENABLE_CLAUDE_REFINEMENT` / `VITE_ENABLE_LOCAL_WHISPER`.

## Conventions

- File naming is kebab-case in `packages/susurro` (e.g. `use-dual-transcription.ts`).
- `lint` runs with `--max-warnings 0` — a warning is a build failure; clean them, don't suppress.
- When eliminating dead code, run `npm run analyze:dead-code` (knip) rather than guessing.
- Always clean up MediaStream tracks / AudioContext on unmount (the engine holds the mic).
