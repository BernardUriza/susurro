"""Antieco: el eco de la bocina se resta de la onda del mic (WebRTC AEC3) y, sin
librería o sin referencia, el mic pasa intacto. El caso con eco real necesita
pywebrtc-audio (Windows); sin ella se salta sólo ese caso."""
import array
import math
import queue
import tempfile
import unittest
from pathlib import Path

from antieco import Antieco
from motor import FRAME_BYTES, Fallos, FuenteLoopback, rms_frame

try:
    import pywebrtc_audio  # noqa: F401
    HAY_AEC = True
except ImportError:
    HAY_AEC = False


def frames_de(muestras, n=FRAME_BYTES // 2):
    return [array.array("h", muestras[i:i + n]).tobytes() for i in range(0, len(muestras) - n + 1, n)]


class TestSinLibreriaOSinReferencia(unittest.TestCase):
    def test_inactivo_devuelve_el_frame_tal_cual(self):
        fallos = Fallos(Path(tempfile.mkdtemp()) / "f.log")
        a = Antieco(fallos, queue.Queue())
        a.activo = False
        d = bytes(range(256)) * (FRAME_BYTES // 256)
        self.assertIs(a.procesar(d), d)

    @unittest.skipUnless(HAY_AEC, "pywebrtc-audio no instalado")
    def test_sin_referencia_cuenta_el_hueco_y_conserva_la_voz(self):
        fallos = Fallos(Path(tempfile.mkdtemp()) / "f.log")
        a = Antieco(fallos, queue.Queue())
        voz = [int(3000 * math.sin(i * 2 * math.pi * 220 / 16000)) for i in range(16000)]
        salida = [a.procesar(f) for f in frames_de(voz)]
        self.assertEqual(a.sin_referencia, len(salida))
        antes = rms_frame(b"".join(frames_de(voz)[10:]))
        despues = rms_frame(b"".join(salida[10:]))
        self.assertGreater(despues, antes * 0.7, "sin eco que restar, la voz sobrevive")


@unittest.skipUnless(HAY_AEC, "pywebrtc-audio no instalado")
class TestConEco(unittest.TestCase):
    def test_resta_el_eco_y_conserva_la_voz(self):
        import random
        random.seed(1)
        sr = 16000
        lejos = [int(random.gauss(0, 3000)) for _ in range(sr * 6)]
        retraso = int(0.040 * sr)
        eco = [0] * retraso + [x // 2 for x in lejos[:-retraso]]
        voz = [0] * (3 * sr) + [int(4000 * math.sin(i * 2 * math.pi * 220 / sr)) for i in range(sr)] + [0] * (2 * sr)
        cerca = [max(-32768, min(32767, e + v)) for e, v in zip(eco, voz)]
        referencia = queue.Queue()
        a = Antieco(Fallos(Path(tempfile.mkdtemp()) / "f.log"), referencia)
        salida = []
        for f_cerca, f_lejos in zip(frames_de(cerca), frames_de(lejos)):
            referencia.put(f_lejos)
            salida.append(a.procesar(f_cerca))
        por_s = sr // (FRAME_BYTES // 2)
        eco_antes = rms_frame(b"".join(frames_de(cerca)[int(4.5 * por_s):]))
        eco_despues = rms_frame(b"".join(salida[int(4.5 * por_s):]))
        self.assertLess(eco_despues, eco_antes / 5, f"eco {eco_antes} → {eco_despues}: menos de 14 dB")
        voz_despues = rms_frame(b"".join(salida[3 * por_s:4 * por_s]))
        self.assertGreater(voz_despues, 2828 * 0.7, f"la voz debe sobrevivir (rms {voz_despues})")
        self.assertEqual(a.sin_referencia, 0)

    def test_referencia_atrasada_se_tira_para_resincronizar(self):
        referencia = queue.Queue(maxsize=100)
        a = Antieco(Fallos(Path(tempfile.mkdtemp()) / "f.log"), referencia)
        for _ in range(40):
            referencia.put(bytes(FRAME_BYTES))
        a.procesar(bytes(FRAME_BYTES))
        self.assertGreater(a.resincronizados, 0)
        self.assertLessEqual(referencia.qsize(), 10)


class TestLoopbackAlimentaLaReferencia(unittest.TestCase):
    def test_cada_frame_entregado_queda_copiado_para_el_antieco(self):
        fuente = FuenteLoopback(Fallos(Path(tempfile.mkdtemp()) / "f.log"))
        fuente.vivo = True
        gen = fuente.frames()
        next(gen)
        fuente.cola.put(array.array("h", [500] * (FRAME_BYTES // 2)).tobytes())
        next(gen)
        self.assertEqual(fuente.referencia.qsize(), 2, "silencio inyectado y frame real, ambos referidos")
        self.assertEqual(rms_frame(fuente.referencia.get_nowait()), 0)
        self.assertEqual(rms_frame(fuente.referencia.get_nowait()), 500)


if __name__ == "__main__":
    unittest.main()
