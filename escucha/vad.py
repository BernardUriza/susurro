"""VAD por utterance con RNNoise, el mismo motor de murmuraba (packages/rnnoise-wasm), corrido en
Node por `vad_rnnoise.mjs`. Decide si un utterance que pasó el umbral de RMS trae VOZ o es
ruido (teclado, golpes, respiración) que whisper convierte en «¡Gracias!», «Bye.», «Boop! Boop!».

Medido 2026-10-27 sobre 75 utterances de la ThinkPad: el habla real (Bernard y la bocina)
dio voz_ms ≥ 540 y vad_medio ≥ 0.38; los 30 ruidos/alucinaciones dieron voz_ms ≤ 470 o
vad_medio ≤ 0.33. Sin Node el motor sigue como antes y avisa UNA vez: medir no rompe lo medido."""
import json
import os
import shutil
import subprocess
from pathlib import Path

try:
    from escucha.instrumentacion import evento
except ModuleNotFoundError:
    from instrumentacion import evento

ACTIVO = os.environ.get("ESCUCHA_VAD", "1") == "1"
MIN_VOZ_MS = int(os.environ.get("VAD_MIN_VOZ_MS", "500"))
MIN_MEDIO = float(os.environ.get("VAD_MIN_MEDIO", "0.30"))
SCRIPT = Path(__file__).resolve().parent / "vad_rnnoise.mjs"
NODE = shutil.which("node")
TIMEOUT_S = 15


def disponible():
    return bool(NODE) and SCRIPT.exists()


def medir(path):
    """→ {"voz_ms", "vad_medio", "vad_max", "frames", "ms"} | None si no se pudo medir
    (sin Node, wav ilegible, timeout). Nunca lanza."""
    if not disponible():
        return None
    try:
        r = subprocess.run([NODE, str(SCRIPT), str(path)], capture_output=True, text=True,
                           encoding="utf-8", timeout=TIMEOUT_S)
        linea = r.stdout.strip().splitlines()[-1] if r.stdout.strip() else ""
        m = json.loads(linea) if linea else {}
        if "error" in m or "voz_ms" not in m:
            return None
        m.pop("wav", None)
        return m
    except Exception:
        return None


def es_ruido(medida):
    """Voz insuficiente para ser una frase: menos de MIN_VOZ_MS de frames con voz, o una
    probabilidad media por debajo de MIN_MEDIO."""
    return medida["voz_ms"] < MIN_VOZ_MS or medida["vad_medio"] < MIN_MEDIO


def juzgar(path):
    """→ ('ruido', medida) | ('voz', medida) | ('sin_vad', None). Registra la medida como evento
    `vad` para que el corpus siga creciendo con cada sesión."""
    if not ACTIVO:
        return "sin_vad", None
    m = medir(path)
    if m is None:
        return "sin_vad", None
    veredicto = "ruido" if es_ruido(m) else "voz"
    evento("vad", wav=Path(path).name, veredicto=veredicto, **m)
    return veredicto, m
