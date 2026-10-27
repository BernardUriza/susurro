#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# MOTOR DE ESCUCHA — la SSOT de captura de micrófono + segmentación por voz +
# transcripción local en vivo. Stdlib puro, cero dependencias.
#
# Nació 2026-08-13 consolidando CUATRO implementaciones dispersas:
#   · compras/llamadas/escucha.py v5 (el mejor motor: de ahí se extrajo esto)
#   · ~/bin/dictado.sh (bash de un día de vida, borrado el mismo día)
#   · susurro/Murmuraba (el corte-por-VAD estaba documentado, nunca implementado)
#   · aurity ConversationCapture (browser; contrato de estados, otro runtime)
#
# Patrón RealtimeSTT/ecoute: ffmpeg streamea PCM crudo por pipe (avfoundation en
# Mac, dshow en Windows), un hilo segmentador corta el utterance a
# SILENCIO_CORTE_MS de silencio DESPUÉS de la voz (frases completas, no rebanadas
# de reloj), y una queue lo entrega al consumidor. En Windows una segunda fuente,
# FuenteLoopback (WASAPI loopback de la bocina), alimenta el mismo segmentador
# etiquetada LLAMADA: así se oye al interlocutor de una llamada de Teams.
# Tiers de STT: hear (local, es-MX, sólo Mac) → Susurro Gateway (fallback).
#
# La capa de PRECISIÓN (corpus de alucinaciones + correcciones de palabra +
# léxico de dominio) vive en `escucha/lexico.py` — este archivo sólo la cablea.
#
# Consumidores:
#   · susurro/escucha/dictar.py            — dictado de terminal
#   · compras/llamadas/escucha.py          — copiloto de llamadas (coach+folios)
# ─────────────────────────────────────────────────────────────────────────────
import array
import json
import math
import os
import queue
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import wave
from collections import deque
from datetime import datetime
from pathlib import Path

try:
    from escucha.lexico import (ALUCINACIONES, corregir, es_alucinacion,
                                registrar_cambios)
except ModuleNotFoundError:
    from lexico import (ALUCINACIONES, corregir, es_alucinacion,
                        registrar_cambios)

GATEWAY = os.environ.get("SUSURRO_GATEWAY", "https://sus.bernarduriza.com")
HEAR = Path(os.environ.get("HEAR", str(Path.home() / ".local/bin/hear")))
KEY_SUSURRO = Path.home() / ".secrets/susurro-gateway-key.txt"
ES_WINDOWS = sys.platform == "win32"


def ffmpeg_bin():
    ruta = shutil.which("ffmpeg")
    if ruta:
        return ruta
    if ES_WINDOWS:
        # winget (Gyan.FFmpeg) ya lo instaló aunque esta shell no haya recargado el PATH
        paquetes = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft/WinGet/Packages"
        for c in sorted(paquetes.glob("Gyan.FFmpeg*/*/bin/ffmpeg.exe")):
            return str(c)
    return "ffmpeg"


FFMPEG = os.environ.get("FFMPEG") or ffmpeg_bin()

