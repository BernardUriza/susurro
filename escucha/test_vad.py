"""VAD de RNNoise (el de murmuraba, vía Node) sobre audio que no sale de ninguna máquina de
trabajo: el JFK de `public/sample.wav` como voz y ruido rosa de ffmpeg como ruido. Exige Node:
sin él la regla del ruido no existe y eso debe verse en rojo, no en skip."""
import subprocess
import tempfile
import unittest
from pathlib import Path

import motor
from motor import Fallos

vad = motor.vad
RAIZ = Path(__file__).resolve().parent.parent
VOZ = RAIZ / "public" / "sample.wav"


def ruido_rosa(destino, segundos=2):
    subprocess.run([motor.FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
                    "-i", f"anoisesrc=d={segundos}:c=pink:a=0.9", "-ar", "16000", "-ac", "1", str(destino)],
                   check=True)
    return destino


class TestVad(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        cls.ruido = ruido_rosa(cls.tmp / "rosa.wav")

    def test_node_y_el_script_estan(self):
        self.assertTrue(vad.disponible(), "falta node o vad_rnnoise.mjs: la regla del ruido no puede correr")

    def test_el_ruido_rosa_es_ruido_y_jfk_es_voz(self):
        ruido = vad.medir(self.ruido)
        voz = vad.medir(VOZ)
        self.assertIsNotNone(ruido)
        self.assertIsNotNone(voz)
        self.assertTrue(vad.es_ruido(ruido), ruido)
        self.assertFalse(vad.es_ruido(voz), voz)
        self.assertGreater(voz["voz_ms"], 5000)
        self.assertLess(ruido["voz_ms"], 300)

    def test_wav_inexistente_no_lanza(self):
        self.assertIsNone(vad.medir(self.tmp / "no-existe.wav"))


class TestRuidoEnLosTiers(unittest.TestCase):
    """El ruido se descarta ANTES de pagar el gateway; la voz sigue su camino normal."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        cls.ruido = ruido_rosa(cls.tmp / "rosa.wav")

    def setUp(self):
        self.fallos = Fallos(self.tmp / "f.log")
        self._gw, self._hear, self._activo = motor.stt_gateway, motor.stt_hear, vad.ACTIVO
        self._sospechoso = motor.RMS_SOSPECHOSO
        motor.stt_hear = lambda p, l=None: ("fallo", "", "no existe")
        motor.RMS_SOSPECHOSO = 0
        vad.ACTIVO = True
        self.llamadas = []

        def gateway(p, l=None, engine="whisper", reintentos=1):
            self.llamadas.append(Path(p).name)
            return "Boop! Boop!", ""
        motor.stt_gateway = gateway

    def tearDown(self):
        motor.stt_gateway, motor.stt_hear, vad.ACTIVO = self._gw, self._hear, self._activo
        motor.RMS_SOSPECHOSO = self._sospechoso

    def test_el_ruido_no_llega_al_gateway(self):
        self.assertEqual(motor.transcribir_tiers(self.ruido, self.fallos, language="en-US"), ("ruido", ""))
        self.assertEqual(self.llamadas, [])

    def test_la_voz_si_llega(self):
        estado, _ = motor.transcribir_tiers(VOZ, self.fallos, language="en-US")
        self.assertEqual(estado, "ok")
        self.assertEqual(self.llamadas, [VOZ.name])

    def test_apagado_con_la_variable_pasa_todo(self):
        vad.ACTIVO = False
        estado, _ = motor.transcribir_tiers(self.ruido, self.fallos, language="en-US")
        self.assertEqual(estado, "ok")


if __name__ == "__main__":
    unittest.main()
