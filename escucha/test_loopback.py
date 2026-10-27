"""La fuente de BOCINA (loopback WASAPI) sin hardware: conversión a 16 kHz mono,
inyección de silencio cuando el loopback se queda mudo, y segmentación de una
segunda fuente etiquetada LLAMADA sin tumbar al motor cuando termina.
Contexto: 2026-10-27, primera llamada de Teams en la ThinkPad: el mic sólo oía a
Bernard; la voz del interlocutor sale por la bocina y nunca entra al mic."""
import array
import queue
import tempfile
import threading
import unittest
from pathlib import Path

from motor import (FRAME_BYTES, FRAME_MS, Fallos, FuenteLoopback, MotorCaptura, a_16k_mono,
                   rms_frame)


def frame_16k(amplitud):
    n = 16000 * FRAME_MS // 1000
    return array.array("h", [amplitud] * n).tobytes()


class TestConversion(unittest.TestCase):
    def test_48k_estereo_a_16k_mono_promedia_canales_y_decima(self):
        n = 48000 * FRAME_MS // 1000
        estereo = array.array("h")
        for _ in range(n):
            estereo.extend([3000, 1000])
        salida = a_16k_mono(estereo.tobytes(), 48000, 2)
        self.assertEqual(len(salida), FRAME_BYTES, "un frame de 30 ms a 16 kHz")
        muestras = array.array("h"); muestras.frombytes(salida)
        self.assertTrue(all(m == 2000 for m in muestras), "promedio de los dos canales")

    def test_tasa_no_multiplo_toma_la_muestra_mas_cercana(self):
        n = 44100 * FRAME_MS // 1000
        mono = array.array("h", list(range(n)))
        salida = a_16k_mono(mono.tobytes(), 44100, 1)
        muestras = array.array("h"); muestras.frombytes(salida)
        self.assertEqual(len(muestras), n * 16000 // 44100)
        self.assertEqual(muestras[0], 0)
        self.assertEqual(muestras[-1], (len(muestras) - 1) * 44100 // 16000)

    def test_16k_mono_pasa_intacto(self):
        d = frame_16k(123)
        self.assertEqual(a_16k_mono(d, 16000, 1), d)


class TestSilencioInyectado(unittest.TestCase):
    def test_sin_chunks_la_fuente_cede_silencio_y_con_none_termina(self):
        fuente = FuenteLoopback(Fallos(Path(tempfile.mkdtemp()) / "f.log"))
        fuente.vivo = True
        gen = fuente.frames()
        primero = next(gen)
        self.assertEqual(primero, bytes(FRAME_BYTES), "hueco del loopback = frame de silencio")
        fuente.cola.put(frame_16k(500))
        self.assertEqual(rms_frame(next(gen)), 500)
        fuente.cola.put(None)
        with self.assertRaises(StopIteration):
            next(gen)


class TestSegundaFuente(unittest.TestCase):
    def test_llamada_se_etiqueta_y_su_fin_no_mata_al_motor(self):
        base = Path(tempfile.mkdtemp())
        motor = MotorCaptura(base, Fallos(base / "f.log"), loopback=False)
        frames = [frame_16k(0)] * 5 + [frame_16k(2000)] * 40 + [frame_16k(0)] * 25
        motor._segmentar(iter(frames), "LLAMADA", False)
        utt = motor.cola.get(timeout=2)
        self.assertIsNotNone(utt, "la fuente LLAMADA produce un utterance")
        self.assertEqual(motor.origen_de(utt), "LLAMADA")
        with self.assertRaises(queue.Empty):
            motor.cola.get(timeout=0.2)

    def test_mic_sigue_siendo_fatal(self):
        base = Path(tempfile.mkdtemp())
        motor = MotorCaptura(base, Fallos(base / "f.log"), loopback=False)
        motor._segmentar(iter([frame_16k(0)] * 3), "BERNARD", True)
        self.assertIsNone(motor.cola.get(timeout=2), "el mic muerto deja el None de siempre")

    def test_dos_fuentes_numeran_sin_chocar(self):
        base = Path(tempfile.mkdtemp())
        motor = MotorCaptura(base, Fallos(base / "f.log"), loopback=False)
        voz = [frame_16k(0)] * 5 + [frame_16k(2000)] * 40 + [frame_16k(0)] * 25
        hilos = [threading.Thread(target=motor._segmentar, args=(iter(voz * 3), o, False))
                 for o in ("BERNARD", "LLAMADA")]
        for h in hilos:
            h.start()
        for h in hilos:
            h.join(timeout=5)
        rutas = sorted(p.name for p in base.glob("utt-*.wav"))
        self.assertEqual(len(rutas), 6)
        self.assertEqual(len(set(rutas)), 6, "sin nombres repetidos entre hilos")


if __name__ == "__main__":
    unittest.main()