RMS_MIN = int(os.environ.get("RMS_MIN", "15"))
# Un utterance corto y casi mudo que pasa RMS_MIN es ruido de fondo: Whisper lo transcribe
# como «¡Gracias!» / «Thank you.» (2026-10-27: 31 de 37 frases de una sesión fueron eso)
RMS_SOSPECHOSO = int(os.environ.get("RMS_SOSPECHOSO", "60" if ES_WINDOWS else "0"))
UTT_SOSPECHOSO_MS = int(os.environ.get("UTT_SOSPECHOSO_MS", "1500"))
LOOPBACK = os.environ.get("ESCUCHA_BOCINA", "1" if ES_WINDOWS else "0") == "1"
LOOPBACK_RATE = 16000
FRAME_MS = 30
FRAME_BYTES = 16000 * FRAME_MS // 1000 * 2
SILENCIO_CORTE_MS = int(os.environ.get("SILENCIO_CORTE_MS", "500"))
UTT_MIN_MS = int(os.environ.get("UTT_MIN_MS", "400"))
UTT_MAX_MS = int(os.environ.get("UTT_MAX_MS", "15000"))
PREROLL_MS = 300
# Al llegar al máximo, en vez de rebanar en el frame exacto se retrocede hasta
# el punto MÁS SILENCIOSO de esta ventana. El habla continua (dictado largo,
# una voz sintetizada) nunca produce los SILENCIO_CORTE_MS de pausa, así que
# antes se cortaba a mitad de palabra: medido el 15-ago-2026, tres utterances
# de dur=15.0 exactos con textos mochos ("busca el punto el? E", "pegados al
# fina"). Cortar en el valle de energía cae en una respiración, no en una
# sílaba. (Instrumentación: registro.jsonl de dictar.py.)
RETROCESO_CORTE_MS = int(os.environ.get("RETROCESO_CORTE_MS", "1500"))
MIC_NOMBRE = os.environ.get("MIC_NOMBRE", "Microphone Array" if ES_WINDOWS else "MacBook Air Microphone")
IDIOMA = os.environ.get("ESCUCHA_LANG", "es-MX")
# Ventana de habla de la BOCINA. `susurro-say.sh` crea este archivo mientras
# reproduce; el segmentador marca —NO borra— los utterances que caen dentro.
# Así el registro distingue la voz de Bernard de su propio eco por la bocina.
HABLANDO = Path(os.environ.get(
    "SUSURRO_LOCK", os.path.join(os.environ.get("TMPDIR") or tempfile.gettempdir(), "susurro-hablando.lock")))
BOCINA_COLA_MS = int(os.environ.get("BOCINA_COLA_MS", "700"))   # reverb tras callar

MIC_VIRTUALES = re.compile(
    r"Teams|BlackHole|Loopback|Aggregate|Soundflower|Zoom|Virtual|Stereo Mix|CABLE|Voicemeeter", re.I)


def ahora():
    return datetime.now().strftime("%H:%M:%S")


class Fallos:
    """Todo fallo queda en el .log; a pantalla va UNA línea tenue por origen
    cada 30s. El resumen final los cuenta — un fallo mudo es indistinguible
    de 'no pasó nada', y ese fantasma ya se persiguió una vez (2026-08-13)."""

    def __init__(self, archivo):
        self.archivo = archivo
        self.total = 0
        self.por_origen = {}
        self._ultimo_aviso = {}

    def avisar(self, origen, detalle):
        self.total += 1
        self.por_origen[origen] = self.por_origen.get(origen, 0) + 1
        with self.archivo.open("a", encoding="utf-8") as f:
            f.write(f"[{ahora()}] {origen}: {detalle}\n")
        if time.time() - self._ultimo_aviso.get(origen, 0) > 30:
            self._ultimo_aviso[origen] = time.time()
            print(f"\033[2m   ⚠ {origen}: {detalle}\033[0m")

    def resumen(self):
        if not self.total:
            return ""
        partes = " · ".join(f"{o}×{n}" for o, n in self.por_origen.items())
        return f"- ⚠ Fallos: {self.total} ({partes}) → {self.archivo.name}\n"


