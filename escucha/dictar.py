#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# DICTAR — dictado de terminal sobre el motor de escucha (consumidor canario).
#
#   Uso:    python3 ~/Documents/susurro/escucha/dictar.py [etiqueta]
#   Parar:  Ctrl+C, o crear el archivo PARAR en la carpeta de la sesión (Windows en
#           background no recibe Ctrl+C). Ambos drenan el utterance en curso.
#
# Cada frase completa sale como una línea `CACHO n: texto` en stdout — diseñado
# para leerse a ojo o bajo un Monitor (cada línea = un evento). El transcript
# íntegro queda en ~/Documents/susurro/escucha/sesiones/.
# Entre frases, un vúmetro RMS en vivo en stderr (\r, jamás líneas nuevas:
# stdout es el protocolo CACHO/FIN/MURIO y no se ensucia). Al cerrar, la sesión
# se diariza via {GATEWAY}/v1/diarize y el transcript anota Hablante A/B.
# Reemplazó a ~/bin/dictado.sh (bash, cortes de reloj) el mismo día que nació.
# ─────────────────────────────────────────────────────────────────────────────
import math
import os
from concurrent.futures import ThreadPoolExecutor
import signal
import sys
import threading
import time
import array
import wave
import json
from datetime import datetime
from pathlib import Path

try:
    from escucha.motor import (MotorCaptura, Fallos, transcribir_tiers, calentar_hear,
                               calentar_gateway, diarizar, ahora, RMS_MIN, SILENCIO_CORTE_MS,
                               HEAR, GATEWAY)
    from escucha import careo, stt_local, captions, avisos
    from escucha.eco import FiltroEco
except ModuleNotFoundError:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from escucha.motor import (MotorCaptura, Fallos, transcribir_tiers, calentar_hear,
                               calentar_gateway, diarizar, ahora, RMS_MIN, SILENCIO_CORTE_MS,
                               HEAR, GATEWAY)
    from escucha import careo, stt_local, captions, avisos
    from escucha.eco import FiltroEco

for _flujo in (sys.stdout, sys.stderr):
    if hasattr(_flujo, "reconfigure"):
        _flujo.reconfigure(encoding="utf-8", errors="replace")


class Vumetro:
    """Línea de status en vivo: "te estoy oyendo a volumen X" entre cachos.
    Escribe con \\r sobre stderr y solo si es TTY; stdout queda intacto para
    los consumidores que greppean CACHO/FIN/MURIO bajo un Monitor."""

    ANCHO = 24
    TECHO = math.log10(2000)

    def __init__(self, activo=None, stream=None):
        self.stream = stream or sys.stderr
        self.activo = self.stream.isatty() if activo is None else activo
        self.candado = threading.Lock()
        self._ultimo = 0.0

    def latido(self, rms, en_frase):
        t = time.monotonic()
        if t - self._ultimo < 0.08:
            return
        self._ultimo = t
        lleno = 0 if rms < 1 else min(self.ANCHO, int(self.ANCHO * math.log10(rms) / self.TECHO))
        barra = "█" * lleno + "░" * (self.ANCHO - lleno)
        estado = "frase…" if en_frase else ("voz" if rms >= RMS_MIN else "silencio")
        with self.candado:
            if not self.activo:
                return
            self.stream.write(f"\r\033[K🎙 {barra} rms {rms:>4} · {estado}")
            self.stream.flush()

    def imprimir(self, linea):
        with self.candado:
            if self.activo:
                self.stream.write("\r\033[K")
                self.stream.flush()
            print(linea, flush=True)

    def apagar(self):
        with self.candado:
            if self.activo:
                self.stream.write("\r\033[K")
                self.stream.flush()
            self.activo = False


try:
    from escucha.instrumentacion import evento, leer
except ModuleNotFoundError:
    from instrumentacion import evento, leer


