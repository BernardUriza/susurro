"""Aviso ANTES de que Claude se quede callado en una llamada (compactación de contexto, build,
búsqueda larga): escribe el aviso para `dictar.py` (vía `escucha/avisos.py`), lo imprime, y si hay
una sesión de /escucha viva dispara un TTS corto. Las frases vienen de `frases_ganar_tiempo.md`.

Como hook de Claude Code (PreCompact, `~/.claude/settings.local.json`): recibe el JSON del hook
por stdin (`hook_event_name`, `trigger`), no recibe argumentos.

A mano, para una tarea que va a tardar más de ~15 s:
    python -X utf8 escucha/aviso_compact.py --situacion esperando-build --segundos 40
    python -X utf8 escucha/aviso_compact.py --situacion buscando-en-codigo --sin-tts --dry-run

Nunca falla hacia Claude Code: exit 0 siempre (un aviso roto no debe bloquear la compactación)."""
import argparse
import json
import os
import random
import subprocess
import sys
import time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent))
from escucha import avisos  # noqa: E402

FRASES = AQUI / "frases_ganar_tiempo.md"
SESIONES = AQUI / "sesiones"
SESION_VIVA_S = 180
SEGUNDOS_COMPACT = int(os.environ.get("ESCUCHA_COMPACT_S", "25"))


def banco(ruta=FRASES):
    secciones, actual = {}, None
    try:
        lineas = Path(ruta).read_text(encoding="utf-8").splitlines()
    except OSError:
        return {}
    for linea in lineas:
        if linea.startswith("## "):
            actual = linea[3:].strip().lower()
            secciones[actual] = []
        elif linea.startswith("- ") and actual:
            secciones[actual].append(linea[2:].strip())
    return secciones


def elegir(situacion, n=3, ruta=FRASES, azar=random):
    b = banco(ruta)
    frases = b.get(situacion.lower()) or b.get("general") or ["Give me a second."]
    return azar.sample(frases, min(n, len(frases)))


def sesion_viva(sesiones=SESIONES, ventana_s=SESION_VIVA_S):
    """Hay una llamada en curso si una sesión de dictar escribió su registro hace poco y no la pararon."""
    ahora = time.time()
    try:
        carpetas = sorted(Path(sesiones).iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
    except OSError:
        return None
    for c in carpetas[:5]:
        reg = c / "registro.jsonl"
        if reg.exists() and not (c / "PARAR").exists() and ahora - reg.stat().st_mtime < ventana_s:
            return c
    return None


def tts(texto):
    """TTS corto y en background; si no hay gateway o llave, no pasa nada."""
    try:
        subprocess.Popen([sys.executable, "-X", "utf8", str(AQUI / "hablar.py"), texto],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=str(AQUI.parent))
        return True
    except OSError:
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--situacion", default=None)
    ap.add_argument("--segundos", type=int, default=None)
    ap.add_argument("--sin-tts", action="store_true")
    ap.add_argument("--dry-run", action="store_true", help="no escribe el aviso ni habla; sólo imprime")
    a = ap.parse_args()

    hook = {}
    if not sys.stdin.isatty():
        try:
            crudo = sys.stdin.read()
            hook = json.loads(crudo) if crudo.strip() else {}
        except (json.JSONDecodeError, OSError):
            hook = {}
    situacion = a.situacion or ("compactando" if hook.get("hook_event_name") == "PreCompact" else "tarea-larga")
    segundos = a.segundos or (SEGUNDOS_COMPACT if situacion == "compactando" else None)
    frases = elegir(situacion)
    viva = sesion_viva()

    aviso = {"situacion": situacion, "segundos": segundos, "frases": frases,
             "trigger": hook.get("trigger"), "sesion": viva.name if viva else None}
    if not a.dry_run:
        avisos.escribir(situacion, frases, segundos, trigger=hook.get("trigger"), sesion=aviso["sesion"])
    for linea in avisos.formatear(aviso):
        print(linea)
    hablo = False
    if viva and not a.sin_tts and not a.dry_run and os.environ.get("ESCUCHA_AVISO_TTS", "1") == "1":
        hablo = tts(f"Compacting, about {segundos} seconds." if situacion == "compactando" else "This will take a moment.")
    print(f"(aviso → {avisos.ruta_avisos()} · sesión viva: {viva.name if viva else 'no'} · tts: {'sí' if hablo else 'no'}"
          f"{' · dry-run' if a.dry_run else ''})")
    if hook.get("hook_event_name") == "PreCompact":
        print(json.dumps({"systemMessage": f"Compactando (~{segundos} s). Bernard ya tiene frases para ganar tiempo en la pantalla de la llamada."}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # jamás bloquear a Claude Code por un aviso
        print(f"aviso_compact: {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(0)
