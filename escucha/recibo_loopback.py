"""Recibo de humo del loopback: lanza dictar, reproduce un clip por la bocina, lo para con
PARAR y muestra lo que transcribió. Uso:

    python -X utf8 escucha/recibo_loopback.py <clip.wav> [--lang en-US]
    python -X utf8 escucha/recibo_loopback.py --tts "Good morning everyone." [--lang en-US]

Con --tts el clip se genera con el TTS del gateway (voz onyx) y se convierte a wav con el
ffmpeg del motor. El proceso de dictar se detiene con el archivo PARAR que anuncia su banner,
nunca con kill: así se drena la última frase y no quedan ffmpeg huérfanos."""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
import winsound
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from escucha import motor  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
ESPERA_BANNER_S = 90
COLA_TRAS_CLIP_S = 12


def clip_por_tts(texto, destino):
    key = motor.susurro_key()
    if not key:
        sys.exit("sin llave del gateway: " + ", ".join(str(a) for a in motor.archivos_key()))
    cuerpo = json.dumps({"input": texto, "voice": "onyx", "format": "mp3"}).encode("ascii")
    req = urllib.request.Request(f"{motor.GATEWAY}/v1/tts", data=cuerpo, method="POST", headers={
        "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as r:
        mp3 = destino.with_suffix(".mp3")
        mp3.write_bytes(r.read())
    subprocess.run([motor.ffmpeg_bin(), "-v", "error", "-y", "-i", str(mp3), "-ar", "48000", "-ac", "2",
                    str(destino)], check=True)
    return destino


def esperar_banner(log):
    t0 = time.time()
    while time.time() - t0 < ESPERA_BANNER_S:
        time.sleep(0.5)
        texto = log.read_text(encoding="utf-8", errors="replace")
        m = re.search(r"crea el archivo (\S+PARAR)", texto)
        if m and "Transcript:" in texto:
            return Path(m.group(1)), time.time() - t0
    return None, time.time() - t0


def resumen(sesion):
    eventos = [json.loads(l) for l in (sesion / "registro.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    print(f"  eventos: {dict(Counter(e.get('tipo') for e in eventos))}")
    for e in eventos:
        if e.get("tipo") == "utterance":
            print(f"  CACHO {e['n']} [{e['origen']}] rms={e['rms']} stt={e['latencia_stt_s']}s: {e['texto']}")
        elif e.get("tipo") == "utterance.descartado":
            print(f"  descartado [{e['origen']}] rms={e['rms']} motivo={e['motivo']}")
        elif e.get("tipo") == "stt.careo":
            print(f"  careo: {e['veredicto']} similitud={e.get('similitud')}")
    fallos = sesion / "fallos.log"
    if fallos.exists() and fallos.stat().st_size:
        print("  fallos:\n    " + fallos.read_text(encoding="utf-8", errors="replace").strip().replace("\n", "\n    "))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("wav", nargs="?")
    ap.add_argument("--tts", help="texto a sintetizar con el gateway en vez de un wav")
    ap.add_argument("--lang", default="en-US")
    ap.add_argument("--etiqueta", default="recibo-loopback")
    a = ap.parse_args()
    if not a.wav and not a.tts:
        ap.error("pasa un wav o --tts <texto>")
    taller = Path(tempfile.mkdtemp(prefix="recibo-loopback-"))
    wav = Path(a.wav) if a.wav else clip_por_tts(a.tts, taller / "clip.wav")
    log = taller / "dictar.log"
    env = dict(os.environ, ESCUCHA_LANG=a.lang, PYTHONUTF8="1")
    with log.open("w", encoding="utf-8") as fh:
        p = subprocess.Popen([sys.executable, "-X", "utf8", "-u", "-m", "escucha.dictar", a.etiqueta],
                             stdout=fh, stderr=subprocess.STDOUT, env=env, cwd=str(RAIZ))
        parar, espera = esperar_banner(log)
        if not parar:
            p.kill()
            sys.exit(f"dictar no mostró su banner en {espera:.0f}s:\n{log.read_text(encoding='utf-8', errors='replace')[-1500:]}")
        print(f"dictar listo en {espera:.1f}s · sesión {parar.parent.name} · clip {wav.name}")
        time.sleep(2)
        t1 = time.time()
        winsound.PlaySound(str(wav), winsound.SND_FILENAME)
        print(f"clip reproducido por la bocina: {time.time() - t1:.1f}s")
        time.sleep(COLA_TRAS_CLIP_S)
        parar.touch()
        try:
            p.wait(timeout=90)
        except subprocess.TimeoutExpired:
            p.kill()
            print("PARAR no detuvo a dictar en 90 s; matado (eso es un bug del motor, repórtalo)")
    print(f"dictar terminó con exit {p.returncode}")
    resumen(parar.parent)


if __name__ == "__main__":
    main()
