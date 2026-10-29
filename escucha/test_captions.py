"""Captions de Teams como fuente LLAMADA preferida y los avisos de fuera del motor.
Contexto: 2026-10-29, llamada con Brian: el loopback+Whisper tardaba 9.6 s de mediana por frase y
oía mal; los captions del DOM de Teams traen hablante y texto en ~1 s. Sin Chrome ni Teams aquí:
se prueba el parseo, la ventana de actividad que apaga la bocina, y el canal de avisos."""
import json
import tempfile
import time
import unittest
from pathlib import Path

import avisos
import captions


class TestParseo(unittest.TestCase):
    def test_linea_del_mjs_se_vuelve_frase(self):
        fr = captions.parsear('{"ts":"2026-10-29T20:00:01.000Z","speaker":"Brian Stobbe","text":" Go to vApps again. ","rev":0,"id":"c3","t_estable_ms":910,"fuente":"cc"}')
        self.assertEqual(fr["speaker"], "Brian Stobbe")
        self.assertEqual(fr["text"], "Go to vApps again.")
        self.assertEqual(fr["t_estable_ms"], 910)
        self.assertFalse(fr["parcial"])

    def test_logs_y_basura_no_son_frases(self):
        self.assertIsNone(captions.parsear("[captions 20:00:00] vigilando page https://teams"))
        self.assertIsNone(captions.parsear("{no es json"))
        self.assertIsNone(captions.parsear('{"ts":"x","speaker":"B","text":""}'))


class TestVentana(unittest.TestCase):
    def test_sin_captions_la_bocina_manda_y_con_captions_calla(self):
        f = captions.FuenteCaptions(None, tempfile.mkdtemp(), lambda fr: None)
        self.assertFalse(f.activo(), "sin una sola frase, el loopback sigue siendo LLAMADA")
        f.marcar({"speaker": "Brian", "text": "hi", "fuente": "cc"})
        self.assertTrue(f.activo())
        self.assertEqual(f.n, 1)
        f.ultima = time.monotonic() - 100
        self.assertFalse(f.activo(ventana_s=20), "20 s sin captions = la bocina vuelve a mandar")

    def test_un_parcial_no_cuenta_como_frase(self):
        f = captions.FuenteCaptions(None, tempfile.mkdtemp(), lambda fr: None)
        f.marcar({"speaker": "Brian", "text": "hi", "parcial": True})
        self.assertEqual(f.n, 0)
        self.assertTrue(f.activo())


class TestAvisos(unittest.TestCase):
    def test_el_lector_arranca_al_final_y_solo_ve_lo_nuevo(self):
        ruta = Path(tempfile.mkdtemp()) / "avisos.jsonl"
        avisos.escribir("viejo", ["old"], ruta=ruta)
        lector = avisos.Avisos(ruta)
        self.assertEqual(lector.nuevos(), [])
        avisos.escribir("compactando", ["Give me a second.", "One moment."], 25, ruta=ruta, trigger="auto")
        nuevos = lector.nuevos()
        self.assertEqual(len(nuevos), 1)
        self.assertEqual(nuevos[0]["situacion"], "compactando")
        self.assertEqual(nuevos[0]["trigger"], "auto")
        self.assertEqual(lector.nuevos(), [], "no se repite")

    def test_linea_a_medio_escribir_espera_la_siguiente_vuelta(self):
        ruta = Path(tempfile.mkdtemp()) / "avisos.jsonl"
        lector = avisos.Avisos(ruta)
        ruta.write_text('{"situacion":"a","frases":[]}\n{"situacion":"b"', encoding="utf-8")
        self.assertEqual([a["situacion"] for a in lector.nuevos()], ["a"])
        with ruta.open("a", encoding="utf-8") as f:
            f.write(',"frases":["x"]}\n')
        self.assertEqual([a["situacion"] for a in lector.nuevos()], ["b"])

    def test_formato_lleva_la_alerta_que_greppea_el_monitor(self):
        lineas = avisos.formatear({"situacion": "compactando", "segundos": 25, "frases": ["Give me a second."]})
        self.assertTrue(lineas[0].startswith("⚠ AVISO compactando"))
        self.assertIn("~25 s", lineas[0])
        self.assertIn("🔊 SUGIERO DIGAS ESTO:", lineas)
        self.assertEqual(lineas[-1], "   · Give me a second.")


class TestBancoDeFrases(unittest.TestCase):
    def test_cada_situacion_del_md_tiene_frases_y_la_desconocida_cae_a_general(self):
        import aviso_compact
        b = aviso_compact.banco()
        for s in ("compactando", "buscando-en-codigo", "esperando-build", "no-entendi", "tarea-larga", "general"):
            self.assertGreaterEqual(len(b.get(s, [])), 2, s)
        self.assertEqual(len(aviso_compact.elegir("compactando")), 3)
        self.assertTrue(set(aviso_compact.elegir("algo-raro", n=5)) <= set(b["general"]))


if __name__ == "__main__":
    unittest.main()
