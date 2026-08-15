#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# TESTS DE LÉXICO — casos REALES, no sintéticos.
#
# Cada caso de este archivo salió de una de dos fuentes:
#   · el corpus observado el 2026-08-15 (10 videos de bafle + errores de palabra
#     de las sesiones de dictado), o
#   · las listas verificadas en las fuentes F1–F4 citadas en lexico.py.
#
# La mitad más importante NO es la que atrapa basura: es la que PROTEGE el habla
# legítima. Un falso positivo borra lo que Bernard dijo; ésos son los tests que
# no pueden ponerse rojos nunca.
#
#   python3 -m unittest escucha.test_lexico -v
#   python3 escucha/test_lexico.py
# ─────────────────────────────────────────────────────────────────────────────
import sys
import unittest
from pathlib import Path

try:
    from escucha.lexico import (LEXICO_DOMINIO, corregir, es_alucinacion,
                                es_bucle_repetido, formatear_cambios,
                                normalizar, prompt_dominio)
except ModuleNotFoundError:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from escucha.lexico import (LEXICO_DOMINIO, corregir, es_alucinacion,
                                es_bucle_repetido, formatear_cambios,
                                normalizar, prompt_dominio)


class TestNormalizar(unittest.TestCase):
    def test_quita_acentos_puntuacion_y_caja(self):
        self.assertEqual(normalizar("¡Suscríbete al canal!"), "suscribete al canal")
        self.assertEqual(normalizar("  ¿Gracias  por  ver?  "), "gracias por ver")
        self.assertEqual(normalizar("Améry, Cioran."), "amery cioran")

    def test_conserva_la_ene(self):
        """La ñ NO es una n con acento: «año» ≠ «ano»."""
        self.assertEqual(normalizar("Sinfín año"), "sinfin año")

    def test_vacio_no_truena(self):
        self.assertEqual(normalizar(""), "")
        self.assertEqual(normalizar(None), "")


class TestAlucinacionesObservadasHoy(unittest.TestCase):
    """Lo que salió sobre los 10 videos de puro bafle (2026-08-15)."""

    OBSERVADAS = [
        "¡Suscríbete al canal!",
        "Suscríbete al canal",
        "suscribete al canal",
        "Gracias por ver el video",
        "¡Gracias por ver el vídeo!",
        "Gracias por ver el video, suscríbete al canal",
    ]

    def test_todas_las_observadas_se_marcan(self):
        for t in self.OBSERVADAS:
            with self.subTest(t=t):
                self.assertTrue(es_alucinacion(t), f"NO atrapada: {t!r}")

    def test_regresion_lo_que_la_version_vieja_dejaba_pasar(self):
        """Regresión medida contra la tupla real que vivía en motor.py.

        Honestidad primero: esa tupla SÍ atrapaba «Suscríbete al canal» y
        «Gracias por ver el video» (por los substrings 'suscribete' y 'gracias
        por ver'). Lo que se le escapaba entero es la lista de abajo — cada una
        verificada en las fuentes F1–F4 — y ése es el hueco que este módulo
        cierra. El test falla si alguna vuelve a colarse.
        """
        vieja = ("amara.org", "subtítulos", "subtitulos", "gracias por ver",
                 "suscríbete", "suscribete", "♪")
        escapaban = [
            "No olvides suscribirte",                    # 'suscribirte' ≠ 'suscribete'
            "No olviden suscribirse",
            "Thank you for watching",
            "Thanks for watching!",
            "Please subscribe",
            "See you in the next video",
            " www.mooji.org",
            "[Música]",
            "(Applause)",
            "Transcribed by https://otter.ai",
            "Más información www.alimmenta.com",
            "the next day the next day the next day the next day",
        ]
        for t in escapaban:
            with self.subTest(t=t):
                bajo = t.lower().strip()
                self.assertFalse(
                    any(a in bajo for a in vieja),
                    f"{t!r} ya lo atrapaba la versión vieja; no prueba nada")
                self.assertTrue(es_alucinacion(t), f"sigue escapando: {t!r}")


