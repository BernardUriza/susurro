#!/usr/bin/env python3
"""hablar.py — habla por las bocinas de esta máquina vía el gateway Susurro.

Versión canónica en Python de `~/.claude/scripts/susurro-say.sh`. Lo que agrega
sobre el bash: **parte los textos largos sola**, por frontera de oración, y
reproduce las tiradas en secuencia. El bash tenía un tope práctico de ~1200
caracteres por llamada, así que un texto de 900 palabras había que partirlo a
mano en cinco pedazos y hacer cinco llamadas. Eso era trabajo de la herramienta.

Uso:
    python hablar.py "texto corto"
    printf '%s' "$TEXTO_LARGO" | python hablar.py -      # preferible para largo
    python hablar.py - --dry-run < texto.txt             # sólo enseña el corte

Contrato de salida (IDÉNTICO al del bash — hay reglas que dependen de él):
    mp3=<ruta> bytes=<n> voice=<voz>
    played_s=<s> duration_s=<s>
...una pareja por tirada, y al cierre una línea de total:
    tiradas=<n> total_played_s=<s> total_duration_s=<s>

Sin `played_s` no se puede reportar que sonó: si ningún reproductor logra sonar,
el proceso sale con código != 0 y lo dice.

El token JAMÁS se imprime. Para diagnosticar sólo se reporta longitud y prefijo.
"""

from __future__ import annotations

import argparse
import atexit
import contextlib
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

GATEWAY_POR_DEFECTO = "https://sus.bernarduriza.com"
VOZ_POR_DEFECTO = "onyx"
FORMATO_POR_DEFECTO = "mp3"
MAXIMO_POR_DEFECTO = 1100
TIMEOUT_S = 120

ARCHIVOS_DE_TOKEN = ("~/.secrets/susurro-token.txt", "~/.secrets/susurro-gateway-key.txt")
_VARIABLE_DE_TOKEN = re.compile(r"^SUSURRO_(?:TOKEN|KEY)=(.*)$")


class HablarError(RuntimeError):
    """Falla esperable: token ausente, gateway caído, audio inválido, mudez."""


# ---------------------------------------------------------------- el token

def resolver_token() -> str:
    """Devuelve el token del gateway. Nunca lo imprime ni lo registra."""
    del_entorno = os.environ.get("SUSURRO_TOKEN", "").strip()
    if del_entorno:
        return del_entorno
    for candidato in ARCHIVOS_DE_TOKEN:
        ruta = os.path.expanduser(candidato)
        if not os.path.isfile(ruta):
            continue
        with open(ruta, "r", encoding="utf-8", errors="replace") as fh:
            for linea in fh:
                hallazgo = _VARIABLE_DE_TOKEN.match(linea.strip())
                if hallazgo and hallazgo.group(1).strip():
                    return hallazgo.group(1).strip()
    raise HablarError(
        "sin token — exporta SUSURRO_TOKEN o agrega SUSURRO_TOKEN=/SUSURRO_KEY= "
        f"a {ARCHIVOS_DE_TOKEN[0]}"
    )


def huella_del_token(token: str) -> str:
    """Descripción segura del token para diagnósticos: largo y prefijo."""
    return f"len={len(token)} prefijo={token[:4]}…"


# ------------------------------------------------------- el auto-chunking

_FIN_DE_ORACION = re.compile(r'(?<=[.!?…])["»”’\')\]]*(?:\s+|$)')
_FIN_DE_CLAUSULA = re.compile(r'(?<=[,;:—])\s+')


def _cortar_en(texto: str, patron: re.Pattern) -> list[str]:
    """Parte `texto` en los puntos que marca `patron`, sin perder caracteres."""
    piezas, ultimo = [], 0
    for hallazgo in patron.finditer(texto):
        if hallazgo.end() > ultimo:
            piezas.append(texto[ultimo:hallazgo.end()])
            ultimo = hallazgo.end()
    if ultimo < len(texto):
        piezas.append(texto[ultimo:])
    return [p for p in piezas if p.strip()]


def _cortar_por_palabra(fragmento: str, maximo: int) -> list[str]:
    """Último recurso. Jamás parte a media palabra: una palabra más larga que
    el máximo sale entera aunque exceda."""
    trozos: list[str] = []
    actual = ""
    for palabra in fragmento.split():
        candidato = palabra if not actual else f"{actual} {palabra}"
        if len(candidato) > maximo and actual:
            trozos.append(actual)
            actual = palabra
        else:
            actual = candidato
    if actual:
        trozos.append(actual)
    return trozos


