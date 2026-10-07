"""Prueba de los cortes de `archivo.py` (sin red ni ffmpeg).

Whisper de Azure acepta ≤25 MB por request, así que un archivo largo se parte.
El corte debe caer en una PAUSA cercana al nominal (no a media palabra) y los
timestamps de cada trozo se re-desplazan por su offset.
"""
import unittest

from archivo import codigo_idioma, puntos_de_corte


class TestPuntosDeCorte(unittest.TestCase):
    def test_archivo_corto_no_se_parte(self):
        self.assertEqual(puntos_de_corte(500, [100, 300], trozo=600), [])

    def test_corta_en_la_pausa_mas_tardia_de_la_ventana(self):
        cortes = puntos_de_corte(1500, [550, 580, 610, 1150], trozo=600, ventana=60)
        self.assertEqual(cortes, [580, 1150])

    def test_sin_pausa_corta_en_el_nominal(self):
        self.assertEqual(puntos_de_corte(1300, [], trozo=600, ventana=60), [600, 1200])

    def test_pausa_fuera_de_ventana_se_ignora(self):
        self.assertEqual(puntos_de_corte(900, [400], trozo=600, ventana=60), [600])

    def test_ningun_trozo_excede_el_tope(self):
        cortes = puntos_de_corte(7200, [i * 37.0 for i in range(200)], trozo=600, ventana=60)
        bordes = [0.0, *cortes, 7200]
        self.assertTrue(all(b - a <= 600 for a, b in zip(bordes, bordes[1:])))


class TestCodigoIdioma(unittest.TestCase):
    def test_nombre_a_iso(self):
        self.assertEqual(codigo_idioma("Spanish"), "es")
        self.assertEqual(codigo_idioma("es"), "es")
        self.assertIsNone(codigo_idioma(None))


if __name__ == "__main__":
    unittest.main()