def main():
    # SIGTERM/SIGHUP (harness, terminal cerrada) drenan igual que Ctrl+C;
    # sin esto la sesión muere muda, sin FIN — pasó dos veces el 2026-08-13
    def _senal(signum, _frame):
        raise KeyboardInterrupt
    for nombre in ("SIGTERM", "SIGHUP"):
        if hasattr(signal, nombre):
            signal.signal(getattr(signal, nombre), _senal)

    etiqueta = sys.argv[1] if len(sys.argv) > 1 else "dictado"
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    base = Path(__file__).resolve().parent / "sesiones" / f"{etiqueta}-{stamp}"
    base.mkdir(parents=True)
    log = base / "transcripcion.md"
    # Registro INSTRUMENTADO: una línea JSON por utterance con métricas
    # objetivas, no sólo texto. Sin esto no se puede depurar por qué una frase
    # salió mal ni de dónde vino el sonido. (Bernard, 15-ago-2026: "reestructura
    # e instrumenta bien eso de los registros porque fallas".)
    registro = base / "registro.jsonl"
    # UN SOLO sumidero: se le dice a instrumentacion.py que escriba DENTRO de la
    # sesión, para que los eventos de lexico y hablar caigan en el mismo archivo
    # que las filas de utterance. Antes vivían en ~/.cache/susurro/ sin llave de
    # unión: la corrección aplicada a la frase 12 quedaba huérfana de la frase 12.
    os.environ["SUSURRO_REGISTRO"] = str(registro)
    fallos = Fallos(base / "fallos.log")
    # Windows no entrega SIGINT a un proceso en background: el archivo PARAR es el Ctrl+C
    # portable. Parada COOPERATIVA (el motor lo consulta entre utterances), no interrupt_main:
    # una interrupción a media transcripción perdía la frase que estaba en el gateway.
    parar = base / "PARAR"

    calentar_hear(base)
    calentar_gateway(base)
    vum = Vumetro()
    motor = MotorCaptura(base, fallos, on_rms=vum.latido)
    # Eco TEXTUAL (bocinas abiertas): el mic repite lo que ya salió por LLAMADA.
    # Sólo espera a la copia del loopback donde hay loopback; en la Mac no cuesta nada.
    filtro_eco = FiltroEco(espera_s=float(os.environ.get("ESCUCHA_ECO_ESPERA_S", "3")) if motor.loopback else 0.0)
    idx = motor.arrancar()
    stt = f"hear → {GATEWAY}" if HEAR.exists() else f"{GATEWAY} (hear no instalado)"
    bocina = motor.loopback.nombre if motor.loopback else "no (sólo micrófono)"
    log.write_text(f"# Dictado — {etiqueta}\n\n- Inicio: {datetime.now():%Y-%m-%d %H:%M:%S}\n"
                   f"- Micrófono: {idx}\n- Bocina (loopback): {bocina}\n- STT: {stt}\n"
                   f"- Corte a {SILENCIO_CORTE_MS}ms de silencio · VAD RMS≥{RMS_MIN}\n\n---\n\n",
                   encoding="utf-8")
    print(f"DICTANDO al mic [{idx}] · bocina: {bocina} · STT {stt}. Habla; cada frase sale al callar.")
    print(f"Antieco: {'sí' if motor.antieco and motor.antieco.activo else 'no'} · "
          f"tier local: {'modelo en disco' if stt_local.disponible() else 'sin modelo'} · "
          f"careo: se lee del gateway al calentar")
    print(f"Parar: Ctrl+C, o crea el archivo {parar}")
    print(f"Transcript: {log}", flush=True)

    n_ok = 0
    frases = []
    candado = threading.Lock()

    def frase_caption(fr):
        """Una frase de los live captions de Teams (fuente preferida de LLAMADA): sale como
        `CACHO n [LLAMADA·Quién]: texto` sin pasar por audio ni STT. rev>0 = Teams la corrigió."""
        nonlocal n_ok
        hora = fr["ts"][11:19] if len(fr.get("ts", "")) >= 19 else ahora()
        quien = f"·{fr['speaker']}" if fr.get("speaker") else ""
        marca = " (corrección)" if fr.get("rev", 0) > 0 else ""
        # Con bocinas abiertas la voz de Brian también entra al mic: el caption es la referencia
        # del filtro de eco textual, igual que lo era el cacho del loopback
        filtro_eco.registrar_llamada(fr["text"])
        with candado:
            n_ok += 1
            frases.append((f"cap-{n_ok:04d}", fr["text"]))
            with log.open("a", encoding="utf-8") as f:
                f.write(f"**[{hora}]** [LLAMADA{quien}]{marca} {fr['text']}\n\n")
            vum.imprimir(f"CACHO {n_ok} [LLAMADA{quien}]{marca}: {fr['text']}")
            evento("utterance", n=n_ok, origen="LLAMADA", fuente="captions", speaker=fr.get("speaker", ""),
                   texto=fr["text"], chars=len(fr["text"]), rev=fr.get("rev", 0),
                   latencia_captions_ms=fr.get("t_estable_ms"), dom=fr.get("fuente", ""))

    fuente_captions = captions.FuenteCaptions(fallos, base, frase_caption)
    con_captions = fuente_captions.arrancar()
    lector_avisos = avisos.Avisos()
    print(f"Captions de Teams (CDP 9333): {'leyendo el DOM; la bocina queda de respaldo' if con_captions else 'no (sin node/script o ESCUCHA_CAPTIONS=0); LLAMADA viene de la bocina'}"
          f" · avisos: {lector_avisos.ruta}", flush=True)

    def drenar_avisos(parar_fn):
        # Un hook PreCompact o un `aviso_compact.py` escribe el aviso; aquí sale a pantalla en <1 s
        # aunque nadie esté hablando (el bucle de utterances sólo despierta con audio)
        while not parar_fn():
            for av in lector_avisos.nuevos():
                for linea in avisos.formatear(av):
                    vum.imprimir(linea)
            time.sleep(0.5)

    def metrica_wav(ruta):
        """RMS medio/pico y duración leídos del .wav. Barato y sin dependencias:
        es la evidencia mínima para saber si algo fue voz cercana, eco de bocina
        o ruido de fondo."""
        try:
            with wave.open(str(ruta), "rb") as w:
                n, sw, fr = w.getnframes(), w.getsampwidth(), w.getframerate()
                crudo = w.readframes(n)
            muestras = array.array("h"); muestras.frombytes(crudo)
            if not muestras:
                return {"dur_s": 0.0, "rms": 0, "pico": 0}
            suma = sum(x * x for x in muestras)
            return {"dur_s": round(n / fr, 3),
                    "rms": int((suma / len(muestras)) ** 0.5),
                    "pico": int(max(abs(min(muestras)), abs(max(muestras))))}
        except Exception:
            return {"dur_s": None, "rms": None, "pico": None}

    def procesar(wav, marca=""):
        nonlocal n_ok
        t0 = time.monotonic()
        try:
            hora_audio = datetime.fromtimestamp(Path(wav).stat().st_mtime).strftime("%H:%M:%S")
        except OSError:
            hora_audio = ahora()
        if motor.origen_de(wav) == "LLAMADA" and fuente_captions.activo():
            # Los captions de Teams ya traen al interlocutor con nombre y en ~1 s; la bocina
            # transcrita por Whisper es el respaldo y sólo manda cuando los captions callan
            evento("utterance.descartado", wav=Path(wav).name, motivo="captions-activos",
                   origen="LLAMADA", **metrica_wav(wav))
            return
        estado, txt = transcribir_tiers(wav, fallos)
        if estado != "ok":
            # Los descartes TAMBIÉN se registran: un silencio mal cortado o una
            # alucinación filtrada son datos, no basura que se tira.
            evento("utterance.descartado", wav=Path(wav).name, motivo=estado,
                   origen=motor.origen_de(wav),
                   latencia_stt_s=round(time.monotonic() - t0, 2), **metrica_wav(wav))
            return
        # Quién habló: BERNARD, la BOCINA (eco del TTS) o la LLAMADA (loopback).
        origen = motor.origen_de(wav)
        if origen == "LLAMADA":
            filtro_eco.registrar_llamada(txt)
        elif origen == "BERNARD":
            ref = filtro_eco.es_eco(txt)
            if ref is not None:
                evento("utterance.descartado", wav=Path(wav).name, motivo="eco", origen=origen,
                       texto=txt, repite=ref,
                       latencia_stt_s=round(time.monotonic() - t0, 2), **metrica_wav(wav))
                return
        etiqueta_origen = "" if origen == "BERNARD" else f" [{origen}]"
        # Varias frases se transcriben a la vez: la emisión va bajo candado y el
        # transcript lleva la hora en que se CORTÓ el audio, no en que llegó el texto
        with candado:
            n_ok += 1
            frases.append((Path(wav).name, txt))
            with log.open("a", encoding="utf-8") as f:
                f.write(f"**[{hora_audio}]**{marca}{etiqueta_origen} {txt}\n\n")
            vum.imprimir(f"CACHO {n_ok}{etiqueta_origen}: {txt}")
            fila = {"n": n_ok, "wav": Path(wav).name,
                    "origen": origen, "texto": txt, "chars": len(txt),
                    "latencia_stt_s": round(time.monotonic() - t0, 2),
                    **metrica_wav(wav)}
            evento("utterance", **fila)

    # Tres transcripciones en vuelo a la vez: una frase lenta (gateway frío, 25 s)
    # ya no congela las que vienen detrás ni a la otra fuente
    pool = ThreadPoolExecutor(max_workers=3, thread_name_prefix="stt")
    interrumpido = False
    terminando = threading.Event()
    threading.Thread(target=drenar_avisos, args=(terminando.is_set,), daemon=True).start()
    try:
        for wav in motor.utterances(parar=parar.exists):
            if wav is None:
                vum.imprimir("LA GRABACION MURIO SOLA — el mic ya no captura. Relanza dictar.py")
                break
            if con_captions and not fuente_captions.vivo():
                con_captions = False
                vum.imprimir("⚠ el lector de captions de Teams murió; LLAMADA vuelve a la bocina")
            pool.submit(procesar, wav)
    except KeyboardInterrupt:
        interrumpido = True

    terminando.set()
    fuente_captions.cerrar()
    for wav in motor.cerrar():
        pool.submit(procesar, wav, " ·final")
    pool.shutdown(wait=True)
    vum.apagar()
    frases.sort()
    frases = [txt for _, txt in frases]

    hablantes = diarizar("\n".join(frases), fallos) if len(frases) >= 2 else None
    if hablantes:
        with log.open("a", encoding="utf-8") as f:
            f.write("\n## Hablantes\n\n")
            for quien, txt in hablantes:
                f.write(f"**{quien}:** {txt}\n\n")

    with log.open("a", encoding="utf-8") as f:
        f.write(f"\n---\n\n- Fin: {ahora()} · {n_ok} frases · "
                f"{motor.n_mudo} silencios descartados\n")
        if motor.antieco:
            f.write(f"- Antieco: {motor.antieco.resumen()}\n")
        f.write(f"- {fuente_captions.resumen()}\n")
        caps = careo.capacidades()
        f.write(f"- Careo: deepgram {'sí' if caps.get('deepgram') else 'no'} · juez {'sí' if caps.get('claude') else 'no'}"
                f" · tier local {'cargado' if stt_local.listo() else (stt_local.causa() or 'no se necesitó')}\n")
        if hablantes:
            f.write(f"- Hablantes: {len({q for q, _ in hablantes})}\n")
        del_local = [e for e in leer(registro, "stt.local") if e.get("tipo") == "stt.local"]
        if del_local:
            motivos = {}
            for e in del_local:
                motivos[e.get("motivo", "?")] = motivos.get(e.get("motivo", "?"), 0) + 1
            f.write(f"- Tier local opinó en {len(del_local)} frases ({', '.join(f'{m}×{n}' for m, n in motivos.items())})\n")
        f.write(fallos.resumen())
    causa = "Ctrl+C" if interrumpido else ("PARAR" if parar.exists() else "stream")
    print(f"FIN ({causa}): {n_ok} frases · transcript en {log}", flush=True)


if __name__ == "__main__":
    main()
