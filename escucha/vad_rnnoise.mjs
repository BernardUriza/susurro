// VAD de RNNoise (el mismo WASM de murmuraba, packages/rnnoise-wasm) sobre wavs PCM16 mono.
// Uso: node escucha/vad_rnnoise.mjs <a.wav> [b.wav ...]  → una línea JSON por wav:
//   {"wav":..., "frames":N, "voz_ms":M, "vad_medio":x, "vad_max":y, "ms":cpu}
// RNNoise trabaja a 48 kHz en frames de 480 muestras escaladas a rango int16 (reglas 1, 2 y 5
// de murmuraba); cada frame devuelve una probabilidad de voz 0-1. voz_ms cuenta los frames > UMBRAL.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import createRNNWasmModuleSync from "../packages/rnnoise-wasm/dist/rnnoise-sync.js";

const UMBRAL = Number(process.env.VAD_UMBRAL || "0.5");
const TASA = 48000;
const FRAME = 480;

function leerWav(ruta) {
  const b = readFileSync(ruta);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") throw new Error(`${ruta}: no es WAV`);
  let pos = 12, tasa = 0, canales = 1, bits = 16, datos = null;
  while (pos + 8 <= b.length) {
    const id = b.toString("ascii", pos, pos + 4);
    const largo = b.readUInt32LE(pos + 4);
    if (id === "fmt ") {
      canales = b.readUInt16LE(pos + 10);
      tasa = b.readUInt32LE(pos + 12);
      bits = b.readUInt16LE(pos + 22);
    } else if (id === "data") {
      datos = b.subarray(pos + 8, Math.min(b.length, pos + 8 + largo));
    }
    pos += 8 + largo + (largo % 2);
  }
  if (!datos || bits !== 16) throw new Error(`${ruta}: se esperaba PCM16 (bits=${bits})`);
  const n = Math.floor(datos.length / 2 / canales);
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < canales; c++) s += datos.readInt16LE((i * canales + c) * 2);
    mono[i] = s / canales;
  }
  return { tasa, mono };
}

function a48k(mono, tasa) {
  if (tasa === TASA) return mono;
  const n = Math.floor(mono.length * TASA / tasa);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * tasa / TASA;
    const j = Math.floor(x);
    const f = x - j;
    const a = mono[Math.min(j, mono.length - 1)];
    const b = mono[Math.min(j + 1, mono.length - 1)];
    out[i] = a + (b - a) * f;
  }
  return out;
}

const Module = createRNNWasmModuleSync();
const entrada = Module._malloc(FRAME * 4);
const salida = Module._malloc(FRAME * 4);

function medir(ruta) {
  const t0 = performance.now();
  const { tasa, mono } = leerWav(ruta);
  const m = a48k(mono, tasa);
  const estado = Module._rnnoise_create(0);
  const vads = [];
  for (let i = 0; i + FRAME <= m.length; i += FRAME) {
    Module.HEAPF32.set(m.subarray(i, i + FRAME), entrada >> 2);
    vads.push(Module._rnnoise_process_frame(estado, salida, entrada));
  }
  Module._rnnoise_destroy(estado);
  const voz = vads.filter((v) => v > UMBRAL).length;
  const medio = vads.length ? vads.reduce((a, b) => a + b, 0) / vads.length : 0;
  return {
    wav: ruta, frames: vads.length, voz_ms: Math.round(voz * FRAME * 1000 / TASA),
    vad_medio: Number(medio.toFixed(3)), vad_max: Number(Math.max(0, ...vads).toFixed(3)),
    ms: Math.round(performance.now() - t0),
  };
}

for (const ruta of process.argv.slice(2)) {
  try {
    console.log(JSON.stringify(medir(ruta)));
  } catch (e) {
    console.log(JSON.stringify({ wav: ruta, error: String(e.message || e) }));
  }
}