class TestAlucinacionesVerificadas(unittest.TestCase):
    """Corpus de las fuentes F1–F4 (ver lexico.py)."""

    def test_familia_amara_en_todos_los_idiomas(self):
        for t in [
            "Subtítulos realizados por la comunidad de Amara.org",   # [F1][F4] es
            "Subtitulado por la comunidad de Amara.org",             # [F4] es
            "Sous-titres réalisés par la communauté d'Amara.org",    # [F1][F4] fr
            "Untertitelung aufgrund der Amara.org-Community",        # [F1][F4] de
            "Ondertitels ingediend door de Amara.org gemeenschap",   # [F1][F4] nl
            "Legendas pela comunidade Amara.org",                    # [F1][F4] pt
            "Sottotitoli creati dalla comunità Amara.org",           # [F4] it
            "Subtitles by the Amara.org community",                  # [F3] en
        ]:
            with self.subTest(t=t):
                self.assertTrue(es_alucinacion(t))

    def test_outro_youtube_espanol(self):
        for t in [
            "no olvides suscribirte",                    # [F3]
            "No olviden suscribirse",                    # [F3]
            "Dale like y suscríbete",                    # [F3]
            "críbete al canal",                          # [F3] recorte de Whisper
            "Suscríbete a mi canal",                     # [F3]
            "Muchas gracias por ver",                    # [F3]
        ]:
            with self.subTest(t=t):
                self.assertTrue(es_alucinacion(t))

    def test_outro_youtube_ingles(self):
        for t in [
            "Thank you for watching",                    # [F1][F3]
            "Thanks for watching!",                      # [F1][F3]
            "Please subscribe",                          # [F3]
            "Subscribe to my channel",                   # [F3]
            "See you in the next video",                 # [F3]
            "Don't forget to subscribe",                 # [F3]
            "Transcribed by https://otter.ai",           # [F1]
        ]:
            with self.subTest(t=t):
                self.assertTrue(es_alucinacion(t))

    def test_dominios_sobre_silencio(self):
        self.assertTrue(es_alucinacion(" www.mooji.org"))       # [F1][F4]
        self.assertTrue(es_alucinacion("Más información www.alimmenta.com"))  # [F4]

    def test_marcadores_de_musica_y_etiquetas(self):
        for t in ["♪♪♪", "♪ música ♪", "[Music]", "[Música]", "(Applause)",
                  "[Aplausos]", "[BLANK_AUDIO]"]:
            with self.subTest(t=t):
                self.assertTrue(es_alucinacion(t))

    def test_texto_muy_corto(self):
        self.assertTrue(es_alucinacion(""))
        self.assertTrue(es_alucinacion("a"))
        self.assertTrue(es_alucinacion("  .  "))


class TestBucleRepetido(unittest.TestCase):
    def test_el_bucle_observado_hoy(self):
        t = "the next day the next day the next day the next day the next day"
        self.assertTrue(es_bucle_repetido(t))
        self.assertTrue(es_alucinacion(t))

    def test_bucle_de_una_palabra(self):
        self.assertTrue(es_bucle_repetido("gracias gracias gracias gracias "
                                          "gracias gracias gracias gracias"))

    def test_enfasis_real_no_es_bucle(self):
        """«sí sí sí sí» y «no, no, no» son habla real y NO deben morir."""
        self.assertFalse(es_bucle_repetido("sí sí sí sí"))
        self.assertFalse(es_bucle_repetido("no, no, no"))
        self.assertFalse(es_alucinacion("sí sí sí sí"))

    def test_frase_normal_larga_no_es_bucle(self):
        t = ("entonces le metí el fix al motor y lo relancé para ver si el "
             "segmentador seguía cortando a media frase")
        self.assertFalse(es_bucle_repetido(t))
        self.assertFalse(es_alucinacion(t))


class TestNoMatarHablaLegitima(unittest.TestCase):
    """LOS TESTS QUE MÁS IMPORTAN. Un falso positivo BORRA a Bernard."""

    LEGITIMAS = [
        "hay un bug en el motor de escucha",
        "vamos a relanzarla otra vez",
        "cuando clonas el repo se te baja todo",
        "el vape que compré en Sinfín traía THC",
        "le mandé un mensaje a Miguel Santander por WhatsApp",
        "me subí al bus para ir a Zapopan",
        "Cioran y Améry escriben del mismo hueco",
        "necesito que hagas el commit y el push al repo",
        "gracias por el archivo que me pasaste",
        "el AirTag lo dejé en la bolsa",
        "esto se ve como un show de drag en Guadalajara",
        "quiero ver el video que grabamos ayer",
        "le puse coronas de flores al altar",
    ]

    def test_ninguna_frase_real_se_marca_como_alucinacion(self):
        for t in self.LEGITIMAS:
            with self.subTest(t=t):
                self.assertFalse(es_alucinacion(t), f"FALSO POSITIVO: {t!r}")

    def test_gracias_suelto_sobrevive_en_modo_default(self):
        """«Gracias.» está en el corpus [F3], pero también es una frase que
        Bernard dice de verdad. Por default vive; sólo muere en estricto."""
        self.assertFalse(es_alucinacion("Gracias."))
        self.assertTrue(es_alucinacion("Gracias.", estricto=True))

    def test_tier_debil_solo_en_estricto(self):
        for t in ["you", "bye", "Jackie", "thank you"]:
            with self.subTest(t=t):
                self.assertFalse(es_alucinacion(t, estricto=False))
                self.assertTrue(es_alucinacion(t, estricto=True))


