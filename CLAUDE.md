# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Three things live in this repo:

1. A Vite + React 19 demo app (`src/`) on top of a publishable core library
   (`packages/susurro`, published as `susurro-audio`). Audio is denoised/VAD'd in-browser by
   the vendored **Murmuraba v3** engine, then transcribed through up to four tiers
   (Web Speech → local Whisper → Deepgram → Claude refinement).
2. The **Susurro Voice Gateway** (`api/`) — a FastAPI service hosted on **Azure Container
   Apps** that is Bernard's single self-owned STT/TTS provider for all his apps. Consumers
   present a bearer `SUSURRO_KEY`; the gateway holds the upstream Azure OpenAI key so no
   consumer ever sees it. This is the strategic core; the demo app is the showcase.
3. The **Motor de Escucha** (`escucha/`) — the SSOT for LOCAL mic capture + voice-based
   segmentation + live transcription on the Mac AND on Windows (Python, stdlib only on the
   Mac; `PyAudioWPatch` on Windows). Consolidated
   2026-08-13 from four scattered voice-to-text implementations. ffmpeg streams raw PCM
   through a pipe; a segmenter thread cuts utterances at ~500 ms of silence AFTER speech
   (RealtimeSTT/ecoute pattern — whole phrases, never clock slices); STT tiers are
   `hear` (local, es-MX, Mac only) → Susurro Gateway fallback (the only tier on Windows).
   Mic selected by NAME, virtual devices (Teams/BlackHole/etc.) excluded.
   **Windows (ported 2026-10-27 on the Infios ThinkPad):** capture is `-f dshow` by the
   device's ASCII "Alternative name"; ffmpeg comes from winget (`Gyan.FFmpeg`, resolved by
   `ffmpeg_bin()` even before the shell reloads PATH); run with `python -X utf8 -m
   escucha.dictar <etiqueta>` (cp1252 consoles choke on the emojis otherwise); a background
   process gets no Ctrl+C, so the portable stop is creating the file `PARAR` inside the
   session folder. A SECOND source, `FuenteLoopback` (WASAPI loopback of the default
   speakers via PyAudioWPatch, callback mode — blocking `read()` + `close()` segfaults),
   feeds the same segmenter tagged `[LLAMADA]`: that is how the remote party of a Teams
   call is heard, since Teams mutes the mic at device level while you are muted and the
   remote voice never enters the mic anyway. The loopback delivers NOTHING while nothing
   plays (measured: 0 chunks/s idle, 100/s with audio), so `frames()` injects silence to
   keep the silence cut alive. It must capture at the device's native rate (48 kHz stereo;
   16 kHz mono is refused) and `a_16k_mono()` converts. `ESCUCHA_BOCINA=0` disables it.
   Short near-silent utterances (`RMS_SOSPECHOSO`, 60 on Windows) are dropped before STT:
   Whisper turns them into «¡Gracias!» / «Thank you.» (31 of 37 phrases in one session).
   **Echo cancellation (2026-10-27):** `escucha/antieco.py` runs WebRTC AEC3 (`pywebrtc-audio`)
   on every mic frame with the loopback frames as the far-end reference (`FuenteLoopback`
   tees each delivered frame, silence included, into `referencia`), so the remote party heard
   through open speakers is subtracted from the mic before segmentation; `ESCUCHA_AEC=0`
   disables it. The mic is captured with `-audio_buffer_size 30` (`MIC_BUFFER_MS`): dshow's
   default delivers ~500 ms bursts (measured p95 491 ms) and the AEC needs a steady 30 ms
   cadence to pair frames. WASAPI hands the loopback in ~10 ms chunks, so `frames()` re-blocks
   them into exact 30 ms frames. Synthetic receipt: echo −20 dB, voice −1 dB, 0.6 % CPU.
   LIVE receipt (2026-10-27, `escucha/recibo_antieco.py`, wav through the speakers, mic
   open): mic mean during playback 116 rms → 28 with AEC (4×), p90 267 → 145, but the peaks
   still segmented the same 2 false BERNARD utterances. It attenuates, it does not remove:
   the mic/loopback pairing still jitters (~13 % of frames re-synced) and AEC3 needs a
   stable delay. Headphones remain the safe setup; finer alignment is in the backlog. Loopback smoke test before a call: `python -X utf8 escucha/recibo_loopback.py --tts "<english text>" --lang en-US` (gateway TTS clip → dictar → speakers → PARAR → cachos with rms, latency and careo; 2026-10-27 receipt: two `[LLAMADA]` cachos near-verbatim, mic at rms 16 discarded as silence). Never `kill` dictar in a harness: wait for the banner's `Parar:` line and touch that PARAR. **STT redundancy (2026-10-27):** `escucha/careo.py` runs two engines on
   the same wav and a judge when they disagree: whisper + deepgram via the gateway with
   `/v1/refine` as judge when `/health` reports `deepgram`/`claude` configured (both OFF
   today, missing Container App secrets), otherwise whisper + the LOCAL tier as the second
   witness. The local tier is `escucha/stt_local.py`: NVIDIA Parakeet-TDT 0.6B v3 int8 on
   `sherpa-onnx` (~640 MB in `~/.cache/susurro/modelos/`, loads in ~2 s, 0.1-0.2 s per
   utterance on the ThinkPad CPU, got "Infios" right where whisper wrote "Infuse"); it also
   answers when the gateway fails (429/5xx/down) and gives the acoustic second opinion on
   weak hallucinations («¡Gracias!»). NOT Whisper: local Whisper stays retired. It is NOT
   the primary engine: measured over 38 recorded utterances it drifts to English on short
   Spanish clips («test the Ecoli», «Vapority») while whisper with `language=es` holds; it
   beats whisper on the TTS proper noun («Infios» ×5) and returns nothing on the 24
   near-silent clips whisper turned into «¡Gracias!» / «Bye.», which is exactly the witness
   the careo needs.
   `calentar_gateway()` wakes Azure Whisper at start (cold 25.8 s vs warm 1.2 s measured),
   reads the careo capabilities and loads the local model; `stt_gateway` retries once on
   429 (honoring `Retry-After`) and 5xx. `dictar.py` transcribes up to three utterances
   concurrently; the transcript keeps the time the audio was CUT, not when the text arrived.
   Consumers: `escucha/dictar.py` (terminal
   dictation) and `~/Documents/compras/llamadas/escucha.py` (call copiloto: coach +
   folio extraction). Any new local voice capture MUST consume `escucha/motor.py` —
   do not write a new recorder. Transcribing an ALREADY-RECORDED audio/video file
   goes through `escucha/archivo.py` (`transcribir_archivo()` / global `transcribir`
   CLI): ffmpeg re-encodes + splits at silences under Azure's 25 MB cap, posts each
   piece to the gateway's Azure-compat route (verbose_json, optional word timestamps),
   honors `Retry-After`. Every piece is VERIFIED: Whisper's subtitle-credit hallucinations
   ("Subtítulos realizados por la comunidad de Amara.org" over music) are dropped, a suspicious
   piece is retried in smaller pieces (120 s, then 30 s — fresh context), and audio with sound
   that still went unheard comes back in `huecos` with a loud warning, never silently. Local Whisper (mlx_whisper / faster-whisper) was retired
   2026-10-07 — do not reintroduce it. Packaged as the **conda project `escucha`**
   (`escucha/environment.yml` + root `pyproject.toml`): `conda env create -f
   escucha/environment.yml` installs it editable and drops a global `dictar`
   command in `~/.local/bin` (shebang pinned to the env's python — no activation
   needed). On Windows: `python -m pip install --user -e .` (the `dictar.exe` lands in
   `%APPDATA%\Python\Python314\Scripts`, add it to PATH or use `python -m escucha.dictar`).
   Engine tests: `cd escucha && PYTHONUTF8=1 python -m unittest test_motor_corte test_lexico
   test_loopback test_careo test_antieco`.

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
- The **gateway** deploys to **Azure Container Apps** (`susurro-gateway` in `susurro-rg` /
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
| `POST /v1/diarize` | `Bearer` | `{transcript, num_speakers?}` → `{segments:[{speaker,text}], speakers}` (LLM, text-based) |
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
- **Diarize has a DIFFERENT upstream: the AIRE OpenAI gate, not Azure.** `/v1/diarize` posts
  plain OpenAI shape (`{DIARIZE_OPENAI_ENDPOINT}/chat/completions`, `Authorization: Bearer`,
  `"model": DIARIZE_MODEL`) to `https://gate.bernarduriza.com/openai/v1` with `gpt-5.4-mini`
  (AIRE backlog #51; invited key `susurro-diarize`, local copy
  `~/.secrets/aire-key-susurro-diarize.txt`, Container App secret `diarize-openai-key`). It used
  to point at an `insult-openai` deployment that was deleted 2026-10-16, which made `/v1/diarize`
  return 502 "Diarize LLM 401" while STT/TTS were fine. gpt-5.x rejects `max_tokens` (use
  `max_completion_tokens`); `temperature` is accepted — both measured against the gate 2026-10-27.
- **The upstream is rate-limited to 30 requests/minute — this is the #1 way the gateway
  "looks dead".** Azure provisions voice deployments by `capacity`, and 1 unit = 1 RPM. Both
  `whisper` and `tts` sat at `capacity: 1` until 2026-07-11 (so the SECOND call inside a minute
  got a 429 and the gateway turned it into a 502 — whisper appeared to be down in prod), then at
  `capacity: 3` (the old subscription ceiling). Since a quota increase both are at `capacity: 30`,
  which is the **current ceiling** in northcentralus (`az cognitiveservices usage list -l
  northcentralus` → `OpenAI.Standard.whisper limit=30`, measured 2026-10-27). More requires
  another quota increase (https://aka.ms/oai/quotaincrease). Check the live value before
  blaming the code:
  ```bash
  az cognitiveservices account deployment show -n susurro-openai -g susurro-rg \
    --deployment-name whisper --query "{capacity:sku.capacity, rpm:properties.rateLimits[0].count}"
  ```
- **429 is part of the contract — consumers must honor `Retry-After`.** `azure_post()` wraps
  every upstream Azure voice call: on a 429 it waits out Azure's `Retry-After` and retries
  (bounded by `AZURE_MAX_RETRIES=3` / `AZURE_RETRY_CAP_SECS=30`). When the upstream asks for a
  longer wait than the cap, the gateway returns an honest **429 + `Retry-After`** — never a
  502. A 502 from `/v1/stt` now means a real upstream failure, not saturation. `/ready` reports
  `ready: true, rate_limited: true` on a 429 (a rate limit proves Azure is alive and authing).
- **Run locally:** `cd api && pip install -r requirements.txt && uvicorn main:app --reload`,
  with the `AZURE_OPENAI_*` and `SUSURRO_KEYS` env vars set (see `.env.example`).
- **Deploy is CD, not manual:** push to `master` touching `api/**` or `src/**` →
  `.github/workflows/cd.yml` builds the web bundle into `api/static`, runs `az acr build`
  (tagged with the commit SHA), updates the Container App, and smoke-tests that `/health`
  reports the new SHA. Don't hand-run `az acr build` locally (it also needs working pyexpat —
  see the expat relink fix in `~/CLAUDE.md`). Secrets are set out-of-band with
  `az containerapp secret set` (never in the image).

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
