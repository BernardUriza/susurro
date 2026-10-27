"""Careo (dos motores + juez), reintento del gateway y tier local de respaldo, sin red:
los motores son funciones falsas y el gateway se simula parchando urlopen."""
import io
import json
import os
import tempfile
import unittest
import urllib.error
import wave
from pathlib import Path

import careo
import motor
from motor import Fallos

# motor importa sus hermanos como paquete (escucha.stt_local): se parcha ESE objeto, no una segunda copia
stt_local = motor.stt_local


def wav_de_prueba(base, amplitud=1000, ms=800):
    ruta = base / "utt-0001.wav"
    n = 16000 * ms // 1000
    with wave.open(str(ruta), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(bytes([amplitud & 0xFF, (amplitud >> 8) & 0xFF]) * n)
    return ruta


class TestCareo(unittest.TestCase):
    def setUp(self):
        self.base = Path(tempfile.mkdtemp())
        self.fallos = Fallos(self.base / "f.log")
        careo._capacidades.clear()

    def tearDown(self):
        careo._capacidades.clear()

    def test_sin_deepgram_ni_testigo_una_sola_llamada(self):
        llamadas = []

        def stt(p, l=None, engine="whisper"):
            llamadas.append(engine)
            return "hola mundo", ""
        self.assertEqual(careo.transcribir_careo("x", None, self.fallos, stt), ("hola mundo", "", "solo"))
        self.assertEqual(llamadas, ["whisper"])

    def test_acuerdo_devuelve_whisper_y_llama_a_los_dos(self):
        careo._capacidades.update(deepgram=True, claude=False)
        llamadas = []

        def stt(p, l=None, engine="whisper"):
            llamadas.append(engine)
            return ("El motor ya corre en la ThinkPad.", "") if engine == "whisper" else ("el motor ya corre en la thinkpad", "")
        txt, causa, veredicto = careo.transcribir_careo("x", None, self.fallos, stt)
        self.assertEqual((txt, veredicto), ("El motor ya corre en la ThinkPad.", "acuerdo"))
        self.assertEqual(sorted(llamadas), ["deepgram", "whisper"])

    def test_desacuerdo_sin_juez_gana_el_que_no_alucina(self):
        careo._capacidades.update(deepgram=True, claude=False)

        def stt(p, l=None, engine="whisper"):
            return ("¡Suscríbete al canal!", "") if engine == "whisper" else ("necesito el folio de la orden", "")
        txt, _, veredicto = careo.transcribir_careo("x", None, self.fallos, stt)
        self.assertEqual((txt, veredicto), ("necesito el folio de la orden", "desacuerdo"))

    def test_desacuerdo_con_juez_usa_refine(self):
        careo._capacidades.update(deepgram=True, claude=True)
        original = careo.refinar
        careo.refinar = lambda candidatos, key, timeout=30: ("Necesito el folio de la orden.", "")
        try:
            def stt(p, l=None, engine="whisper"):
                return ("necesito el polio de la horda ya", "") if engine == "whisper" else ("dame el folio de la orden", "")
            txt, _, veredicto = careo.transcribir_careo("x", None, self.fallos, stt, key="k")
        finally:
            careo.refinar = original
        self.assertEqual((txt, veredicto), ("Necesito el folio de la orden.", "juez"))

    def test_testigo_local_sustituye_a_deepgram_cuando_no_hay_llave(self):
        llamadas = []

        def stt(p, l=None, engine="whisper"):
            llamadas.append(engine)
            return "va a estar una artista famosa", ""

        def local(p, l=None):
            llamadas.append("local")
            return "va a estar una artista famosa", ""
        txt, _, veredicto = careo.transcribir_careo("x", None, self.fallos, stt, segundo=local)
        self.assertEqual(veredicto, "acuerdo")
        self.assertEqual(sorted(llamadas), ["local", "whisper"])

    def test_un_solo_motor_contesta(self):
        careo._capacidades.update(deepgram=True, claude=False)

        def stt(p, l=None, engine="whisper"):
            return ("", "gateway deepgram: HTTP 500") if engine == "deepgram" else ("sigue el folio", "")
        txt, causa, veredicto = careo.transcribir_careo("x", None, self.fallos, stt)
        self.assertEqual((txt, causa, veredicto), ("sigue el folio", "", "uno"))
        self.assertEqual(self.fallos.por_origen.get("stt-deepgram"), 1)


class TestReintentoGateway(unittest.TestCase):
    def setUp(self):
        self.base = Path(tempfile.mkdtemp())
        self.wav = wav_de_prueba(self.base)
        self._urlopen, self._sleep, self._key = motor.urllib.request.urlopen, motor.time.sleep, motor.susurro_key
        motor.susurro_key = lambda: "k"
        self.esperas = []
        motor.time.sleep = self.esperas.append

    def tearDown(self):
        motor.urllib.request.urlopen, motor.time.sleep, motor.susurro_key = self._urlopen, self._sleep, self._key

    def _respuestas(self, *secuencia):
        cola = list(secuencia)

        def urlopen(req, timeout=None):
            r = cola.pop(0)
            if isinstance(r, Exception):
                raise r
            return io.BytesIO(json.dumps({"transcript": r}).encode())
        motor.urllib.request.urlopen = urlopen
        return cola

    def test_429_espera_retry_after_y_reintenta(self):
        e = urllib.error.HTTPError("u", 429, "Too Many", {"Retry-After": "7"}, None)
        self._respuestas(e, "ya salió")
        self.assertEqual(motor.stt_gateway(self.wav), ("ya salió", ""))
        self.assertEqual(self.esperas, [7.0])

    def test_5xx_reintenta_una_vez_y_luego_reporta(self):
        e = urllib.error.HTTPError("u", 502, "Bad Gateway", {}, None)
        self._respuestas(e, e)
        txt, causa = motor.stt_gateway(self.wav)
        self.assertEqual(txt, "")
        self.assertIn("HTTP 502", causa)
        self.assertEqual(len(self.esperas), 1)

    def test_4xx_no_reintenta(self):
        e = urllib.error.HTTPError("u", 401, "Unauthorized", {}, None)
        cola = self._respuestas(e, "NO DEBE LLEGAR")
        self.assertEqual(motor.stt_gateway(self.wav)[0], "")
        self.assertEqual(self.esperas, [])
        self.assertEqual(cola, ["NO DEBE LLEGAR"])

    def test_engine_deepgram_va_en_la_url(self):
        visto = {}

        def urlopen(req, timeout=None):
            visto["url"] = req.full_url
            return io.BytesIO(b'{"transcript": "x"}')
        motor.urllib.request.urlopen = urlopen
        motor.stt_gateway(self.wav, engine="deepgram")
        self.assertIn("engine=deepgram", visto["url"])


class TestLlaveDelGateway(unittest.TestCase):
    """Una sola llave por máquina, en cualquiera de los dos archivos y con cualquiera de los dos nombres."""

    def setUp(self):
        self.base = Path(tempfile.mkdtemp())
        self._k, self._t, self._d = motor.KEY_SUSURRO, motor.TOKEN_SUSURRO, motor.DIR_SECRETS
        self._env = os.environ.pop("SUSURRO_KEY", None)
        motor.DIR_SECRETS = self.base
        motor.KEY_SUSURRO, motor.TOKEN_SUSURRO = self.base / "key.txt", self.base / "token.txt"

    def tearDown(self):
        motor.KEY_SUSURRO, motor.TOKEN_SUSURRO, motor.DIR_SECRETS = self._k, self._t, self._d
        if self._env is not None:
            os.environ["SUSURRO_KEY"] = self._env

    def test_lee_susurro_token_del_archivo_del_claim(self):
        motor.TOKEN_SUSURRO.write_text("Created: hoy\nSUSURRO_TOKEN=sk-susurro-abc\n", encoding="utf-8")
        self.assertEqual(motor.susurro_key(), "sk-susurro-abc")

    def test_el_archivo_key_gana_y_el_entorno_gana_a_todo(self):
        motor.KEY_SUSURRO.write_text("SUSURRO_KEY=sk-susurro-key\n", encoding="utf-8")
        motor.TOKEN_SUSURRO.write_text("SUSURRO_TOKEN=sk-susurro-tok\n", encoding="utf-8")
        self.assertEqual(motor.susurro_key(), "sk-susurro-key")
        os.environ["SUSURRO_KEY"] = "sk-susurro-env"
        self.assertEqual(motor.susurro_key(), "sk-susurro-env")

    def test_lee_el_archivo_por_app_que_escribe_susurro_token_file(self):
        (self.base / "susurro-key-thinkpad-escucha.txt").write_text(
            "App identifier: thinkpad-escucha\nSUSURRO_TOKEN=sk-susurro-app\n", encoding="utf-8")
        self.assertEqual(motor.susurro_key(), "sk-susurro-app")
        self.assertEqual(motor.archivos_key()[-1].name, "susurro-key-thinkpad-escucha.txt")

    def test_sin_nada_devuelve_vacio(self):
        self.assertEqual(motor.susurro_key(), "")


class TestTierLocalDeRespaldo(unittest.TestCase):
    """El gateway falla → el tier local responde; el gateway alucina → el local opina
    sólo si ya está cargado. Ambos simulados: aquí no se carga ningún modelo."""

    def setUp(self):
        self.base = Path(tempfile.mkdtemp())
        self.wav = wav_de_prueba(self.base)
        self.fallos = Fallos(self.base / "f.log")
        self._vad, motor.vad.ACTIVO = motor.vad.ACTIVO, False
        self._gw, self._hear = motor.stt_gateway, motor.stt_hear
        self._local, self._listo = stt_local.stt_local, stt_local.listo
        motor.stt_hear = lambda p, l=None: ("fallo", "", "no existe")
        careo._capacidades.clear()

    def tearDown(self):
        motor.vad.ACTIVO = self._vad
        motor.stt_gateway, motor.stt_hear = self._gw, self._hear
        stt_local.stt_local, stt_local.listo = self._local, self._listo

    def test_gateway_caido_responde_el_local(self):
        motor.stt_gateway = lambda p, l=None, engine="whisper", reintentos=1: ("", "gateway whisper: HTTP 502")
        stt_local.listo = lambda: False
        stt_local.stt_local = lambda p, l=None: ("necesito el folio", "")
        self.assertEqual(motor.transcribir_tiers(self.wav, self.fallos), ("ok", "necesito el folio"))
        self.assertEqual(self.fallos.por_origen.get("stt-gateway"), 1)

    def test_gateway_alucina_y_el_local_cargado_corrige(self):
        motor.stt_gateway = lambda p, l=None, engine="whisper", reintentos=1: ("¡Gracias!", "")
        stt_local.listo = lambda: True
        stt_local.stt_local = lambda p, l=None: ("sí, mándame el folio", "")
        self.assertEqual(motor.transcribir_tiers(self.wav, self.fallos), ("ok", "sí, mándame el folio"))

    def test_frase_debil_confirmada_por_el_local_mudo_es_alucinacion(self):
        motor.stt_gateway = lambda p, l=None, engine="whisper", reintentos=1: ("¡Gracias!", "")
        stt_local.listo = lambda: True
        stt_local.stt_local = lambda p, l=None: ("", "")
        self.assertEqual(motor.transcribir_tiers(self.wav, self.fallos), ("alucinacion", "¡Gracias!"))

    def test_frase_debil_sin_testigo_pasa_como_antes(self):
        motor.stt_gateway = lambda p, l=None, engine="whisper", reintentos=1: ("¡Gracias!", "")
        stt_local.listo = lambda: False
        stt_local.stt_local = lambda p, l=None: self.fail("no debe cargar el modelo en la ruta caliente")
        self.assertEqual(motor.transcribir_tiers(self.wav, self.fallos), ("ok", "¡Gracias!"))

    def test_gateway_alucina_y_sin_local_cargado_sigue_siendo_alucinacion(self):
        motor.stt_gateway = lambda p, l=None, engine="whisper", reintentos=1: ("Gracias por ver el video", "")
        stt_local.listo = lambda: False
        stt_local.stt_local = lambda p, l=None: self.fail("no debe cargar el modelo en la ruta caliente")
        self.assertEqual(motor.transcribir_tiers(self.wav, self.fallos), ("alucinacion", "Gracias por ver el video"))


class TestHallazgosDelCritico(unittest.TestCase):
    """2026-10-27 /cruel-critic: el gateway caído tras el testigo local quedaba mudo; «Gracias»
    confirmado por los dos motores se descartaba; las correcciones es-MX mordían el inglés."""

    def setUp(self):
        self.base = Path(tempfile.mkdtemp())
        self.wav = wav_de_prueba(self.base)
        self.fallos = Fallos(self.base / "f.log")
        self._vad, motor.vad.ACTIVO = motor.vad.ACTIVO, False
        self._gw, self._hear, self._idioma = motor.stt_gateway, motor.stt_hear, motor.IDIOMA
        self._local, self._listo = stt_local.stt_local, stt_local.listo
        motor.stt_hear = lambda p, l=None: ("fallo", "", "no existe")
        careo._capacidades.clear()

    def tearDown(self):
        motor.vad.ACTIVO = self._vad
        motor.stt_gateway, motor.stt_hear, motor.IDIOMA = self._gw, self._hear, self._idioma
        stt_local.stt_local, stt_local.listo = self._local, self._listo

    def test_gateway_caido_tras_el_testigo_local_queda_en_fallos(self):
        motor.stt_gateway = lambda p, l=None, engine="whisper", reintentos=1: ("", "gateway whisper: HTTP 502")
        stt_local.listo = lambda: True
        stt_local.stt_local = lambda p, l=None: ("necesito el folio", "")
        self.assertEqual(motor.transcribir_tiers(self.wav, self.fallos), ("ok", "necesito el folio"))
        self.assertEqual(self.fallos.por_origen.get("stt-gateway"), 1)
        self.assertIn("HTTP 502", (self.base / "f.log").read_text(encoding="utf-8"))

    def test_frase_debil_que_el_local_tambien_oyo_es_habla(self):
        motor.stt_gateway = lambda p, l=None, engine="whisper", reintentos=1: ("¡Gracias!", "")
        stt_local.listo = lambda: True
        stt_local.stt_local = lambda p, l=None: ("Gracias", "")
        self.assertEqual(motor.transcribir_tiers(self.wav, self.fallos), ("ok", "¡Gracias!"))
        stt_local.stt_local = lambda p, l=None: ("Thank you.", "")
        self.assertEqual(motor.transcribir_tiers(self.wav, self.fallos), ("ok", "¡Gracias!"))

    def test_corpus_duro_pierde_el_careo_contra_el_testigo_que_oyo_algo(self):
        motor.stt_gateway = lambda p, l=None, engine="whisper", reintentos=1: ("Gracias por ver el video", "")
        stt_local.listo = lambda: True
        stt_local.stt_local = lambda p, l=None: ("gracias", "")
        self.assertEqual(motor.transcribir_tiers(self.wav, self.fallos), ("ok", "gracias"))

    def test_corpus_duro_con_el_local_mudo_sigue_siendo_alucinacion(self):
        motor.stt_gateway = lambda p, l=None, engine="whisper", reintentos=1: ("Gracias por ver el video", "")
        stt_local.listo = lambda: True
        stt_local.stt_local = lambda p, l=None: ("", "")
        self.assertEqual(motor.transcribir_tiers(self.wav, self.fallos), ("alucinacion", "Gracias por ver el video"))

    def test_correcciones_solo_cuando_la_sesion_es_en_espanol(self):
        stt_local.listo = lambda: False
        ingles = "External vendors will not be allowed on the server until the fix ships."
        motor.stt_gateway = lambda p, l=None, engine="whisper", reintentos=1: (ingles, "")
        motor.IDIOMA = "en-US"
        self.assertEqual(motor.transcribir_tiers(self.wav, self.fallos), ("ok", ingles))
        self.assertEqual(motor.transcribir_tiers(self.wav, self.fallos, language="en-US"), ("ok", ingles))
        motor.stt_gateway = lambda p, l=None, engine="whisper", reintentos=1: ("hay que rezarla otra vez", "")
        motor.IDIOMA = "es-MX"
        self.assertEqual(motor.transcribir_tiers(self.wav, self.fallos), ("ok", "hay que relanzarla otra vez"))


if __name__ == "__main__":
    unittest.main()