class TestCorreccionesSeguras(unittest.TestCase):
    """Las que corren siempre, sin compuerta de contexto."""

    def test_rezarla(self):
        t, c = corregir("hay que rezarla desde cero")
        self.assertEqual(t, "hay que relanzarla desde cero")
        self.assertEqual(formatear_cambios(c), ["rezarla → relanzarla"])

    def test_mbappe_a_el_vape(self):
        t, c = corregir("Mbappé que me vendieron estaba malo")
        self.assertEqual(t, "El vape que me vendieron estaba malo")
        self.assertEqual(len(c), 1)

    def test_mbappe_no_duplica_el_articulo(self):
        t, _ = corregir("compré el Mbappé en Sinfín")
        self.assertEqual(t, "compré el vape en Sinfín")
        self.assertNotIn("el el", t)

    def test_mhc_a_thc(self):
        t, c = corregir("traía MHC el cartucho")
        self.assertEqual(t, "traía THC el cartucho")
        self.assertEqual(formatear_cambios(c), ["MHC → THC"])

    def test_mhc_minusculas_NO_se_toca(self):
        """Sensible a caja a propósito: sólo la sigla en mayúsculas."""
        t, c = corregir("dijo mhc no sé qué")
        self.assertEqual(t, "dijo mhc no sé qué")
        self.assertEqual(c, [])

    def test_be_allowed_a_visalaw(self):
        t, c = corregir("le escribí a be allowed por lo de la visa")
        self.assertEqual(t, "le escribí a Visalaw por lo de la visa")
        self.assertEqual(len(c), 1)


class TestCorreccionesContextuales(unittest.TestCase):
    """Las peligrosas: sólo corren si el utterance ya habla del dominio."""

    def test_bus_se_corrige_CON_contexto_dev(self):
        t, c = corregir("encontré un bus en el commit de ayer")
        self.assertEqual(t, "encontré un bug en el commit de ayer")
        self.assertEqual(formatear_cambios(c), ["bus → bug"])

    def test_bus_NO_se_corrige_sin_contexto(self):
        t, c = corregir("me subí al bus en la esquina")
        self.assertEqual(t, "me subí al bus en la esquina")
        self.assertEqual(c, [])

    def test_coronas_se_corrige_CON_contexto_dev(self):
        t, c = corregir("cuando coronas el repo se baja todo")
        self.assertEqual(t, "cuando clonas el repo se baja todo")
        self.assertEqual(formatear_cambios(c), ["coronas → clonas"])

    def test_coronas_NO_se_corrige_sin_contexto(self):
        t, c = corregir("le llevaron coronas de flores")
        self.assertEqual(t, "le llevaron coronas de flores")
        self.assertEqual(c, [])

    def test_modo_agresivo_ignora_la_compuerta(self):
        t, c = corregir("me subí al bus", modo="agresivo")
        self.assertEqual(t, "me subí al bug")
        self.assertEqual(len(c), 1)

    def test_modo_ninguno_no_toca_nada(self):
        t, c = corregir("hay un bus en el commit", modo="ninguno")
        self.assertEqual(t, "hay un bus en el commit")
        self.assertEqual(c, [])


class TestContratoDeAuditoria(unittest.TestCase):
    def test_devuelve_siempre_una_tupla_de_dos(self):
        for entrada in ["", "hola", "hay un bus en el repo", None]:
            with self.subTest(entrada=entrada):
                r = corregir(entrada or "")
                self.assertIsInstance(r, tuple)
                self.assertEqual(len(r), 2)
                self.assertIsInstance(r[1], list)

    def test_sin_cambios_lista_vacia(self):
        t, c = corregir("una frase completamente normal")
        self.assertEqual(t, "una frase completamente normal")
        self.assertEqual(c, [])

    def test_el_cambio_carga_su_porque(self):
        """El motivo viaja CON el cambio: nada se corrige sin justificación
        legible."""
        _, c = corregir("traía MHC")
        self.assertEqual(len(c), 1)
        self.assertIn("inmunología", c[0].regla.porque)
        self.assertEqual(c[0].regla.riesgo, "segura")

    def test_varios_cambios_en_un_utterance(self):
        t, c = corregir("el Mbappé traía MHC y hay un bus en el commit")
        self.assertIn("el vape", t)
        self.assertIn("THC", t)
        self.assertIn("bug", t)
        self.assertEqual(len(c), 3)


class TestLexicoDominio(unittest.TestCase):
    def test_trae_los_terminos_del_dominio(self):
        for termino in ["AirTag", "Sinfín", "Muha Meds", "THC", "Cioran",
                        "Guadalajara", "half-duplex", "Améry"]:
            with self.subTest(termino=termino):
                self.assertIn(termino, LEXICO_DOMINIO)

    def test_prompt_es_una_sola_linea_terminada_en_punto(self):
        p = prompt_dominio()
        self.assertTrue(p.endswith("."))
        self.assertNotIn("\n", p)
        self.assertIn("Sinfín", p)

    def test_prompt_acepta_extras(self):
        self.assertIn("Bradescard", prompt_dominio(extra=("Bradescard",)))


