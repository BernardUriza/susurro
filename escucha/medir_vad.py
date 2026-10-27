"""Mide el VAD de RNNoise sobre el corpus de sesiones de ESTA máquina y propone umbrales.

Así se "entrena" la regla del ruido en cada máquina (ThinkPad, Rayo9): cada sesión de dictar
deja sus `utt-*.wav` con el veredicto que el motor les dio en `registro.jsonl`; este script
corre `vad_rnnoise.mjs` sobre todos, los separa en habla (utterance con texto) y ruido
(descartados por silencio/ruido/alucinación) y muestra el hueco entre ambas clases. Los
umbrales vigentes (MIN_VOZ_MS, MIN_MEDIO en vad.py) se eligieron el 2026-10-27 sobre 75
utterances de la ThinkPad; si en otra máquina las clases se traslapan, aquí se ve antes de
tocar nada.

    python -X utf8 escucha/medir_vad.py            # todas las sesiones de escucha/sesiones
    python -X utf8 escucha/medir_vad.py <sesion>…  # carpetas concretas
    python -X utf8 escucha/medir_vad.py --csv > corpus.csv"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

os.environ.setdefault("SUSURRO_SIN_REGISTRO", "1")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from escucha import motor, vad  # noqa: E402

SESIONES = Path(__file__).resolve().parent / "sesiones"
HABLA = "habla"
RUIDO = "ruido"
LOTE = 40
MOTIVOS_RUIDO = {"silencio", "ruido", "alucinacion"}


def clases(sesion):
    """wav → (clase, detalle) a partir del registro: una utterance con texto real es HABLA; una
    cuyo texto es alucinación conocida en modo estricto («¡Gracias!», «Bye.»: sesiones anteriores a la puerta) o un
    descartado por silencio/ruido/alucinación es RUIDO. Un descartado por `fallo` del gateway
    no tiene veredicto y no se clasifica."""
    out = {}
    for linea in (sesion / "registro.jsonl").read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            e = json.loads(linea)
        except ValueError:
            continue
        if e.get("tipo") == "utterance" and e.get("texto"):
            clase = RUIDO if motor.es_alucinacion(e["texto"], estricto=True) else HABLA
            out[e["wav"]] = (clase, f"{e.get('origen', '?')} rms={e.get('rms')} «{e['texto'][:40]}»")
        elif e.get("tipo") == "utterance.descartado" and e.get("motivo") in MOTIVOS_RUIDO:
            out[e["wav"]] = (RUIDO, f"{e.get('origen', '?')} rms={e.get('rms')} {e.get('motivo')}")
    return out


def medir_todos(wavs):
    """Un solo proceso de Node por lote: el arranque de Node cuesta más que medir."""
    medidas = {}
    if not vad.disponible():
        sys.exit("falta node o vad_rnnoise.mjs: no hay VAD que medir")
    for i in range(0, len(wavs), LOTE):
        lote = wavs[i:i + LOTE]
        r = subprocess.run([vad.NODE, str(vad.SCRIPT), *map(str, lote)], capture_output=True,
                           text=True, encoding="utf-8", timeout=120)
        for linea in r.stdout.splitlines():
            try:
                m = json.loads(linea)
            except ValueError:
                continue
            if "voz_ms" in m:
                medidas[Path(m["wav"])] = m
    return medidas


def resumen(filas):
    por_clase = {HABLA: [], RUIDO: []}
    for f in filas:
        por_clase[f["clase"]].append(f)
    for clase, fs in por_clase.items():
        if not fs:
            print(f"{clase}: sin muestras")
            continue
        voz = sorted(f["voz_ms"] for f in fs)
        medio = sorted(f["vad_medio"] for f in fs)
        print(f"{clase}: {len(fs)} utterances · voz_ms {voz[0]}…{voz[-1]} · vad_medio {medio[0]:.2f}…{medio[-1]:.2f}")
    habla, ruido = por_clase[HABLA], por_clase[RUIDO]
    if habla and ruido:
        piso_habla = min(f["voz_ms"] for f in habla)
        techo_ruido = max(f["voz_ms"] for f in ruido if f["vad_medio"] >= vad.MIN_MEDIO) if any(
            f["vad_medio"] >= vad.MIN_MEDIO for f in ruido) else 0
        print(f"hueco en voz_ms entre el ruido que pasa el medio ({techo_ruido}) y el habla más corta ({piso_habla}); "
              f"umbrales vigentes MIN_VOZ_MS={vad.MIN_VOZ_MS} MIN_MEDIO={vad.MIN_MEDIO}")
    mal = [f for f in filas if (vad.es_ruido(f) and f["clase"] == HABLA) or (not vad.es_ruido(f) and f["clase"] == RUIDO)]
    print(f"contra los umbrales vigentes: {len(mal)} de {len(filas)} quedan del lado contrario")
    for f in sorted(mal, key=lambda f: f["voz_ms"]):
        print(f"  {f['clase']:5} {f['voz_ms']:>5} ms  medio {f['vad_medio']:.2f}  {f['sesion']}/{f['wav']}  {f['detalle']}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sesiones", nargs="*", help="carpetas de sesión; sin argumentos, todas las de escucha/sesiones")
    ap.add_argument("--csv", action="store_true", help="volcar el corpus como CSV en vez del resumen")
    a = ap.parse_args()
    carpetas = [Path(s) for s in a.sesiones] or sorted(p for p in SESIONES.iterdir() if (p / "registro.jsonl").exists())
    filas, pendientes = [], []
    for sesion in carpetas:
        cl = clases(sesion)
        for wav, (clase, detalle) in cl.items():
            ruta = sesion / wav
            if ruta.exists():
                pendientes.append((ruta, sesion.name, wav, clase, detalle))
    medidas = medir_todos([p[0] for p in pendientes])
    for ruta, nombre, wav, clase, detalle in pendientes:
        m = medidas.get(ruta)
        if m:
            filas.append({"sesion": nombre, "wav": wav, "clase": clase, "detalle": detalle,
                          "voz_ms": m["voz_ms"], "vad_medio": m["vad_medio"], "vad_max": m["vad_max"]})
    if a.csv:
        print("sesion,wav,clase,voz_ms,vad_medio,vad_max,detalle")
        for f in filas:
            print(",".join(str(f[k]) for k in ("sesion", "wav", "clase", "voz_ms", "vad_medio", "vad_max")) + ',"' + f["detalle"].replace('"', "'") + '"')
        return
    print(f"{len(filas)} utterances medidas en {len(carpetas)} sesiones")
    resumen(filas)


if __name__ == "__main__":
    main()