def _unidades_minimas(texto: str, maximo: int) -> list[str]:
    """Oraciones; si una excede el máximo, sus cláusulas; si aún excede, palabras."""
    unidades: list[str] = []
    for oracion in _cortar_en(texto, _FIN_DE_ORACION):
        if len(oracion.strip()) <= maximo:
            unidades.append(oracion)
            continue
        for clausula in _cortar_en(oracion, _FIN_DE_CLAUSULA):
            if len(clausula.strip()) <= maximo:
                unidades.append(clausula)
            else:
                unidades.extend(_cortar_por_palabra(clausula, maximo))
    return unidades


def _pegar(izquierda: str, derecha: str) -> str:
    """Une dos piezas garantizando separación, sin duplicar espacios."""
    if not izquierda:
        return derecha
    if izquierda[-1].isspace() or derecha[:1].isspace():
        return izquierda + derecha
    return f"{izquierda} {derecha}"


def partir(texto: str, maximo: int = MAXIMO_POR_DEFECTO) -> list[str]:
    """Parte `texto` en tiradas de a lo más `maximo` caracteres.

    Preferencia de frontera: oración > cláusula (coma, punto y coma, dos puntos,
    raya) > palabra. Nunca corta a media palabra.
    """
    texto = texto.strip()
    if not texto:
        return []
    if len(texto) <= maximo:
        return [texto]

    tiradas: list[str] = []
    actual = ""
    for unidad in _unidades_minimas(texto, maximo):
        candidato = _pegar(actual, unidad)
        if actual and len(candidato.strip()) > maximo:
            tiradas.append(actual.strip())
            actual = unidad
        else:
            actual = candidato
    if actual.strip():
        tiradas.append(actual.strip())
    return tiradas


# ------------------------------------------------- la ventana de habla (lock)

def ruta_del_lock() -> str:
    """Archivo que existe MIENTRAS la bocina suena. `motor.py` lo lee para
    etiquetar el eco como [BOCINA] en vez de atribuírselo a Bernard."""
    return os.environ.get("SUSURRO_LOCK") or os.path.join(
        os.environ.get("TMPDIR", "/tmp"), "susurro-hablando.lock"
    )


_LOCKS_VIVOS: set[str] = set()


def _barrer_locks(*_ignorado) -> None:
    for ruta in list(_LOCKS_VIVOS):
        with contextlib.suppress(OSError):
            os.unlink(ruta)
        _LOCKS_VIVOS.discard(ruta)


atexit.register(_barrer_locks)

_SENALES_QUE_MATAN = (signal.SIGTERM, signal.SIGHUP)


@contextlib.contextmanager
def _guardia_de_senales():
    """Mientras haya un lock vivo, SIGTERM y SIGHUP dejan de ser muerte súbita.

    El default de Python para esas señales mata el proceso sin correr `atexit`,
    así que el lock se quedaría pegado. Aquí se barre primero y luego se muere
    con el código de salida de siempre. El guardia es temporal y se desinstala
    al cerrar la ventana, para no secuestrar las señales de quien importe este
    módulo. En un hilo que no sea el principal `signal` no aplica: se deja pasar.
    """
    previos = {}
    try:
        for senal in _SENALES_QUE_MATAN:
            previos[senal] = signal.getsignal(senal)
            signal.signal(senal, _morir_limpio)
    except ValueError:
        previos.clear()
    try:
        yield
    finally:
        for senal, anterior in previos.items():
            with contextlib.suppress(ValueError, TypeError):
                signal.signal(senal, anterior)


def _morir_limpio(numero, _marco) -> None:
    _barrer_locks()
    signal.signal(numero, signal.SIG_DFL)
    os.kill(os.getpid(), numero)


@contextlib.contextmanager
def ventana_de_habla(texto: str):
    """Crea el lock con el texto adentro y lo borra SIEMPRE al salir —
    también si truena la reproducción, si el usuario da Ctrl+C o si al proceso
    lo matan con SIGTERM. Un lock pegado hace que el motor marque como eco de
    bocina TODO lo que Bernard diga después, y rompe el registro de la sesión
    sin que nadie se entere: por eso las tres redes."""
    ruta = ruta_del_lock()
    with open(ruta, "w", encoding="utf-8") as fh:
        fh.write(texto + "\n")
    _LOCKS_VIVOS.add(ruta)
    try:
        with _guardia_de_senales():
            yield ruta
    finally:
        with contextlib.suppress(OSError):
            os.unlink(ruta)
        _LOCKS_VIVOS.discard(ruta)


# ------------------------------------------------------------- el gateway

