"""Sumidero canónico de eventos del sistema de voz — una sola forma de medir.

Por qué existe (15-ago-2026): el registro de las sesiones era un `.md` con hora
y texto. Con eso NO se puede depurar nada — por eso pasaron desapercibidos, el
mismo día, tres defectos que sólo se vieron al instrumentar: utterances cortados
a los 15.000 ms exactos a media palabra, 23 frases desaparecidas sin motivo, y
música de fondo entrando al registro como si la hubiera dicho Bernard.

La regla que lo gobierna: **medir no puede romper lo medido.** Ninguna función
de aquí lanza excepción hacia el llamador; si el disco falla, se pierde el
evento, jamás la sesión.

Formato: JSON Lines, un evento por línea, append-only. Se elige sobre un .md
porque es agregable (`jq`, pandas) y sobre SQLite porque no necesita esquema ni
migraciones para un archivo que se lee una vez y se archiva.

Uso:
    from instrumentacion import evento, sesion_actual

    evento("lexico.correccion", regla="bus→bug", antes="bus", despues="bug")
    evento("tts.tirada", chars=1067, played_s=68, reproductor="afplay")

Dónde escribe, por orden de precedencia:
  1. `$SUSURRO_REGISTRO` — ruta explícita (la usa `dictar.py` para meter todo en
     la carpeta de la sesión).
  2. `~/.cache/susurro/eventos-AAAAMMDD.jsonl` — el diario del día, para lo que
     ocurre fuera de una sesión de dictado (una llamada suelta a `hablar.py`).
"""

import json
import os
import threading
import time
from datetime import datetime
from pathlib import Path

_CANDADO = threading.Lock()
_DIARIO_POR_DEFECTO = Path.home() / ".cache" / "susurro"

# Silencia el sumidero por completo (tests, o una corrida donde no se quiera
# tocar el disco). Se lee en cada llamada a propósito: así un test puede
# encenderlo y apagarlo sin reimportar el módulo.
VARIABLE_APAGADO = "SUSURRO_SIN_REGISTRO"


def ruta_del_registro():
    """Devuelve el archivo donde se escriben los eventos, o None si está apagado."""
    if os.environ.get(VARIABLE_APAGADO):
        return None
    explicita = os.environ.get("SUSURRO_REGISTRO")
    if explicita:
        return Path(explicita)
    return _DIARIO_POR_DEFECTO / f"eventos-{datetime.now():%Y%m%d}.jsonl"


def sesion_actual():
    """Identificador de la sesión en curso, para poder agrupar eventos después.

    Es el nombre de la carpeta de sesión cuando `dictar.py` fijó `$SUSURRO_REGISTRO`;
    si no, el PID, que al menos separa una corrida de otra."""
    explicita = os.environ.get("SUSURRO_REGISTRO")
    if explicita:
        return Path(explicita).parent.name
    return f"pid-{os.getpid()}"


def evento(tipo, **campos):
    """Escribe un evento. NUNCA lanza — un fallo de instrumentación no puede
    tumbar una sesión de voz.

    `tipo` es jerárquico con puntos (`lexico.correccion`, `tts.tirada`,
    `tts.fallo`) para poder filtrar por prefijo sin parsear el resto.
    Devuelve True si se escribió, False si no; el llamador puede ignorarlo."""
    try:
        destino = ruta_del_registro()
        if destino is None:
            return False
        fila = {"t": datetime.now().isoformat(timespec="milliseconds"),
                "tipo": tipo, "sesion": sesion_actual(), **campos}
        linea = json.dumps(fila, ensure_ascii=False, default=str) + "\n"
        with _CANDADO:                       # varios hilos escriben (segmentador, TTS)
            destino.parent.mkdir(parents=True, exist_ok=True)
            with destino.open("a", encoding="utf-8") as f:
                f.write(linea)
        return True
    except Exception:
        return False                          # a propósito: medir no rompe


class cronometro:
    """Mide una operación y emite el evento al salir, con `ms` y `ok`.

        with cronometro("tts.sintesis", chars=len(texto)) as c:
            audio = pedir_al_gateway(texto)
            c.campos["bytes"] = len(audio)

    Si el bloque lanza, el evento sale igual con `ok=False` y el tipo de la
    excepción — que es justo cuando más falta hace el dato."""

    def __init__(self, tipo, **campos):
        self.tipo = tipo
        self.campos = dict(campos)
        self._t0 = time.monotonic()   # ya listo aunque no se use como context manager

    def __enter__(self):
        self._t0 = time.monotonic()
        return self

    def __exit__(self, exc_tipo, exc, _tb):
        ms = round((time.monotonic() - self._t0) * 1000, 1)
        evento(self.tipo, ms=ms, ok=exc is None,
               **({"error": exc_tipo.__name__} if exc_tipo else {}), **self.campos)
        return False                          # nunca traga la excepción


def leer(ruta=None, prefijo=None):
    """Lee los eventos de vuelta, opcionalmente filtrando por prefijo de tipo.
    Ignora líneas corruptas en vez de morir: un registro a medio escribir no
    debe impedir leer los 500 eventos buenos que sí quedaron."""
    destino = Path(ruta) if ruta else ruta_del_registro()
    if destino is None or not Path(destino).exists():
        return []
    filas = []
    for linea in Path(destino).read_text(encoding="utf-8").splitlines():
        if not linea.strip():
            continue
        try:
            fila = json.loads(linea)
        except json.JSONDecodeError:
            continue
        if prefijo is None or str(fila.get("tipo", "")).startswith(prefijo):
            filas.append(fila)
    return filas


def resumen(ruta=None):
    """Cuenta eventos por tipo. Es lo primero que uno quiere ver al abrir un
    registro: qué pasó y cuántas veces."""
    conteo = {}
    for fila in leer(ruta):
        conteo[fila.get("tipo", "?")] = conteo.get(fila.get("tipo", "?"), 0) + 1
    return dict(sorted(conteo.items(), key=lambda kv: -kv[1]))


if __name__ == "__main__":
    import sys
    ruta = sys.argv[1] if len(sys.argv) > 1 else None
    for tipo, n in resumen(ruta).items():
        print(f"{n:6d}  {tipo}")
