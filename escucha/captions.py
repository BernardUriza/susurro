"""Fuente [LLAMADA] preferida: los live captions de Teams web leídos del DOM por CDP.

Lanza `escucha/teams_captions.mjs` (Node, sin npm) contra el Chrome de debug (9333) y consume
su stdout: una línea JSON por frase `{ts, t_visto, t_estable_ms, speaker, text, rev, id, fuente}`.
Mientras llegan captions, el loopback de la bocina queda de RESPALDO: sus utterances [LLAMADA]
se descartan (motivo `captions-activos`) porque Whisper sobre la bocina oía mal y tardaba
(29-oct: mediana 9.6 s frase→texto, p90 16.6 s). Si los captions callan `VENTANA_S`, el
loopback vuelve a mandar solo. `ESCUCHA_CAPTIONS=0` apaga esta fuente."""
import json
import os
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

ACTIVO = os.environ.get("ESCUCHA_CAPTIONS", "1") == "1"
VENTANA_S = float(os.environ.get("CAPTIONS_VENTANA_S", "20"))
SCRIPT = Path(__file__).resolve().parent / "teams_captions.mjs"


def node_bin():
    return os.environ.get("NODE") or shutil.which("node") or ""


def disponible():
    return ACTIVO and bool(node_bin()) and SCRIPT.exists()


def parsear(linea):
    """Línea de stdout del .mjs → dict de frase, o None si no es una frase (logs van a stderr,
    pero una línea rota tampoco debe tumbar al hilo)."""
    linea = linea.strip()
    if not linea.startswith("{"):
        return None
    try:
        d = json.loads(linea)
    except json.JSONDecodeError:
        return None
    if not d.get("text"):
        return None
    return {"ts": d.get("ts", ""), "speaker": (d.get("speaker") or "").strip(), "text": d["text"].strip(),
            "rev": int(d.get("rev", 0) or 0), "id": d.get("id", ""), "parcial": bool(d.get("parcial")),
            "t_estable_ms": d.get("t_estable_ms"), "fuente": d.get("fuente", "")}


class FuenteCaptions:
    """Hilo que lee el stdout del .mjs y llama `on_frase(frase)` por cada final (y por cada
    corrección, rev>0). `activo()` dice si llegó algo en los últimos VENTANA_S segundos."""

    def __init__(self, fallos, sesion_dir, on_frase, salida=None):
        self.fallos = fallos
        self.sesion_dir = Path(sesion_dir)
        self.on_frase = on_frase
        self.salida = Path(salida) if salida else self.sesion_dir / "captions.jsonl"
        self.proc = None
        self.hilo = None
        self.n = 0
        self.ultima = 0.0
        self.fuente_dom = ""
        self.estado = ""

    def arrancar(self):
        if not disponible():
            return False
        cmd = [node_bin(), str(SCRIPT), "--out", str(self.salida)]
        if os.environ.get("ESCUCHA_CDP_PORT"):
            cmd += ["--port", os.environ["ESCUCHA_CDP_PORT"]]
        try:
            self.proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                         cwd=str(SCRIPT.parent.parent), text=True, encoding="utf-8", errors="replace")
        except OSError as e:
            self.fallos.avisar("captions", f"no arrancó node: {e}")
            return False
        self.hilo = threading.Thread(target=self._leer, daemon=True)
        self.hilo.start()
        threading.Thread(target=self._stderr, daemon=True).start()
        return True

    def _leer(self):
        for linea in self.proc.stdout:
            frase = parsear(linea)
            if not frase:
                continue
            self.marcar(frase)
            try:
                self.on_frase(frase)
            except Exception as e:
                self.fallos.avisar("captions", f"on_frase: {type(e).__name__}: {e}")

    def marcar(self, frase):
        self.ultima = time.monotonic()
        self.fuente_dom = frase.get("fuente") or self.fuente_dom
        if not frase.get("parcial"):
            self.n += 1

    PROBLEMA = ("no contesta", "sin pestaña", "fatal", "evaluate:", "target ", "no pude escribir", "ws")

    def _stderr(self):
        """El .mjs loguea por stderr; sólo lo que es un problema va a fallos.log (una vez por causa).
        «vigilando …» y «salida: …» son informativos y quedan en `self.estado`."""
        avisado = set()
        for linea in self.proc.stderr:
            texto = linea.strip()
            if not texto:
                continue
            mensaje = texto.split("] ", 1)[-1]
            self.estado = mensaje
            if not any(p in mensaje for p in self.PROBLEMA):
                continue
            clave = mensaje[:40]
            if clave in avisado:
                continue
            avisado.add(clave)
            self.fallos.avisar("captions", mensaje)

    def activo(self, ventana_s=None):
        return self.ultima > 0 and time.monotonic() - self.ultima < (VENTANA_S if ventana_s is None else ventana_s)

    def vivo(self):
        return self.proc is not None and self.proc.poll() is None

    def cerrar(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        if self.hilo:
            self.hilo.join(timeout=2)

    def resumen(self):
        if not self.proc:
            return "captions: no (sin node, sin script o ESCUCHA_CAPTIONS=0)"
        return (f"captions: {self.n} frases de Teams (DOM {self.fuente_dom or 'sin filas'}; "
                f"último estado: {self.estado or '?'}) → {self.salida.name}")


if __name__ == "__main__":
    print(f"node: {node_bin() or 'NO'} · script: {SCRIPT} ({'existe' if SCRIPT.exists() else 'NO EXISTE'}) · activo: {ACTIVO}")
    sys.exit(0 if disponible() else 1)
