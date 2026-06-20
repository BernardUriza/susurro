# Implement the Whisper stream in useTripleTranscription

Status: Proposed
Proposed: 2026-06-20 by Bernard

## What it is

`useTripleTranscription` (`packages/susurro/src/hooks/use-triple-transcription.ts`)
advertises a 3-stream architecture — WebSpeech + Whisper + Deepgram all feeding
one refiner — but the **Whisper stream is not wired**. `startTranscription` and
`stopTranscription` log `⚠️ Whisper stream not yet implemented` and do nothing
for the Whisper leg; only `addWhisperChunk(text)` lets a caller push text in
manually. So `whisperText` is dead unless the consumer feeds it by hand.

This is public API of the published `susurro-audio` package (exported from
`packages/susurro/src/index.ts`) — the contract claims three live streams, the
implementation delivers two.

## Canonical path to reuse (Art. 6)

Whisper already runs fully in-browser elsewhere in this repo — reuse it, don't
reinvent:
- `packages/susurro/src/lib/backend-whisper.ts` — the Whisper adapter.
- `packages/susurro/src/lib/dynamic-loaders.ts` `loadTransformers()` — lazy
  Transformers.js loader (code-split into `vendor-transformers`).
- `use-susurro.ts` already drives Murmuraba chunks → transcription backends;
  mirror how it streams chunks into Whisper rather than building a new path.

The wiring should start/stop a Whisper transcription loop in
`startTranscription`/`stopTranscription` and route its output through the
existing `setWhisperText` (the same sink `addWhisperChunk` writes to), so the
refiner sees a live third input.

## The decision that's the owner's

- Whether the triple hook should own a Whisper stream at all, or whether
  Whisper stays a manual `addWhisperChunk` feed and the "triple" framing is
  dropped to "WebSpeech + Deepgram + manual Whisper". Renaming/narrowing the
  public contract is an API decision, not a mechanical fix.
- Timing: there is **no internal consumer** today (grep: only the package index
  re-exports it), so this is not load-bearing — sequence it against real demand.

## Status / next step

Not built. Unblocks when a consumer actually needs a live in-browser Whisper
leg in the triple hook. Until then the contract gap is documented here and the
hook's tests ([[../../packages/susurro/tests/use-triple-transcription.test.ts]])
exercise only the implemented behavior (they no longer assert a live Whisper
stream).
