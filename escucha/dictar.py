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
# Reemplazó a ~/bin/dictado.sh (bash, cortes de reloj) el mismo día que nació.
# ─────────────────────────────────────────────────────────────────────────────
import sys
from datetime import datetime
from pathlib import Path

try:
    from escucha.motor import (MotorCaptura, Fallos, transcribir_tiers, calentar_hear,
                               ahora, RMS_MIN, SILENCIO_CORTE_MS)
except ModuleNotFoundError:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from escucha.motor import (MotorCaptura, Fallos, transcribir_tiers, calentar_hear,
                               ahora, RMS_MIN, SILENCIO_CORTE_MS)


def main():
    etiqueta = sys.argv[1] if len(sys.argv) > 1 else "dictado"
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    base = Path(__file__).resolve().parent / "sesiones" / f"{etiqueta}-{stamp}"
    base.mkdir(parents=True)
    log = base / "transcripcion.md"
    fallos = Fallos(base / "fallos.log")

    calentar_hear(base)
    motor = MotorCaptura(base, fallos)
    idx = motor.arrancar()
    log.write_text(f"# Dictado — {etiqueta}\n\n- Inicio: {datetime.now():%Y-%m-%d %H:%M:%S}\n"
                   f"- Micrófono: índice {idx}\n"
                   f"- Corte a {SILENCIO_CORTE_MS}ms de silencio · VAD RMS≥{RMS_MIN}\n\n---\n\n")
    print(f"DICTANDO al mic [{idx}]. Habla; cada frase sale al callar. Ctrl+C para parar.")
    print(f"Transcript: {log}")

    n_ok = 0

    def procesar(wav, marca=""):
        nonlocal n_ok
        estado, txt = transcribir_tiers(wav, fallos)
        if estado != "ok":
            return
        n_ok += 1
        with log.open("a") as f:
            f.write(f"**[{ahora()}]**{marca} {txt}\n\n")
        print(f"CACHO {n_ok}: {txt}", flush=True)

    interrumpido = False
    try:
        for wav in motor.utterances():
            if wav is None:
                print("LA GRABACION MURIO SOLA — el mic ya no captura. Relanza dictar.py", flush=True)
                break
            procesar(wav)
    except KeyboardInterrupt:
        interrumpido = True

    for wav in motor.cerrar():
        procesar(wav, marca=" ·final")
    with log.open("a") as f:
        f.write(f"\n---\n\n- Fin: {ahora()} · {n_ok} frases · "
                f"{motor.n_mudo} silencios descartados\n{fallos.resumen()}")
    print(f"FIN ({'Ctrl+C' if interrumpido else 'stream'}): {n_ok} frases · transcript en {log}", flush=True)


if __name__ == "__main__":
    main()