class TestIntegracionConMotor(unittest.TestCase):
    """El cableado real: motor.py debe estar usando ESTE módulo, no una copia."""

    def test_motor_importa_del_lexico(self):
        from escucha import lexico, motor
        self.assertIs(motor.es_alucinacion, lexico.es_alucinacion)
        self.assertIs(motor.corregir, lexico.corregir)
        self.assertIs(motor.ALUCINACIONES, lexico.ALUCINACIONES)

    def test_motor_ya_no_define_su_propia_lista(self):
        """Migración terminada: la tupla vieja de 7 substrings está BORRADA,
        no escondida detrás de un shim."""
        fuente = (Path(__file__).resolve().parent / "motor.py").read_text()
        self.assertNotIn('ALUCINACIONES = (', fuente)
        self.assertNotIn('def es_alucinacion', fuente)


class TestFlujoDeTiers(unittest.TestCase):
    """El contrato NUEVO de transcribir_tiers: una alucinación del tier local
    ya no se acepta, se BAJA al siguiente tier. Los tiers se sustituyen para
    aislar la lógica del audio real (el wav de ruido sí es real, para que el
    guard de RMS no corte antes de tiempo)."""

    @classmethod
    def setUpClass(cls):
        import subprocess
        import tempfile
        from escucha import motor
        cls.motor = motor
        cls.tmp = Path(tempfile.mkdtemp())
        cls.wav = cls.tmp / "ruido.wav"
        r = subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi",
             "-i", "anoisesrc=d=2:c=pink:a=0.9", "-ar", "16000", "-ac", "1", str(cls.wav)],
            capture_output=True)
        if r.returncode != 0 or not cls.wav.exists():
            raise unittest.SkipTest("ffmpeg no disponible")
        cls._hear, cls._gw = motor.stt_hear, motor.stt_gateway

    @classmethod
    def tearDownClass(cls):
        cls.motor.stt_hear, cls.motor.stt_gateway = cls._hear, cls._gw

    def _fallos(self, nombre):
        log = self.tmp / f"{nombre}.log"
        log.write_text("")
        return self.motor.Fallos(log), log

    def test_alucinacion_del_local_baja_al_gateway(self):
        self.motor.stt_hear = lambda p, l=None: ("ok", "¡Suscríbete al canal!", "")
        self.motor.stt_gateway = lambda p, l=None: ("hay un bus en el commit y traía MHC", "")
        f, log = self._fallos("baja")
        estado, txt = self.motor.transcribir_tiers(self.wav, f)
        self.assertEqual(estado, "ok")
        self.assertEqual(txt, "hay un bug en el commit y traía THC")
        self.assertEqual(f.por_origen.get("alucinacion-hear"), 1)
        contenido = log.read_text()
        self.assertIn("'bus' → 'bug'", contenido)
        self.assertIn("'MHC' → 'THC'", contenido)

    def test_si_los_dos_tiers_alucinan_devuelve_alucinacion(self):
        self.motor.stt_hear = lambda p, l=None: ("ok", "¡Suscríbete al canal!", "")
        self.motor.stt_gateway = lambda p, l=None: ("Gracias por ver el video", "")
        f, _ = self._fallos("ambos")
        self.assertEqual(self.motor.transcribir_tiers(self.wav, f),
                         ("alucinacion", "Gracias por ver el video"))

    def test_texto_limpio_pasa_intacto_y_sin_ruido_en_el_log(self):
        limpio = "el segmentador cortaba a media frase y ya quedó"
        self.motor.stt_hear = lambda p, l=None: ("ok", limpio, "")
        self.motor.stt_gateway = lambda p, l=None: ("NO DEBE LLAMARSE", "")
        f, log = self._fallos("limpio")
        self.assertEqual(self.motor.transcribir_tiers(self.wav, f), ("ok", limpio))
        self.assertEqual(f.total, 0)
        self.assertEqual(log.read_text(), "")

    def test_una_correccion_no_cuenta_como_fallo(self):
        """El contador de Fallos mide fallos; una corrección del léxico se
        registra en el .log pero NO infla ese número."""
        self.motor.stt_hear = lambda p, l=None: ("ok", "traía MHC el cartucho", "")
        f, log = self._fallos("contador")
        self.assertEqual(self.motor.transcribir_tiers(self.wav, f),
                         ("ok", "traía THC el cartucho"))
        self.assertEqual(f.total, 0)
        self.assertIn("lexico:", log.read_text())


if __name__ == "__main__":
    unittest.main(verbosity=2)
