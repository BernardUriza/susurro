#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# DICTAR — dictado de terminal sobre el motor de escucha (consumidor canario).
#
#   Uso:    python3 ~/Documents/susurro/escucha/dictar.py [etiqueta]
#   Parar:  Ctrl+C  (drena el utterance en curso)
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
import signal
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

try:
    from escucha.motor import (MotorCaptura, Fallos, transcribir_tiers, calentar_hear,
                               diarizar, ahora, RMS_MIN, SILENCIO_CORTE_MS)
except ModuleNotFoundError:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from escucha.motor import (MotorCaptura, Fallos, transcribir_tiers, calentar_hear,
                               diarizar, ahora, RMS_MIN, SILENCIO_CORTE_MS)


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


def main():
    # SIGTERM/SIGHUP (harness, terminal cerrada) drenan igual que Ctrl+C;
    # sin esto la sesión muere muda, sin FIN — pasó dos veces el 2026-08-13
    def _senal(signum, _frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, _senal)
    signal.signal(signal.SIGHUP, _senal)

    etiqueta = sys.argv[1] if len(sys.argv) > 1 else "dictado"
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    base = Path(__file__).resolve().parent / "sesiones" / f"{etiqueta}-{stamp}"
    base.mkdir(parents=True)
    log = base / "transcripcion.md"
    fallos = Fallos(base / "fallos.log")

    calentar_hear(base)
    vum = Vumetro()
    motor = MotorCaptura(base, fallos, on_rms=vum.latido)
    idx = motor.arrancar()
    log.write_text(f"# Dictado — {etiqueta}\n\n- Inicio: {datetime.now():%Y-%m-%d %H:%M:%S}\n"
                   f"- Micrófono: índice {idx}\n"
                   f"- Corte a {SILENCIO_CORTE_MS}ms de silencio · VAD RMS≥{RMS_MIN}\n\n---\n\n")
    print(f"DICTANDO al mic [{idx}]. Habla; cada frase sale al callar. Ctrl+C para parar.")
    print(f"Transcript: {log}")

    n_ok = 0
    frases = []

    def procesar(wav, marca=""):
        nonlocal n_ok
        estado, txt = transcribir_tiers(wav, fallos)
        if estado != "ok":
            return
        n_ok += 1
        frases.append(txt)
        with log.open("a") as f:
            f.write(f"**[{ahora()}]**{marca} {txt}\n\n")
        vum.imprimir(f"CACHO {n_ok}: {txt}")

    interrumpido = False
    try:
        for wav in motor.utterances():
            if wav is None:
                vum.imprimir("LA GRABACION MURIO SOLA — el mic ya no captura. Relanza dictar.py")
                break
            procesar(wav)
    except KeyboardInterrupt:
        interrumpido = True

    for wav in motor.cerrar():
        procesar(wav, marca=" ·final")
    vum.apagar()

    hablantes = diarizar("\n".join(frases), fallos) if len(frases) >= 2 else None
    if hablantes:
        with log.open("a") as f:
            f.write("\n## Hablantes\n\n")
            for quien, txt in hablantes:
                f.write(f"**{quien}:** {txt}\n\n")

    with log.open("a") as f:
        f.write(f"\n---\n\n- Fin: {ahora()} · {n_ok} frases · "
                f"{motor.n_mudo} silencios descartados\n")
        if hablantes:
            f.write(f"- Hablantes: {len({q for q, _ in hablantes})}\n")
        f.write(fallos.resumen())
    print(f"FIN ({'Ctrl+C' if interrumpido else 'stream'}): {n_ok} frases · transcript en {log}", flush=True)


if __name__ == "__main__":
    main()