def _es_audio_creible(datos: bytes, formato: str) -> bool:
    """Un HTTP 200 puede no ser audio (el gateway devuelve JSON de error con 200
    en algunos caminos). Se checan bytes mágicos antes de mandarlo a la bocina."""
    if len(datos) <= 1024:
        return False
    if formato != "mp3":
        return True
    if datos[:3] == b"ID3":
        return True
    return datos[0] == 0xFF and (datos[1] & 0xE0) == 0xE0


def sintetizar(texto: str, destino: str, *, gateway: str, voz: str,
               formato: str, token: str) -> int:
    """Pide el audio al gateway y lo escribe en `destino`. Devuelve los bytes.

    `ensure_ascii=True` hace que los acentos viajen como \\uXXXX: ninguna
    codificación intermedia puede corromper el payload.
    """
    cuerpo = json.dumps(
        {"input": texto, "voice": voz, "format": formato}, ensure_ascii=True
    ).encode("ascii")
    peticion = urllib.request.Request(
        gateway.rstrip("/") + "/v1/tts",
        data=cuerpo,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Content-Length": str(len(cuerpo)),
        },
    )
    try:
        with urllib.request.urlopen(peticion, timeout=TIMEOUT_S) as respuesta:
            audio = respuesta.read()
    except urllib.error.HTTPError as error:
        detalle = ""
        with contextlib.suppress(Exception):
            detalle = error.read()[:300].decode("utf-8", "replace")
        if error.code == 429:
            raise HablarError(
                "429 rate limited — el tier onboarding son 50 req/día. NO se "
                "reintenta en bucle: acuña una key de proyecto en /admin."
            ) from error
        raise HablarError(f"el gateway respondió HTTP {error.code} — {detalle}") from error
    except urllib.error.URLError as error:
        raise HablarError(f"no se pudo alcanzar {gateway} — {error.reason}") from error

    if not _es_audio_creible(audio, formato):
        raise HablarError(
            f"la respuesta no es audio ({len(audio)}B) — {audio[:300]!r}"
        )
    with open(destino, "wb") as fh:
        fh.write(audio)
    return len(audio)


def duracion_de(ruta: str) -> str:
    """Duración en segundos según ffprobe, o '?' si no hay ffprobe."""
    if shutil.which("ffprobe") is None:
        return "?"
    resultado = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", ruta],
        capture_output=True, text=True,
    )
    salida = resultado.stdout.strip()
    return salida if resultado.returncode == 0 and salida else "?"


# --------------------------------------------------------- la reproducción

REPRODUCTORES = (
    ("afplay", lambda ruta: ["afplay", ruta]),
    ("ffplay", lambda ruta: ["ffplay", "-nodisp", "-autoexit", "-loglevel", "error", ruta]),
    ("mpg123", lambda ruta: ["mpg123", "-q", ruta]),
)


def reproducir(ruta: str, *, espera_s: float = 1.0) -> tuple[str | None, list[str]]:
    """Suena el archivo. Devuelve (reproductor que logró sonar, quejas).

    Prueba CADA reproductor instalado y pasa al siguiente cuando el anterior
    FALLA — no sólo cuando falta. Ése fue el bug del 2026-08-15: afplay truena
    con `AudioQueueStart failed (-66681)` por contención con el micrófono
    (había dictado corriendo) y la versión encadenada reportaba "no player
    found" sin haber intentado ffplay ni mpg123, que sí estaban. Da dos vueltas
    con una pausa entre ellas: el dispositivo suele liberarse solo.
    """
    quejas: list[str] = []
    instalados = [(n, a) for n, a in REPRODUCTORES if shutil.which(n)]
    if not instalados:
        return None, ["no hay ningún reproductor instalado (afplay/ffplay/mpg123)"]

    for vuelta in (1, 2):
        for nombre, construir in instalados:
            resultado = subprocess.run(
                construir(ruta), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE
            )
            if resultado.returncode == 0:
                return nombre, quejas
            detalle = resultado.stderr.decode("utf-8", "replace").strip().splitlines()
            quejas.append(
                f"vuelta {vuelta}: {nombre} rc={resultado.returncode}"
                + (f" — {detalle[-1][:160]}" if detalle else "")
            )
        if vuelta == 1:
            time.sleep(espera_s)
    return None, quejas


# ------------------------------------------------------------ la operación

