#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# TRANSCRIPCIÓN DE ARCHIVOS — la SSOT para pasar un audio/video YA GRABADO a
# texto, vía el Susurro Gateway (Whisper en Azure). Stdlib puro + ffmpeg.
#
# Nació 2026-10-07 para jubilar el Whisper LOCAL (mlx_whisper y faster-whisper,
# 6.5 GB de modelos en ~/.cache/huggingface) — `motor.py` es la captura EN VIVO
# del micrófono; esto es el lote sobre archivos. Ambos pegan al mismo gateway.
#
# Dos límites del upstream que este módulo absorbe para que el consumidor no:
#   · 25 MB por request en Whisper de Azure → el audio se re-codifica a mono
#     16 kHz y se parte en trozos de ~TROZO_SEG, cortando en un SILENCIO cercano
#     (nunca a media palabra si hay pausa a la mano); los timestamps se
#     re-desplazan al tiempo global del archivo.
#   · 3 requests/minuto (techo de la suscripción) → un 429 trae Retry-After y se
#     espera lo que pida. Un lote largo tarda más; no truena.
#
# Y un defecto de Whisper que tampoco debe llegarle al consumidor: sobre música o
# ruido alucina frases de su corpus de entrenamiento ("Subtítulos realizados por
# la comunidad de Amara.org") y, como se condiciona con su propio texto, la
# repite en cada ventana de 30 s — un noticiero de Loret (2026-10-09) perdió sus
# primeros 10 min enteros así, sin aviso. Cada trozo se verifica: la alucinación
# conocida se tira, un trozo sospechoso se repite en sub-trozos cada vez más
# chicos (SUBTROZOS_SEG: contexto fresco, y la música que lo contaminó queda
# aislada en su pedazo), y el audio con sonido que sigue sin oírse se reporta en
# `huecos` y se avisa. Nunca en silencio.
#
# Consumidores:
#   · `transcribir` (CLI global, reemplaza a mlx_whisper)
#   · videopipe/picturelock (QA del voiceover, timestamps por palabra)
# ─────────────────────────────────────────────────────────────────────────────
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

try:
    from escucha.motor import GATEWAY, KEY_SUSURRO, _leer_key
except ImportError:  # corrido como script dentro de escucha/
    from motor import GATEWAY, KEY_SUSURRO, _leer_key

TROZO_SEG = int(os.environ.get("ESCUCHA_TROZO_SEG", "600"))     # 10 min ≈ 3.6 MB a 48 kbps
VENTANA_SILENCIO_SEG = 60     # cuánto antes del corte nominal se busca una pausa
REINTENTOS_429 = 10
REINTENTOS_FALLO = 2
SUBTROZOS_SEG = (120, 30)     # reintentos de un trozo sospechoso, cada nivel más chico
HUECO_SEG = 60                # un tramo con sonido y sin una sola palabra oída ≥ esto es sospechoso
SONIDO_MIN = 0.5              # fracción del tramo que debe sonar (no silencio) para contar

# Créditos de subtítulos que Whisper alucina sobre música/ruido (vienen de los
# subtítulos con que lo entrenaron). Sólo cuando son el segmento COMPLETO: nadie
# los dice en voz alta. "Gracias por ver" queda fuera a propósito — un conductor
# sí lo dice, y tirar habla real es peor que dejar pasar una alucinación.
ALUCINACION = re.compile(
    r"\W*(subt[ií]tulos?|subtitles)\b[^.]{0,40}\bamara\.org\b[^.]{0,20}\W*",
    re.IGNORECASE)

# Whisper devuelve el idioma por NOMBRE ("spanish"); la API lo recibe por código.
CODIGO_IDIOMA = {
    "spanish": "es", "english": "en", "portuguese": "pt", "french": "fr",
    "italian": "it", "german": "de", "catalan": "ca", "galician": "gl",
    "japanese": "ja", "chinese": "zh", "korean": "ko", "russian": "ru",
    "dutch": "nl", "arabic": "ar", "hindi": "hi", "turkish": "tr",
}


