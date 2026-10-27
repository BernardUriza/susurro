"""Tier LOCAL de respaldo en Windows: NVIDIA Parakeet-TDT 0.6B v3 (int8) corriendo en
`sherpa-onnx`, 25 idiomas con detección automática (es/en incluidos). NO es Whisper:
el Whisper local se retiró el 2026-10-07 y no vuelve.

Entra cuando el gateway falla (frío, 429, caído) y como segunda opinión acústica
cuando el gateway devuelve una alucinación corta («¡Gracias!»). El modelo (~640 MB)
se carga una vez, en un hilo, al arrancar; hasta entonces `listo()` es False y la
ruta caliente no lo espera."""
import array
import os
import threading
import time
import wave
from pathlib import Path

try:
    from escucha.instrumentacion import evento
except ModuleNotFoundError:
    from instrumentacion import evento

MODELO = Path(os.environ.get(
    "ESCUCHA_MODELO_LOCAL",
    str(Path.home() / ".cache/susurro/modelos/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8")))
HILOS = int(os.environ.get("ESCUCHA_LOCAL_HILOS", "4"))
_reconocedor = None
_causa = ""
_candado = threading.Lock()


def disponible():
    return (MODELO / "tokens.txt").exists()


def listo():
    return _reconocedor is not None


def _archivo(patron):
    return next(iter(sorted(MODELO.glob(patron))), None)


def cargar():
    """Singleton del reconocedor. → reconocedor | None (y `causa()` dice por qué)."""
    global _reconocedor, _causa
    with _candado:
        if _reconocedor is not None:
            return _reconocedor
        try:
            import sherpa_onnx
        except ImportError as e:
            _causa = f"sin sherpa-onnx: {e}; python -m pip install --user sherpa-onnx"
            return None
        if not disponible():
            _causa = f"sin modelo local en {MODELO}"
            return None
        enc, dec, joi = _archivo("encoder*.onnx"), _archivo("decoder*.onnx"), _archivo("joiner*.onnx")
        if not (enc and dec and joi):
            _causa = f"modelo incompleto en {MODELO}"
            return None
        t0 = time.monotonic()
        try:
            _reconocedor = sherpa_onnx.OfflineRecognizer.from_transducer(
                encoder=str(enc), decoder=str(dec), joiner=str(joi), tokens=str(MODELO / "tokens.txt"),
                num_threads=HILOS, sample_rate=16000, feature_dim=80,
                decoding_method="greedy_search", model_type="nemo_transducer")
        except Exception as e:
            _causa = f"no cargó el modelo local: {type(e).__name__}: {e}"
            return None
        _causa = ""
        evento("stt.local.cargado", segundos=round(time.monotonic() - t0, 1), modelo=MODELO.name)
        return _reconocedor


def causa():
    return _causa


def calentar():
    threading.Thread(target=cargar, daemon=True).start()


def stt_local(path, language=None):
    """→ (texto, causa). Texto vacío sin causa = el modelo no oyó habla."""
    rec = cargar()
    if rec is None:
        return "", _causa
    try:
        with wave.open(str(path)) as w:
            rate, datos = w.getframerate(), w.readframes(w.getnframes())
        a = array.array("h")
        a.frombytes(datos[: len(datos) // 2 * 2])
        s = rec.create_stream()
        s.accept_waveform(rate, [x / 32768.0 for x in a])
        rec.decode_stream(s)
        return s.result.text.strip(), ""
    except Exception as e:
        return "", f"local: {type(e).__name__}: {e}"
