#!/Users/bernardurizaorozco/.pyenv/versions/3.14.0/bin/python
"""Detector de tesitura: mide F0 con parselmouth (Praat) sobre uno o más wav.

Uso: tesitura.py archivo1.wav [archivo2.wav ...]
parselmouth vive en pyenv 3.14.0 (no en conda escucha, no en el python3 de brew).
Nacido en la sesión de compras del 2026-08-13 (coro-7rings.wav); antes vivía
como heredocs inline que morían con cada sesión.
"""
import math
import sys

import parselmouth

NOTAS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def nota(hz):
    if hz <= 0:
        return "—"
    semitonos = round(12 * math.log2(hz / 440.0)) + 57
    return f"{NOTAS[semitonos % 12]}{semitonos // 12}"


def analizar(ruta):
    snd = parselmouth.Sound(ruta)
    intensidad = snd.to_intensity().get_average()
    print(f"\n== {ruta}")
    print(f"duración {snd.duration:.1f}s · intensidad media {intensidad:.0f} dB")
    if intensidad < 45:
        print("⚠️ toma débil — probable zumbido/ruido; acércate al mic y canta fuerte")
    # piso 70 Hz: bajo eso se cuela el zumbido de 60 Hz de la corriente
    # (lección de glissando-1, 2026-08-13)
    pitch = snd.to_pitch_ac(pitch_floor=70.0, pitch_ceiling=900.0)
    f0 = sorted(v for v in pitch.selected_array["frequency"] if v > 0)
    if not f0:
        print("SIN VOZ — no se captó nada")
        return
    p5, p50, p95 = (f0[int(len(f0) * q)] for q in (0.05, 0.5, 0.95))
    print(f"frames con voz: {len(f0)}")
    print(f"grave (p5):  {p5:6.0f} Hz ≈ {nota(p5)}")
    print(f"mediana:     {p50:6.0f} Hz ≈ {nota(p50)}")
    print(f"agudo (p95): {p95:6.0f} Hz ≈ {nota(p95)}")
    print(f"extremos:    {f0[0]:.0f}–{f0[-1]:.0f} Hz ({nota(f0[0])}–{nota(f0[-1])})")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("uso: tesitura.py <wav> [...]")
    for ruta in sys.argv[1:]:
        analizar(ruta)
