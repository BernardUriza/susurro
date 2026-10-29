"""Avisos de fuera del motor hacia la pantalla de la llamada.

Cualquier proceso (el hook PreCompact de Claude Code, un `aviso_compact.py --situacion build`)
APPENDEA una línea JSON a `ruta_avisos()`; `dictar.py` la lee entre frases y la imprime en stdout
como `⚠ AVISO ...` para que el Monitor de /escucha (que greppea `⚠`) la ponga frente a Bernard.
Formato: {"t": iso, "situacion": "compactando", "segundos": 20, "frases": ["...", "..."]}"""
import json
import os
from pathlib import Path


def ruta_avisos():
    explicita = os.environ.get("ESCUCHA_AVISOS")
    if explicita:
        return Path(explicita)
    base = os.environ.get("LOCALAPPDATA") or str(Path.home() / ".cache")
    return Path(base) / "escucha" / "avisos.jsonl"


def escribir(situacion, frases, segundos=None, ruta=None, **extra):
    """Append de un aviso. Nunca lanza: avisar no puede tumbar ni al hook ni al motor."""
    destino = Path(ruta) if ruta else ruta_avisos()
    fila = {"t": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
            "situacion": situacion, "segundos": segundos, "frases": list(frases), **extra}
    try:
        destino.parent.mkdir(parents=True, exist_ok=True)
        with destino.open("a", encoding="utf-8") as f:
            f.write(json.dumps(fila, ensure_ascii=False) + "\n")
        return True
    except OSError:
        return False


class Avisos:
    """Lector incremental: `nuevos()` devuelve los avisos escritos desde la última llamada.
    Arranca al FINAL del archivo (lo viejo no es de esta sesión)."""

    def __init__(self, ruta=None):
        self.ruta = Path(ruta) if ruta else ruta_avisos()
        self.pos = self.ruta.stat().st_size if self.ruta.exists() else 0

    def nuevos(self):
        if not self.ruta.exists():
            return []
        try:
            with self.ruta.open("rb") as f:
                f.seek(self.pos)
                crudo = f.read()
        except OSError:
            return []
        if not crudo.endswith(b"\n"):
            # línea a medio escribir: se lee en la próxima vuelta
            corte = crudo.rfind(b"\n") + 1
            crudo = crudo[:corte]
        self.pos += len(crudo)
        out = []
        for linea in crudo.decode("utf-8", errors="replace").splitlines():
            try:
                out.append(json.loads(linea))
            except json.JSONDecodeError:
                continue
        return out


def formatear(aviso):
    """Un aviso → líneas para stdout. La primera lleva ⚠ (la greppea el Monitor)."""
    seg = aviso.get("segundos")
    cabeza = f"⚠ AVISO {aviso.get('situacion', '?')}" + (f" · ~{seg} s" if seg else "")
    lineas = [cabeza, "🔊 SUGIERO DIGAS ESTO:"]
    lineas += [f"   · {fr}" for fr in aviso.get("frases", [])]
    return lineas
