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
MIC_VIRTUALES = re.compile(r"Teams|BlackHole|Loopback|Aggregate|Soundflower|Zoom|Virtual", re.I)

ALUCINACIONES = ("amara.org", "subtítulos", "subtitulos", "gracias por ver",
                 "suscríbete", "suscribete", "♪")


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


def es_alucinacion(t):
    t = t.lower().strip()
    return len(t) < 3 or any(a in t for a in ALUCINACIONES)


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


def stt_hear(path):
    """Contrato por EXIT CODE, jamás grep sobre la salida (un transcript legítimo
    puede contener la palabra 'error').
    → ('ok', texto, '') | ('silencio', '', '') | ('fallo', '', por_qué)"""
    if not HEAR.exists():
        return "fallo", "", f"no existe {HEAR}"
    try:
        r = subprocess.run([str(HEAR), "-d", "-l", "es-MX", "-p", "-i", str(path)],
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
        m = re.search(patron, archivo.read_text())
        return m.group(1) if m else ""
    except OSError:
        return ""


def stt_gateway(path, language="es"):
    """→ (texto, '') | ('', por_qué_falló). Texto vacío sin causa = silencio real."""
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


def transcribir_tiers(path, fallos, language="es"):
    """hear local → gateway. → ('ok', texto) | ('silencio', '') | ('alucinacion', txt)
    | ('fallo', '')."""
    if rms_de(path) < RMS_MIN:
        return "silencio", ""
    estado, txt, causa = stt_hear(path)
    if estado == "silencio":
        return "silencio", ""
    if estado == "fallo":
        fallos.avisar("stt-hear", causa)
    if not txt:
        txt, causa_gw = stt_gateway(path, language)
        if not txt and causa_gw:
            fallos.avisar("stt-gateway", causa_gw)
    if not txt:
        return "fallo", ""
    if es_alucinacion(txt):
        return "alucinacion", txt
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
    """

    def __init__(self, audio_dir, fallos, mic_nombre=None):
        self.audio_dir = Path(audio_dir)
        self.fallos = fallos
        self.mic_nombre = mic_nombre or MIC_NOMBRE
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
        pipe = self.ffmpeg.stdout if self.ffmpeg else None
        if pipe is None:
            self.cola.put(None)
            return
        frames_corte = SILENCIO_CORTE_MS // FRAME_MS
        frames_min = UTT_MIN_MS // FRAME_MS
        frames_max = UTT_MAX_MS // FRAME_MS
        preroll = deque(maxlen=PREROLL_MS // FRAME_MS)
        voz = []
        silencio_seguido = 0
        while True:
            d = pipe.read(FRAME_BYTES)
            if not d:
                break
            con_voz = rms_frame(d) >= RMS_MIN
            if voz:
                voz.append(d)
                silencio_seguido = 0 if con_voz else silencio_seguido + 1
                if silencio_seguido >= frames_corte or len(voz) >= frames_max:
                    if len(voz) - silencio_seguido >= frames_min:
                        self._encolar(voz)
                    else:
                        self.n_mudo += 1
                    voz = []
                    silencio_seguido = 0
            else:
                preroll.append(d)
                if con_voz:
                    voz = list(preroll)
                    silencio_seguido = 0
        if len(voz) - silencio_seguido >= frames_min:
            self._encolar(voz)
        self.cola.put(None)

    def _encolar(self, frames):
        self.n_utt += 1
        ruta = self.audio_dir / f"utt-{self.n_utt:04d}.wav"
        with wave.open(str(ruta), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(16000)
            w.writeframes(b"".join(frames))
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
