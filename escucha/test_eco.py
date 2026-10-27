"""El filtro de eco textual con los cachos reales de la junta del 2026-10-27 (rayo9,
bocinas abiertas): cada copia del mic repite un LLAMADA con otros errores de STT."""
import unittest

from eco import FiltroEco, parecidos, normalizar


class TestParecidos(unittest.TestCase):
    def test_cachos_reales_son_eco(self):
        pares = [
            ("four processes to five, you know, it's like we're now we're going to be talking about like 25 30 processes whatever 40",
             "Four processes to five, you know, it's like we're now we're gonna be talking about like 25 30 processes Whatever 40, you know at some point"),
            ("I'm pretty sure this is possible and it could again, I think this allows, you know, you guys don't have to worry",
             "I'm pretty sure that this is this is possible and it could again I think this allows us to scale because then you guys don't have to worry"),
            ("It's a challenge you're going to have all the way.",
             "And you're going to have all the vendors."),
            ("Just, I will take one more thing, whatever this architecture is going to be, the challenge that you're having here with us.",
             "law. Judge, I will say one more thing, whatever this architecture is going to be, the challenge that you're having here with us is the challenge."),
        ]
        for mic, llamada in pares:
            self.assertTrue(parecidos(normalizar(mic), normalizar(llamada)), mic)

    def test_frases_distintas_no_son_eco(self):
        pares = [
            ("Our side needs to validate required fields per process type.",
             "They've already got all the dots. The information is for sale."),
            ("That direction works for us.", "In our system, that's the warm-up criteria."),
        ]
        for mic, llamada in pares:
            self.assertFalse(parecidos(normalizar(mic), normalizar(llamada)), mic)


class TestFiltro(unittest.TestCase):
    def setUp(self):
        self.t = [0.0]
        self.filtro = FiltroEco(espera_s=3.0, reloj=lambda: self.t[0],
                                dormir=lambda s: self.t.__setitem__(0, self.t[0] + s))

    def test_llamada_primero_luego_mic(self):
        self.filtro.registrar_llamada("And you're going to have all the vendors.")
        self.assertIsNotNone(self.filtro.es_eco("It's a challenge you're going to have all the way."))
        self.assertEqual(self.filtro.descartados, 1)

    def test_mic_sin_llamada_espera_y_pasa(self):
        self.assertIsNone(self.filtro.es_eco("Our side needs to validate required fields per process type."))
        self.assertGreaterEqual(self.t[0], 3.0, "esperó el plazo completo antes de dejarlo pasar")

    def test_llamada_vieja_ya_no_cuenta(self):
        self.filtro.registrar_llamada("And you're going to have all the vendors.")
        self.t[0] += 60
        self.assertIsNone(self.filtro.es_eco("It's a challenge you're going to have all the way."))

    def test_textos_cortos_no_se_juzgan(self):
        self.filtro.registrar_llamada("ok")
        self.assertIsNone(self.filtro.es_eco("ok yes"))

    def test_sin_espera_en_mac(self):
        filtro = FiltroEco(espera_s=0.0, reloj=lambda: self.t[0], dormir=lambda s: self.fail("no debe dormir"))
        self.assertIsNone(filtro.es_eco("Our side needs to validate required fields per process type."))


if __name__ == "__main__":
    unittest.main()
