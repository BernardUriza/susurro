"""Prueba del corte de emergencia por largo (_partir_en_valle).

Sin micrófono ni bocina: se arman frames PCM sintéticos y se verifica que el
corte cae en el valle de energía y que la cola NO se pierde.
Contexto: el 15-ago-2026 la instrumentación mostró tres utterances de dur=15.0
exactos con el texto partido a media palabra. Este test blinda el arreglo.
"""
import array
import unittest

from motor import MotorCaptura, FRAME_MS, rms_frame


def frame(amplitud):
    """Un frame de 30 ms a 16 kHz con la amplitud pedida."""
    n = 16000 * FRAME_MS // 1000
    return array.array("h", [amplitud] * n).tobytes()


class TestPartirEnValle(unittest.TestCase):
    def test_corta_en_el_valle_y_conserva_la_cola(self):
        # 60 frames fuertes, un valle claro en el 70, y 29 más fuertes.
        frames = [frame(9000)] * 100
        frames[70] = frame(5)
        cabeza, cola = MotorCaptura._partir_en_valle(frames, ventana=40)
        self.assertEqual(len(cabeza), 70, "debe cortar EN el valle")
        self.assertEqual(len(cola), 30, "la cola arranca el siguiente utterance")
        self.assertEqual(len(cabeza) + len(cola), len(frames), "no se pierde audio")

    def test_no_corta_si_el_valle_cae_muy_temprano(self):
        # Valle en el frame 5: cortar ahí dejaría una cabeza inútil.
        frames = [frame(9000)] * 100
        frames[5] = frame(5)
        cabeza, cola = MotorCaptura._partir_en_valle(frames, ventana=99)
        self.assertEqual(cola, [], "no debe partir antes de la mitad")
        self.assertEqual(len(cabeza), 100)

    def test_ventana_mas_grande_que_el_audio_no_rompe(self):
        frames = [frame(9000)] * 10
        cabeza, cola = MotorCaptura._partir_en_valle(frames, ventana=999)
        self.assertEqual((len(cabeza), cola), (10, []))

    def test_el_valle_es_de_verdad_el_mas_silencioso(self):
        frames = [frame(9000)] * 100
        frames[80] = frame(300)
        frames[90] = frame(20)      # éste es el mínimo real
        cabeza, _ = MotorCaptura._partir_en_valle(frames, ventana=40)
        self.assertEqual(len(cabeza), 90)

    def test_rms_frame_distingue_fuerte_de_silencio(self):
        self.assertGreater(rms_frame(frame(9000)), rms_frame(frame(5)))


if __name__ == "__main__":
    unittest.main(verbosity=2)