def hablar(texto: str, *, gateway: str | None = None, voz: str | None = None,
           formato: str | None = None, maximo: int = MAXIMO_POR_DEFECTO,
           salida=None) -> dict:
    """Parte, sintetiza y suena. Devuelve el resumen de la tirada completa.

    Levanta `HablarError` en cuanto una tirada no logra sonar: media lectura
    con la otra media muda es peor que una falla franca.
    """
    salida = salida or sys.stdout
    gateway = gateway or os.environ.get("SUSURRO_GATEWAY") or GATEWAY_POR_DEFECTO
    voz = voz or os.environ.get("SUSURRO_VOICE") or VOZ_POR_DEFECTO
    formato = formato or os.environ.get("SUSURRO_FORMAT") or FORMATO_POR_DEFECTO

    tiradas = partir(texto, maximo)
    if not tiradas:
        raise HablarError("texto vacío")

    token = resolver_token()
    taller = tempfile.mkdtemp(prefix="susurro.", dir=os.environ.get("TMPDIR", "/tmp"))
    total_played = 0
    total_duracion = 0.0
    duracion_confiable = True

    for numero, tirada in enumerate(tiradas, 1):
        mp3 = os.path.join(taller, f"say-{numero:02d}.{formato}")
        bytes_escritos = sintetizar(
            tirada, mp3, gateway=gateway, voz=voz, formato=formato, token=token
        )
        print(f"mp3={mp3} bytes={bytes_escritos} voice={voz}", file=salida, flush=True)

        duracion = duracion_de(mp3)
        arranque = time.monotonic()
        with ventana_de_habla(tirada):
            reproductor, quejas = reproducir(mp3)
        transcurrido = round(time.monotonic() - arranque)

        if reproductor is None:
            raise HablarError(
                f"mp3 generado en {mp3} pero NINGÚN reproductor logró sonar "
                f"(2 vueltas) — reproducción FALLIDA: {'; '.join(quejas)}"
            )
        print(f"played_s={transcurrido} duration_s={duracion}", file=salida, flush=True)
        total_played += transcurrido
        try:
            total_duracion += float(duracion)
        except ValueError:
            duracion_confiable = False

    total = f"{total_duracion:.3f}" if duracion_confiable else "?"
    print(
        f"tiradas={len(tiradas)} total_played_s={total_played} total_duration_s={total}",
        file=salida, flush=True,
    )
    return {
        "tiradas": len(tiradas),
        "tamanos": [len(t) for t in tiradas],
        "total_played_s": total_played,
        "total_duration_s": total,
    }


# --------------------------------------------------------------------- CLI

def _leer_texto(argumentos: list[str]) -> str:
    if argumentos == ["-"] or not argumentos:
        if sys.stdin.isatty() and not argumentos:
            raise HablarError('sin texto — pasa una cadena o "-" para leer stdin')
        return sys.stdin.read()
    return " ".join(argumentos)


def main(argv: list[str] | None = None) -> int:
    analizador = argparse.ArgumentParser(
        prog="hablar.py",
        description="Habla por las bocinas vía el gateway Susurro, partiendo solo el texto largo.",
    )
    analizador.add_argument("texto", nargs="*", help='texto, o "-" para leer stdin')
    analizador.add_argument("--voz", default=None, help=f"voz (default: {VOZ_POR_DEFECTO})")
    analizador.add_argument("--formato", default=None, help=f"formato (default: {FORMATO_POR_DEFECTO})")
    analizador.add_argument("--gateway", default=None, help=f"gateway (default: {GATEWAY_POR_DEFECTO})")
    analizador.add_argument("--max", type=int, default=MAXIMO_POR_DEFECTO,
                            dest="maximo", help="caracteres máximos por tirada")
    analizador.add_argument("--dry-run", action="store_true",
                            help="sólo enseña cómo partiría el texto; no llama al gateway ni suena")
    opciones = analizador.parse_args(argv)

    try:
        texto = _leer_texto(opciones.texto)
        if not texto.strip():
            raise HablarError("texto vacío")

        if opciones.dry_run:
            tiradas = partir(texto, opciones.maximo)
            palabras = len(texto.split())
            print(f"dry-run palabras={palabras} chars={len(texto)} tiradas={len(tiradas)}")
            for numero, tirada in enumerate(tiradas, 1):
                print(f"  [{numero:02d}] chars={len(tirada)} "
                      f"inicia={tirada[:48]!r} termina={tirada[-32:]!r}")
            return 0

        hablar(texto, gateway=opciones.gateway, voz=opciones.voz,
               formato=opciones.formato, maximo=opciones.maximo)
        return 0
    except HablarError as error:
        print(f"hablar: {error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        _barrer_locks()
        print("hablar: interrumpido — lock liberado", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
