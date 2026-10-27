"""Recibo vivo del Antieco (herramienta, no test): mic abierto, un wav por la bocina, y se mide el rms que el
segmentador VE en el mic (ya pasado por el AEC) durante la reproducción, más el ritmo
de llegada de los frames del mic. Uso: python -X utf8 escucha/recibo_antieco.py <wav> (ESCUCHA_AEC y
MIC_BUFFER_MS vienen del entorno)."""
import os
import statistics
import sys
import tempfile
import threading
import time
import winsound
from pathlib import Path

sys.path.insert(0, r"C:\Users\bernard.uriza\Documents\BernardUriza\susurro")
from escucha import motor  # noqa: E402

wav = sys.argv[1]
base = Path(tempfile.mkdtemp(prefix="aec-vivo-"))
fallos = motor.Fallos(base / "f.log")
lecturas = []
llegadas = []
original = motor.MotorCaptura._frames_mic


def frames_con_reloj(self):
    for d in original(self):
        llegadas.append(time.monotonic())
        yield d


motor.MotorCaptura._frames_mic = frames_con_reloj
m = motor.MotorCaptura(base, fallos, on_rms=lambda rms, en: lecturas.append((time.monotonic(), rms)))
m.arrancar()
t_arranque = time.monotonic()
time.sleep(3)
t0 = time.monotonic()
winsound.PlaySound(wav, winsound.SND_FILENAME)
t1 = time.monotonic()
time.sleep(1.5)
rezagados = m.cerrar()

ambiente = [r for t, r in lecturas if t_arranque + 1 < t < t0]
durante = [r for t, r in lecturas if t0 + 0.3 < t < t1]
origenes = {}
for ruta in list(m.origen):
    origenes[m.origen[ruta]] = origenes.get(m.origen[ruta], 0) + 1
gaps = [b - a for a, b in zip(llegadas, llegadas[1:])]
print(f"AEC={os.environ.get('ESCUCHA_AEC', '1')} MIC_BUFFER_MS={os.environ.get('MIC_BUFFER_MS', '30')}")
print(f"  mic ambiente: max {max(ambiente or [0])} · media {statistics.mean(ambiente or [0]):.0f}")
print(f"  mic DURANTE la bocina: max {max(durante or [0])} · media {statistics.mean(durante or [0]):.0f} · p90 "
      f"{sorted(durante)[int(len(durante) * 0.9)] if durante else 0}")
print(f"  utterances por origen: {origenes or 'ninguno'}")
print(f"  frames del mic: {len(llegadas)} · hueco entre frames p50 {statistics.median(gaps) * 1000:.0f} ms · "
      f"p95 {sorted(gaps)[int(len(gaps) * 0.95)] * 1000:.0f} ms · max {max(gaps) * 1000:.0f} ms")
if m.antieco:
    print(f"  antieco: {m.antieco.resumen()}")
print(f"  fallos: {fallos.por_origen or 'ninguno'}")
