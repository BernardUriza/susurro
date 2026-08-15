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
# Patrón RealtimeSTT/ecoute: ffmpeg streamea PCM crudo por pipe, un hilo
# segmentador corta el utterance a SILENCIO_CORTE_MS de silencio DESPUÉS de la
# voz (frases completas, no rebanadas de reloj), y una queue lo entrega al
# consumidor. Tiers de STT: hear (local, es-MX) → Susurro Gateway (fallback).
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
import subprocess
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

RMS_MIN = int(os.environ.get("RMS_MIN", "15"))
FRAME_MS = 30
FRAME_BYTES = 16000 * FRAME_MS // 1000 * 2
SILENCIO_CORTE_MS = int(os.environ.get("SILENCIO_CORTE_MS", "500"))
UTT_MIN_MS = int(os.environ.get("UTT_MIN_MS", "400"))
UTT_MAX_MS = int(os.environ.get("UTT_MAX_MS", "15000"))
PREROLL_MS = 300
MIC_NOMBRE = os.environ.get("MIC_NOMBRE", "MacBook Air Microphone")
IDIOMA = os.environ.get("ESCUCHA_LANG", "es-MX")
# Ventana de habla de la BOCINA. `susurro-say.sh` crea este archivo mientras
# reproduce; el segmentador marca —NO borra— los utterances que caen dentro.
# Así el registro distingue la voz de Bernard de su propio eco por la bocina.
HABLANDO = Path(os.environ.get(
    "SUSURRO_LOCK", os.path.join(os.environ.get("TMPDIR", "/tmp"), "susurro-hablando.lock")))
BOCINA_COLA_MS = int(os.environ.get("BOCINA_COLA_MS", "700"))   # reverb tras callar

MIC_VIRTUALES = re.compile(r"Teams|BlackHole|Loopback|Aggregate|Soundflower|Zoom|Virtual", re.I)


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
        with self.archivo.open("a") as f:
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


def dispositivos_audio():
    """→ [(indice, nombre), ...] de avfoundation."""
    r = subprocess.run(["ffmpeg", "-f", "avfoundation", "-list_devices", "true", "-i", ""],
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
        m = re.search(patron, archivo.read_text(), re.M)
        return m.group(1) if m else ""
    except OSError:
        return ""


def stt_gateway(path, language=None):
    """→ (texto, '') | ('', por_qué_falló). Texto vacío sin causa = silencio real."""
    language = (language or IDIOMA).split("-")[0]
    key = _leer_key(KEY_SUSURRO, r"^SUSURRO_KEY=(.+)$")
    if not key:
        return "", f"sin SUSURRO_KEY en {KEY_SUSURRO}"
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
    key = _leer_key(KEY_SUSURRO, r"^SUSURRO_KEY=(.+)$")
    if not key:
        fallos.avisar("diarize", f"sin SUSURRO_KEY en {KEY_SUSURRO}")
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
    if rms_de(path) < RMS_MIN:
        return "silencio", ""
    estado, txt, causa = stt_hear(path, language)
    if estado == "silencio":
        return "silencio", ""
    if estado == "fallo":
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
    def _c():
        w = Path(audio_dir) / ".warmup.wav"
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi",
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

    def __init__(self, audio_dir, fallos, mic_nombre=None, on_rms=None):
        self.origen = {}          # ruta.wav -> 'BERNARD' | 'BOCINA'
        self._bocina_hasta = 0.0  # monotonic; cola de reverb tras callar la bocina
        self.audio_dir = Path(audio_dir)
        self.fallos = fallos
        self.mic_nombre = mic_nombre or MIC_NOMBRE
        self.on_rms = on_rms
        self.mic_idx = None
        self.cola = queue.Queue()
        self.ffmpeg = None
        self.n_utt = 0
        self.n_mudo = 0

    def arrancar(self):
        self.audio_dir.mkdir(parents=True, exist_ok=True)
        self.mic_idx = mic_index(self.mic_nombre)
        self.ffmpeg = subprocess.Popen(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "avfoundation",
             "-i", f":{self.mic_idx}", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
             "-f", "s16le", "-"], stdout=subprocess.PIPE)
        threading.Thread(target=self._segmentar, daemon=True).start()
        return self.mic_idx

    def _segmentar(self):
        try:
            pipe = self.ffmpeg.stdout if self.ffmpeg else None
            if pipe is None:
                return
            frames_corte = SILENCIO_CORTE_MS // FRAME_MS
            frames_min = UTT_MIN_MS // FRAME_MS
            frames_max = UTT_MAX_MS // FRAME_MS
            preroll = deque(maxlen=PREROLL_MS // FRAME_MS)
            eco_en_curso = False
            voz = []
            silencio_seguido = 0
            while True:
                d = pipe.read(FRAME_BYTES)
                if not d:
                    break
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
                if self.on_rms:
                    try:
                        self.on_rms(rms, bool(voz))
                    except Exception as e:
                        self.fallos.avisar("on_rms", f"{type(e).__name__}: {e}; hook apagado")
                        self.on_rms = None
                if voz:
                    voz.append(d)
                    silencio_seguido = 0 if con_voz else silencio_seguido + 1
                    if silencio_seguido >= frames_corte or len(voz) >= frames_max:
                        if len(voz) - silencio_seguido >= frames_min:
                            self._encolar(voz, "BOCINA" if eco_en_curso else "BERNARD")
                        else:
                            self.n_mudo += 1
                        voz = []
                        eco_en_curso = False
                        silencio_seguido = 0
                else:
                    preroll.append(d)
                    if con_voz:
                        voz = list(preroll)
                        silencio_seguido = 0
            if len(voz) - silencio_seguido >= frames_min:
                self._encolar(voz, "BOCINA" if eco_en_curso else "BERNARD")
        except Exception as e:
            self.fallos.avisar("segmentador", f"{type(e).__name__}: {e}")
        finally:
            self.cola.put(None)

    def _encolar(self, frames, origen="BERNARD"):
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
        if self.ffmpeg and self.ffmpeg.poll() is None:
            self.ffmpeg.terminate()
            try:
                self.ffmpeg.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.fallos.avisar("ffmpeg", "no murió con SIGTERM; kill -9")
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