class TranscripcionError(RuntimeError):
    """Falla que el consumidor debe ver: sin token, gateway caído, ffmpeg roto."""


def codigo_idioma(nombre: str | None) -> str | None:
    if not nombre:
        return None
    nombre = nombre.lower()
    return CODIGO_IDIOMA.get(nombre, nombre if len(nombre) == 2 else None)


def leer_token(archivo: str | Path | None = None) -> str:
    """$SUSURRO_KEY > archivo dado > la key de escucha. Nunca la imprime."""
    if os.environ.get("SUSURRO_KEY"):
        return os.environ["SUSURRO_KEY"].strip()
    ruta = Path(archivo).expanduser() if archivo else KEY_SUSURRO
    token = _leer_key(ruta, r"^SUSURRO_KEY=(.+)$")
    if not token:
        raise TranscripcionError(f"sin SUSURRO_KEY en {ruta}")
    return token.strip()


# ------------------------------------------------------------------ ffmpeg

def duracion_de(path: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", str(path)], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        raise TranscripcionError(f"ffprobe no pudo leer {path}: {r.stderr.strip()[:200]}")


def intervalos_silencio(path: Path) -> list[tuple[float, float]]:
    """[(inicio, fin)] de cada pausa ≥0.4 s (ffmpeg silencedetect). Una pausa que
    llega hasta el final del archivo no trae silence_end: cierra en la duración."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-vn",
                        "-af", "silencedetect=noise=-35dB:d=0.4", "-f", "null", "-"],
                       capture_output=True, text=True)
    inicios = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", r.stderr)]
    finales = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    if len(inicios) > len(finales):
        finales.append(duracion_de(path))
    return list(zip(inicios, finales))


def silencios_de(path: Path) -> list[float]:
    """Puntos medios de cada pausa ≥0.4 s."""
    return [(a + b) / 2 for a, b in intervalos_silencio(path)]


def segundos_con_sonido(a: float, b: float, silencios: list[tuple[float, float]]) -> float:
    """Cuánto del tramo [a, b] NO es silencio."""
    callado = sum(max(0.0, min(b, fin) - max(a, ini)) for ini, fin in silencios)
    return max(0.0, (b - a) - callado)


def puntos_de_corte(duracion: float, silencios: list[float], trozo: float = TROZO_SEG,
                    ventana: float = VENTANA_SILENCIO_SEG) -> list[float]:
    """Cortes cada ~`trozo` s; cada uno se recorre a la pausa más tardía dentro
    de los `ventana` s previos. Sin pausa a la mano, corta en el nominal."""
    cortes: list[float] = []
    previo = 0.0
    while duracion - previo > trozo:
        nominal = previo + trozo
        candidatos = [s for s in silencios if nominal - ventana <= s <= nominal and s > previo + 1]
        corte = max(candidatos) if candidatos else nominal
        cortes.append(round(corte, 3))
        previo = corte
    return cortes


def partir(path: Path, destino: Path, trozo: float = TROZO_SEG) -> list[tuple[Path, float]]:
    """→ [(trozo.mp3, offset_seg)]. Mono 16 kHz 48 kbps: lo que Whisper usa."""
    destino.mkdir(parents=True, exist_ok=True)
    duracion = duracion_de(path)
    cortes = (puntos_de_corte(duracion, silencios_de(path), trozo, min(VENTANA_SILENCIO_SEG, trozo / 4))
              if duracion > trozo else [])
    patron = destino / "trozo-%03d.mp3"
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(path), "-vn",
           "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "48k"]
    if cortes:
        cmd += ["-f", "segment", "-segment_times", ",".join(map(str, cortes)),
                "-reset_timestamps", "1", str(patron)]
    else:
        cmd += [str(destino / "trozo-000.mp3")]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise TranscripcionError(f"ffmpeg no pudo convertir {path}: {r.stderr.strip()[:300]}")
    trozos = sorted(destino.glob("trozo-*.mp3"))
    offsets = [0.0] + cortes
    if len(trozos) != len(offsets):
        raise TranscripcionError(f"ffmpeg dio {len(trozos)} trozos, se esperaban {len(offsets)}")
    return list(zip(trozos, offsets))


# ------------------------------------------------------------------ gateway

def _multipart(campos: list[tuple[str, str]], archivo: Path) -> tuple[bytes, str]:
    frontera = uuid.uuid4().hex
    partes = []
    for nombre, valor in campos:
        partes.append(f'--{frontera}\r\nContent-Disposition: form-data; name="{nombre}"'
                      f"\r\n\r\n{valor}\r\n".encode())
    partes.append(f'--{frontera}\r\nContent-Disposition: form-data; name="file"; '
                  f'filename="{archivo.name}"\r\nContent-Type: audio/mpeg\r\n\r\n'.encode()
                  + archivo.read_bytes() + b"\r\n")
    partes.append(f"--{frontera}--\r\n".encode())
    return b"".join(partes), f"multipart/form-data; boundary={frontera}"


def transcribir_trozo(trozo: Path, token: str, language: str | None = None,
                      palabras: bool = False, gateway: str = GATEWAY,
                      avisar=print) -> dict:
    """Un trozo ≤25 MB → verbose_json de Whisper. Honra el Retry-After del 429."""
    campos = [("response_format", "verbose_json")]
    if language:
        campos.append(("language", language.split("-")[0]))
    if palabras:
        campos += [("timestamp_granularities[]", "word"), ("timestamp_granularities[]", "segment")]
    cuerpo, tipo = _multipart(campos, trozo)
    url = gateway.rstrip("/") + "/openai/deployments/whisper/audio/transcriptions"
    fallos = 0
    for _ in range(REINTENTOS_429 + REINTENTOS_FALLO + 1):
        req = urllib.request.Request(url, data=cuerpo, method="POST", headers={
            "Authorization": f"Bearer {token}", "Content-Type": tipo})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            detalle = e.read().decode(errors="replace")[:300]
            if e.code == 429:
                espera = int(e.headers.get("Retry-After") or 20)
                avisar(f"  · gateway saturado (3 req/min): espero {espera}s")
                time.sleep(espera)
                continue
            if e.code >= 500 and fallos < REINTENTOS_FALLO:
                fallos += 1
                time.sleep(5 * fallos)
                continue
            raise TranscripcionError(f"gateway HTTP {e.code}: {detalle}") from e
        except (urllib.error.URLError, TimeoutError) as e:
            if fallos < REINTENTOS_FALLO:
                fallos += 1
                time.sleep(5 * fallos)
                continue
            raise TranscripcionError(f"no se pudo alcanzar {gateway}: {e}") from e
    raise TranscripcionError("el gateway siguió saturado tras todos los reintentos")


# ------------------------------------------------------------------ verificación

def limpiar_alucinaciones(r: dict) -> tuple[dict, int]:
    """Tira los segmentos de alucinación conocida (y las palabras que caen en
    ellos). → (respuesta limpia, cuántos segmentos se tiraron)."""
    segmentos = r.get("segments") or []
    malos = [x for x in segmentos if ALUCINACION.fullmatch((x.get("text") or "").strip())]
    if not malos:
        return r, 0

    def dentro(w):
        return any(x["start"] - 0.05 <= w["start"] <= x["end"] + 0.05 for x in malos)

    buenos = [x for x in segmentos if x not in malos]
    limpio = dict(r, segments=buenos, words=[w for w in r.get("words") or [] if not dentro(w)],
                  text=" ".join((x.get("text") or "").strip() for x in buenos))
    return limpio, len(malos)


def tramos_sin_oir(segmentos: list[dict], duracion: float,
                   silencios: list[tuple[float, float]], minimo: float = HUECO_SEG,
                   sonido_min: float = SONIDO_MIN) -> list[tuple[float, float]]:
    """Tramos ≥`minimo` s entre segmentos oídos (o contra los bordes) donde el
    audio SÍ suena ≥`sonido_min` del tramo: habla (o música) que Whisper no
    transcribió. Un silencio largo de verdad no cuenta."""
    bordes = sorted((x["start"], x["end"]) for x in segmentos)
    tramos, previo = [], 0.0
    for a, b in [*bordes, (duracion, duracion)]:
        if a - previo >= minimo and segundos_con_sonido(previo, a, silencios) >= sonido_min * (a - previo):
            tramos.append((round(previo, 3), round(a, 3)))
        previo = max(previo, b)
    return tramos


def _verificar(trozo: Path, r: dict) -> tuple[dict, int, list[tuple[float, float]]]:
    """→ (respuesta sin alucinaciones, cuántas se tiraron, tramos con sonido sin oír)."""
    limpio, alucinados = limpiar_alucinaciones(r)
    duracion = float(r.get("duration") or 0)
    sin_oir = []
    if duracion >= HUECO_SEG:
        sin_oir = tramos_sin_oir(limpio.get("segments") or [], duracion, intervalos_silencio(trozo))
    return limpio, alucinados, sin_oir


def _mmss(seg: float) -> str:
    return f"{int(seg // 60)}:{int(seg % 60):02d}"


def _acumular(resultado: dict, textos: list[str], r: dict, offset: float) -> None:
    resultado["language"] = resultado["language"] or codigo_idioma(r.get("language"))
    resultado["duration"] = max(resultado["duration"], offset + float(r.get("duration") or 0))
    textos.append((r.get("text") or "").strip())
    for s in r.get("segments") or []:
        resultado["segments"].append({"start": round(offset + s["start"], 3),
                                      "end": round(offset + s["end"], 3),
                                      "text": s["text"].strip()})
    for w in r.get("words") or []:
        resultado["words"].append({"start": round(offset + w["start"], 3),
                                   "end": round(offset + w["end"], 3),
                                   "word": w["word"].strip()})


def transcribir_archivo(path: str | Path, language: str | None = None, *,
                        palabras: bool = False, token: str | None = None,
                        archivo_token: str | Path | None = None,
                        gateway: str = GATEWAY, avisar=print) -> dict:
    """Audio o video de cualquier largo → {text, language, duration, segments, words, huecos}.

    `segments` = [{start, end, text}] y `words` = [{start, end, word}] en tiempo
    GLOBAL del archivo. `words` sólo se llena con palabras=True. `language` de
    salida es código ISO ('es'), venga o no pinneado. `huecos` = [{start, end,
    motivo}]: audio con sonido que ni el reintento logró transcribir — vacío
    cuando todo se oyó.
    """
    path = Path(path).expanduser()
    if not path.is_file():
        raise TranscripcionError(f"no existe {path}")
    token = token or leer_token(archivo_token)
    resultado = {"text": "", "language": None, "duration": 0.0, "segments": [], "words": [],
                 "huecos": []}
    textos: list[str] = []

    def pedir(trozo: Path):
        return _verificar(trozo, transcribir_trozo(trozo, token, language, palabras, gateway, avisar))

    def anotar_huecos(r: dict, alucinados: int, sin_oir, offset: float) -> None:
        if alucinados and not (r.get("segments") or []) and not sin_oir:
            sin_oir = [(0.0, float(r.get("duration") or 0))]  # corto y pura alucinación
        for a, b in sin_oir:
            motivo = "sólo alucinación" if alucinados else "audio con sonido sin transcribir"
            avisar(f"  ✗ sin transcripción confiable en {_mmss(offset + a)}–{_mmss(offset + b)} ({motivo})")
            previo = resultado["huecos"][-1] if resultado["huecos"] else None
            if previo and previo["motivo"] == motivo and offset + a - previo["end"] <= 1.0:
                previo["end"] = round(offset + b, 3)  # sub-trozos contiguos: un solo hueco
            else:
                resultado["huecos"].append({"start": round(offset + a, 3), "end": round(offset + b, 3),
                                            "motivo": motivo})

    def procesar(trozo: Path, offset: float, tmp: str) -> None:
        r, alucinados, sin_oir = pedir(trozo)
        menores = [n for n in SUBTROZOS_SEG if n < float(r.get("duration") or 0)]
        if not (alucinados or sin_oir) or not menores:
            _acumular(resultado, textos, r, offset)
            anotar_huecos(r, alucinados, sin_oir, offset)
            return
        avisar(f"  ⚠ {_mmss(offset)}–{_mmss(offset + float(r['duration']))} sospechoso "
               f"({alucinados} alucinaciones, {len(sin_oir)} tramos sin oír): "
               f"lo repito en pedazos de {menores[0]}s")
        for sub, sub_offset in partir(trozo, Path(tempfile.mkdtemp(dir=tmp)), menores[0]):
            procesar(sub, offset + sub_offset, tmp)

    with tempfile.TemporaryDirectory(prefix="escucha-archivo-") as tmp:
        trozos = partir(path, Path(tmp))
        for i, (trozo, offset) in enumerate(trozos, 1):
            if len(trozos) > 1:
                avisar(f"  · trozo {i}/{len(trozos)} (desde {_mmss(offset)})")
            procesar(trozo, offset, tmp)
    resultado["text"] = " ".join(t for t in textos if t)
    if language and not resultado["language"]:
        resultado["language"] = language.split("-")[0]
    return resultado


# ------------------------------------------------------------------ salidas

def _ts(seg: float, sep: str = ",") -> str:
    ms = int(round(max(seg, 0) * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def a_srt(r: dict) -> str:
    return "\n".join(f"{i}\n{_ts(s['start'])} --> {_ts(s['end'])}\n{s['text']}\n"
                     for i, s in enumerate(r["segments"], 1))


def a_vtt(r: dict) -> str:
    return "WEBVTT\n\n" + "\n".join(f"{_ts(s['start'], '.')} --> {_ts(s['end'], '.')}\n{s['text']}\n"
                                    for s in r["segments"])


FORMATOS = {
    "txt": lambda r: r["text"] + "\n",
    "srt": a_srt,
    "vtt": a_vtt,
    "json": lambda r: json.dumps(r, ensure_ascii=False, indent=2),
}


def main(argv=None) -> int:
    p = argparse.ArgumentParser(
        prog="transcribir",
        description="Transcribe audio/video vía el Susurro Gateway (Whisper en Azure). "
                    "Archivos largos se parten solos; el 429 se espera solo.")
    p.add_argument("archivos", nargs="+", type=Path)
    p.add_argument("-l", "--language", default=None, help="código ISO (es, en…); default: autodetecta")
    p.add_argument("-f", "--output-format", default="all", choices=[*FORMATOS, "all"])
    p.add_argument("-o", "--output-dir", type=Path, default=Path("."))
    p.add_argument("--palabras", action="store_true", help="timestamps por palabra en el json")
    p.add_argument("--key-file", default=None, help="archivo con SUSURRO_KEY= (default: la de escucha)")
    a = p.parse_args(argv)

    formatos = list(FORMATOS) if a.output_format == "all" else [a.output_format]
    a.output_dir.mkdir(parents=True, exist_ok=True)
    errores = 0
    for archivo in a.archivos:
        print(f"→ {archivo}", file=sys.stderr)
        try:
            r = transcribir_archivo(archivo, a.language, palabras=a.palabras,
                                    archivo_token=a.key_file,
                                    avisar=lambda m: print(m, file=sys.stderr))
        except TranscripcionError as e:
            print(f"  ✗ {e}", file=sys.stderr)
            errores += 1
            continue
        if r["huecos"]:
            print(f"  ⚠ {len(r['huecos'])} hueco(s) sin transcribir — ver 'huecos' en el json",
                  file=sys.stderr)
        for fmt in formatos:
            salida = a.output_dir / f"{archivo.stem}.{fmt}"
            salida.write_text(FORMATOS[fmt](r), encoding="utf-8")
            print(f"  ✓ {salida}", file=sys.stderr)
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