def rms_frame(datos):
    a = array.array("h")
    a.frombytes(datos[: len(datos) // 2 * 2])
    return int(math.sqrt(sum(float(x) * x for x in a) / len(a))) if a else 0


def rms_de(path):
    try:
        with wave.open(str(path)) as w:
            datos = w.readframes(w.getnframes())
        return rms_frame(datos) if datos else 0
    except Exception:
        return 0


def duracion_ms(path):
    try:
        with wave.open(str(path)) as w:
            return w.getnframes() * 1000 // w.getframerate()
    except Exception:
        return 0


def a_16k_mono(datos, rate, canales):
    """PCM s16le intercalado (rate, canales) → PCM s16le 16 kHz mono. Promedia los
    canales y, si la tasa es múltiplo de 16 kHz, promedia cada bloque de `ratio`
    muestras (antialias barato); si no, toma la muestra más cercana."""
    a = array.array("h")
    a.frombytes(datos[: len(datos) // (2 * canales) * 2 * canales])
    if canales > 1:
        mono = [sum(a[i:i + canales]) // canales for i in range(0, len(a), canales)]
    else:
        mono = a.tolist()
    if rate == LOOPBACK_RATE:
        salida = mono
    elif rate % LOOPBACK_RATE == 0:
        ratio = rate // LOOPBACK_RATE
        salida = [sum(mono[i:i + ratio]) // ratio for i in range(0, len(mono) - ratio + 1, ratio)]
    else:
        n = len(mono) * LOOPBACK_RATE // rate
        salida = [mono[i * rate // LOOPBACK_RATE] for i in range(n)]
    return array.array("h", salida).tobytes()


class FuenteLoopback:
    """Lo que SUENA por la bocina (WASAPI loopback vía PyAudioWPatch, sólo Windows):
    la voz del interlocutor en una llamada de Teams. Entrega frames de FRAME_MS a
    16 kHz mono por `frames()`. Cuando nada suena, WASAPI no entrega NADA (medido
    2026-10-27: 0 chunks/s en silencio, 100/s con audio), así que ante un hueco se
    inyecta silencio para que el corte por silencio del segmentador siga vivo."""

    def __init__(self, fallos):
        self.fallos = fallos
        self.cola = queue.Queue()
        self.vivo = False
        self.pa = None
        self.stream = None
        self.nombre = ""
        self.rate, self.canales = LOOPBACK_RATE, 1

    def arrancar(self):
        try:
            import pyaudiowpatch as pa
        except ImportError as e:
            raise RuntimeError("falta PyAudioWPatch para oír la bocina: "
                               "python -m pip install --user PyAudioWPatch "
                               "(o ESCUCHA_BOCINA=0 para sólo micrófono)") from e
        self.pa = pa.PyAudio()
        dev = self.pa.get_default_wasapi_loopback()
        self.nombre = dev["name"]
        self.rate, self.canales = int(dev["defaultSampleRate"]), int(dev["maxInputChannels"])
        por_frame = self.rate * FRAME_MS // 1000
        self.vivo = True

        # Modo callback: PortAudio entrega cada chunk en su hilo y el cierre es seguro.
        # Con read() bloqueante, close() mientras el lector espera revienta el proceso (0xC0000005).
        def _chunk(crudo, _n, _t, _status):
            self.cola.put(crudo)
            return (None, pa.paContinue if self.vivo else pa.paComplete)
        self.stream = self.pa.open(format=pa.paInt16, channels=self.canales, rate=self.rate,
                                   input=True, input_device_index=dev["index"],
                                   frames_per_buffer=por_frame, stream_callback=_chunk)
        self.stream.start_stream()
        return self.nombre

    def frames(self):
        silencio = bytes(FRAME_BYTES)
        while self.vivo:
            try:
                d = self.cola.get(timeout=FRAME_MS / 1000)
            except queue.Empty:
                yield silencio
                continue
            if d is None:
                return
            yield d if len(d) == FRAME_BYTES else a_16k_mono(d, self.rate, self.canales)

    def cerrar(self):
        self.vivo = False
        try:
            if self.stream:
                self.stream.stop_stream()
                self.stream.close()
            if self.pa:
                self.pa.terminate()
        except Exception as e:
            self.fallos.avisar("loopback", f"al cerrar: {type(e).__name__}: {e}")
        self.cola.put(None)


def dispositivos_audio():
    """→ [(identificador, nombre), ...]. Mac (avfoundation): el identificador es el
    índice numérico. Windows (dshow): el identificador es el "Alternative name"
    (`@device_cm_{...}`), ASCII y estable, que ffmpeg acepta en `-i audio=<id>`;
    el nombre amigable (con ® y acentos) sólo se usa para elegir y mostrar."""
    if ES_WINDOWS:
        r = subprocess.run([FFMPEG, "-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        out, amigable = [], None
        for linea in r.stderr.splitlines():
            m = re.search(r'"(.+)" \((audio|video)\)\s*$', linea)
            if m:
                amigable = m.group(1) if m.group(2) == "audio" else None
                continue
            alt = re.search(r'Alternative name "(.+)"', linea)
            if alt and amigable:
                out.append((alt.group(1), amigable))
                amigable = None
        return out
    r = subprocess.run([FFMPEG, "-f", "avfoundation", "-list_devices", "true", "-i", ""],
                       capture_output=True, text=True)
    out, en_audio = [], False
    for linea in r.stderr.splitlines():
        if "AVFoundation audio devices" in linea:
            en_audio = True
            continue
        if en_audio:
            m = re.search(r"\[(\d+)\]\s*(.+)$", linea)
            if m:
                out.append((m.group(1), m.group(2).strip()))
    return out


def mic_index(nombre=None):
    """Índice del micrófono por NOMBRE; si no aparece, el primer dispositivo
    físico (no virtual). ':default' está prohibido — así fue como una sesión
    grabó 20 chunks de 'Microsoft Teams Audio' mudo (2026-08-13)."""
    nombre = nombre or MIC_NOMBRE
    devs = dispositivos_audio()
    for idx, dev in devs:
        if nombre.lower() in dev.lower():
            return idx
    for idx, dev in devs:
        if not MIC_VIRTUALES.search(dev):
            return idx
    if ES_WINDOWS:
        return devs[0][0] if devs else ""
    return "0"


def stt_hear(path, idioma=None):
    """Contrato por EXIT CODE, jamás grep sobre la salida (un transcript legítimo
    puede contener la palabra 'error').
    → ('ok', texto, '') | ('silencio', '', '') | ('fallo', '', por_qué)"""
    if not HEAR.exists():
        return "fallo", "", f"no existe {HEAR}"
    try:
        r = subprocess.run([str(HEAR), "-d", "-l", idioma or IDIOMA, "-p", "-i", str(path)],
                           capture_output=True, text=True, timeout=30)
    except subprocess.TimeoutExpired:
        return "fallo", "", "hear excedió 30s (¿modelo descargándose?)"
    except OSError as e:
        return "fallo", "", f"hear no ejecutable: {e}"
    if r.returncode == 0 and r.stdout.strip():
        return "ok", r.stdout.strip(), ""
    if "No speech detected" in r.stderr:
        return "silencio", "", ""
    causa = r.stderr.strip().splitlines()
    return "fallo", "", causa[0] if causa else f"hear exit {r.returncode} sin stderr"


def _leer_key(archivo, patron):
    try:
        m = re.search(patron, archivo.read_text(encoding="utf-8"), re.M)
        return m.group(1) if m else ""
    except OSError:
        return ""


def stt_gateway(path, language=None):
    """→ (texto, '') | ('', por_qué_falló). Texto vacío sin causa = silencio real."""
    language = (language or IDIOMA).split("-")[0]
    key = os.environ.get("SUSURRO_KEY") or _leer_key(KEY_SUSURRO, r"^SUSURRO_KEY=(.+)$")
    if not key:
        return "", f"sin SUSURRO_KEY en el entorno ni en {KEY_SUSURRO}"
    try:
        req = urllib.request.Request(
            f"{GATEWAY}/v1/stt?language={language}", data=path.read_bytes(),
            headers={"Authorization": f"Bearer {key}", "Content-Type": "audio/wav"})
        return json.load(urllib.request.urlopen(req, timeout=45)).get("transcript", "").strip(), ""
    except Exception as e:
        return "", f"gateway: {type(e).__name__}: {e}"


def diarizar(texto, fallos, num_speakers=None):
    """POST {GATEWAY}/v1/diarize — contrato de /v1/discovery: recibe el
    TRANSCRIPT como texto (diarización LLM, no acústica).
    → [('Hablante A', texto), ...] | None si el gateway falló — el consumidor
    degrada a transcript sin diarizar, jamás rompe el flujo de dictado."""
    key = os.environ.get("SUSURRO_KEY") or _leer_key(KEY_SUSURRO, r"^SUSURRO_KEY=(.+)$")
    if not key:
        fallos.avisar("diarize", f"sin SUSURRO_KEY en el entorno ni en {KEY_SUSURRO}")
        return None
    cuerpo = {"transcript": texto}
    if num_speakers:
        cuerpo["num_speakers"] = num_speakers
    try:
        req = urllib.request.Request(
            f"{GATEWAY}/v1/diarize", data=json.dumps(cuerpo).encode(),
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        r = json.load(urllib.request.urlopen(req, timeout=90))
    except Exception as e:
        fallos.avisar("diarize", f"{type(e).__name__}: {e}")
        return None
    letras = {}
    segmentos = []
    for s in r.get("segments") or []:
        txt = (s.get("text") or "").strip()
        if not txt:
            continue
        quien = s.get("speaker", "?")
        if quien not in letras:
            letras[quien] = chr(ord("A") + len(letras))
        segmentos.append((f"Hablante {letras[quien]}", txt))
    return segmentos or None


def transcribir_tiers(path, fallos, language=None):
    """hear local → gateway. → ('ok', texto) | ('silencio', '') | ('alucinacion', txt)
    | ('fallo', ''). language: formato hear ('es-MX', 'en-US'); default $ESCUCHA_LANG.

    Una alucinación del tier LOCAL ya no se acepta: se descarta y se BAJA al
    gateway, que sobre el mismo wav suele acertar. Sólo si el último tier
    también alucina se devuelve ('alucinacion', txt) — ahí ya no hay a dónde
    caer. Antes de entregar el texto pasa por `corregir()`, y cada sustitución
    queda escrita en el .log de la sesión (auditable, jamás silenciosa).
    """
    rms = rms_de(path)
    if rms < RMS_MIN or (RMS_SOSPECHOSO and rms < RMS_SOSPECHOSO
                         and duracion_ms(path) < UTT_SOSPECHOSO_MS):
        return "silencio", ""
    estado, txt, causa = stt_hear(path, language)
    if estado == "silencio":
        return "silencio", ""
    # Sin `hear` instalado (Windows) el gateway es el único tier; su ausencia no es un fallo por frase
    if estado == "fallo" and HEAR.exists():
        fallos.avisar("stt-hear", causa)
    if txt and es_alucinacion(txt):
        fallos.avisar("alucinacion-hear", f"descartado, bajo a gateway: {txt[:60]!r}")
        txt = ""
    if not txt:
        txt, causa_gw = stt_gateway(path, language)
        if not txt and causa_gw:
            fallos.avisar("stt-gateway", causa_gw)
    if not txt:
        return "fallo", ""
    if es_alucinacion(txt):
        return "alucinacion", txt
    txt, cambios = corregir(txt)
    registrar_cambios(fallos.archivo, cambios)
    return "ok", txt


def calentar_hear(audio_dir):
    """La PRIMERA transcripción de hear carga el modelo (~4.6s); las demás bajan
    a ~0.35s. Un wav de silencio lo despierta antes del chunk real."""
    if not HEAR.exists():
        return

    def _c():
        w = Path(audio_dir) / ".warmup.wav"
        subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-f", "lavfi",
                        "-i", "anullsrc=r=16000:cl=mono", "-t", "0.5", str(w)],
                       capture_output=True)
        try:
            stt_hear(w)
        finally:
            w.unlink(missing_ok=True)
    threading.Thread(target=_c, daemon=True).start()


class MotorCaptura:
    """Captura por pipe PCM + segmentación por voz. El consumidor itera
    `utterances()` y recibe rutas .wav de frases COMPLETAS; None = stream muerto.

        motor = MotorCaptura(audio_dir, fallos)
        motor.arrancar()
        for wav in motor.utterances():   # bloquea; None => ffmpeg murió solo
            ...
        motor.cerrar()                   # drena y hace flush del utterance final

    on_rms(rms, en_frase) opcional: se invoca por frame (~30ms) desde el hilo
    segmentador — debe ser barato y no bloquear; si truena, se apaga solo.
    """

    def __init__(self, audio_dir, fallos, mic_nombre=None, on_rms=None, loopback=None):
        self.origen = {}          # ruta.wav -> 'BERNARD' | 'BOCINA' | 'LLAMADA'
        self._bocina_hasta = 0.0  # monotonic; cola de reverb tras callar la bocina
        self.audio_dir = Path(audio_dir)
        self.fallos = fallos
        self.mic_nombre = mic_nombre or MIC_NOMBRE
        self.on_rms = on_rms
        self.mic_idx = None
        self.cola = queue.Queue()
        self.ffmpeg = None
        self.loopback = None
        self.quiere_loopback = LOOPBACK if loopback is None else loopback
        self._candado = threading.Lock()
        self.n_utt = 0
        self.n_mudo = 0

    def arrancar(self):
        self.audio_dir.mkdir(parents=True, exist_ok=True)
        self.mic_idx = mic_index(self.mic_nombre)
        entrada = (["-f", "dshow", "-i", f"audio={self.mic_idx}"] if ES_WINDOWS
                   else ["-f", "avfoundation", "-i", f":{self.mic_idx}"])
        self.ffmpeg = subprocess.Popen(
            [FFMPEG, "-hide_banner", "-loglevel", "error", *entrada,
             "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-f", "s16le", "-"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        threading.Thread(target=self._segmentar, args=(self._frames_mic(), "BERNARD", True),
                         daemon=True).start()
        if self.quiere_loopback:
            self.loopback = FuenteLoopback(self.fallos)
            self.loopback.arrancar()
            threading.Thread(target=self._segmentar, args=(self.loopback.frames(), "LLAMADA", False),
                             daemon=True).start()
        return self.mic_idx

    def _frames_mic(self):
        pipe = self.ffmpeg.stdout if self.ffmpeg else None
        while pipe is not None:
            d = pipe.read(FRAME_BYTES)
            if not d:
                return
            yield d

    def _segmentar(self, fuente, origen_base="BERNARD", fatal=True):
        """Corta `fuente` (frames de FRAME_MS a 16 kHz mono) en utterances. `fatal`:
        si esta fuente muere, el motor muere (el mic); la bocina sólo avisa."""
        try:
            frames_corte = SILENCIO_CORTE_MS // FRAME_MS
            frames_retroceso = RETROCESO_CORTE_MS // FRAME_MS
            frames_min = UTT_MIN_MS // FRAME_MS
            frames_max = UTT_MAX_MS // FRAME_MS
            preroll = deque(maxlen=PREROLL_MS // FRAME_MS)
            eco_en_curso = False
            voz = []
            silencio_seguido = 0
            for d in fuente:
                rms = rms_frame(d)
                con_voz = rms >= RMS_MIN
                # ¿la bocina está sonando (o acaba de callar)?
                if HABLANDO.exists():
                    self._bocina_hasta = time.monotonic() + BOCINA_COLA_MS / 1000.0
                bocina_ahora = time.monotonic() < self._bocina_hasta
                if bocina_ahora and not voz:
                    eco_en_curso = True
                elif not voz:
                    eco_en_curso = False
                if voz and bocina_ahora:
                    eco_en_curso = True
                if self.on_rms and origen_base == "BERNARD":
                    try:
                        self.on_rms(rms, bool(voz))
                    except Exception as e:
                        self.fallos.avisar("on_rms", f"{type(e).__name__}: {e}; hook apagado")
                        self.on_rms = None
                if voz:
                    voz.append(d)
                    silencio_seguido = 0 if con_voz else silencio_seguido + 1
                    corte_por_silencio = silencio_seguido >= frames_corte
                    corte_por_largo = len(voz) >= frames_max
                    if corte_por_largo and not corte_por_silencio:
                        # Corte "de emergencia": busca el valle de energía en la
                        # ventana final y parte AHÍ, devolviendo la cola al
                        # siguiente utterance para no perder ni una sílaba.
                        voz, resto = self._partir_en_valle(voz, frames_retroceso)
                    else:
                        resto = []
                    if corte_por_silencio or corte_por_largo:
                        if len(voz) - (silencio_seguido if corte_por_silencio else 0) >= frames_min:
                            self._encolar(voz, "BOCINA" if eco_en_curso else origen_base)
                        else:
                            self.n_mudo += 1
                        # La cola del corte por largo NO se tira: arranca el
                        # siguiente utterance. Art. 5 aplicado al audio.
                        voz = list(resto)
                        eco_en_curso = eco_en_curso and bool(resto)
                        silencio_seguido = 0
                else:
                    preroll.append(d)
                    if con_voz:
                        voz = list(preroll)
                        silencio_seguido = 0
            if len(voz) - silencio_seguido >= frames_min:
                self._encolar(voz, "BOCINA" if eco_en_curso else origen_base)
        except Exception as e:
            self.fallos.avisar("segmentador", f"{type(e).__name__}: {e}")
        finally:
            if fatal:
                self.cola.put(None)
            elif origen_base == "LLAMADA" and self.loopback and self.loopback.vivo:
                self.fallos.avisar("loopback", "la bocina dejó de oírse; el mic sigue")

    @staticmethod
    def _partir_en_valle(frames, ventana):
        """Parte `frames` en (cabeza, cola) por el frame de MENOR energía dentro
        de la ventana final. Devuelve la cola para que siga el próximo utterance.

        Si la ventana no cabe o el mínimo cae al final, corta como antes — nunca
        devuelve una cabeza más corta que la mitad de lo que había."""
        if ventana <= 0 or len(frames) <= ventana:
            return frames, []
        inicio = len(frames) - ventana
        energias = [(rms_frame(f), i) for i, f in enumerate(frames[inicio:], start=inicio)]
        _, idx = min(energias)
        if idx <= len(frames) // 2 or idx >= len(frames) - 1:
            return frames, []
        return frames[:idx], frames[idx:]

    def _encolar(self, frames, origen="BERNARD"):
        with self._candado:
            self.n_utt += 1
            ruta = self.audio_dir / f"utt-{self.n_utt:04d}.wav"
            with wave.open(str(ruta), "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(16000)
                w.writeframes(b"".join(frames))
            self.origen[ruta] = origen
        self.cola.put(ruta)

    def utterances(self, timeout=1):
        """Generador bloqueante. Cede rutas .wav; un None final = ffmpeg murió
        solo (mic desconectado, disco lleno) — el consumidor DEBE anunciarlo,
        no tragárselo como stop sano."""
        while True:
            try:
                utt = self.cola.get(timeout=timeout)
            except queue.Empty:
                continue
            yield utt
            if utt is None:
                return

    def origen_de(self, ruta):
        """'BERNARD' | 'BOCINA' — quién habló en ese utterance. La bocina es la
        voz sintetizada del asistente, capturada de vuelta por el micrófono."""
        return self.origen.get(ruta, "BERNARD")

    def murio_solo(self):
        return self.ffmpeg is not None and self.ffmpeg.poll() is not None

    def cerrar(self, drenar_segundos=8):
        """Termina ffmpeg y drena la cola (flush del utterance en curso incluido).
        → lista de rutas .wav rezagadas para que el consumidor las transcriba."""
        if self.loopback:
            self.loopback.cerrar()
        if self.ffmpeg and self.ffmpeg.poll() is None:
            # 'q' por stdin es el cierre limpio de ffmpeg en toda plataforma; en Windows
            # terminate() es TerminateProcess y tiraría el audio aún no escrito al pipe
            try:
                self.ffmpeg.stdin.write(b"q")
                self.ffmpeg.stdin.flush()
                self.ffmpeg.wait(timeout=3)
            except (OSError, ValueError, subprocess.TimeoutExpired):
                self.ffmpeg.terminate()
                try:
                    self.ffmpeg.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.fallos.avisar("ffmpeg", "no murió con terminate; kill")
                    self.ffmpeg.kill()
        rezagados = []
        limite = time.time() + drenar_segundos
        while time.time() < limite:
            try:
                utt = self.cola.get(timeout=2)
            except queue.Empty:
                break
            if utt is None:
                break
            rezagados.append(utt)
        return rezagados
