"""Prueba de los cortes de `archivo.py` (sin red ni ffmpeg).

Whisper de Azure acepta ≤25 MB por request, así que un archivo largo se parte.
El corte debe caer en una PAUSA cercana al nominal (no a media palabra) y los
timestamps de cada trozo se re-desplazan por su offset.
"""
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import archivo
from archivo import (codigo_idioma, limpiar_alucinaciones, puntos_de_corte,
                     segundos_con_sonido, tramos_sin_oir)

AMARA = "Subtítulos realizados por la comunidad de Amara.org"


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


class TestAlucinaciones(unittest.TestCase):
    """Loret 2026-10-09: 10 min de noticiero salieron como 21 veces AMARA."""

    def test_tira_los_creditos_de_amara_y_sus_palabras(self):
        r = {"text": f"{AMARA} hola mundo", "duration": 40.0,
             "segments": [{"start": 3.8, "end": 4.06, "text": AMARA},
                          {"start": 10.0, "end": 11.0, "text": "hola mundo"}],
             "words": [{"start": 3.8, "end": 3.86, "word": "Subtítulos"},
                       {"start": 10.0, "end": 10.4, "word": "hola"},
                       {"start": 10.5, "end": 11.0, "word": "mundo"}]}
        limpio, tirados = limpiar_alucinaciones(r)
        self.assertEqual(tirados, 1)
        self.assertEqual([x["text"] for x in limpio["segments"]], ["hola mundo"])
        self.assertEqual([w["word"] for w in limpio["words"]], ["hola", "mundo"])
        self.assertEqual(limpio["text"], "hola mundo")

    def test_habla_real_parecida_no_se_toca(self):
        for texto in ["Gracias por su atención", "Subtítulos por ESO",
                      "los subtítulos realizados por la comunidad de Amara.org fueron citados en el informe"]:
            r = {"text": texto, "segments": [{"start": 0, "end": 2, "text": texto}], "words": []}
            self.assertEqual(limpiar_alucinaciones(r), (r, 0), texto)

    def test_variantes_de_amara(self):
        for texto in [AMARA, "Subtítulos por la comunidad de Amara.org.", "Subtitles by the Amara.org community"]:
            self.assertIsNotNone(archivo.ALUCINACION.fullmatch(texto), texto)


class TestTramosSinOir(unittest.TestCase):
    def test_sonido_sin_palabras_es_tramo(self):
        self.assertEqual(tramos_sin_oir([], 600.0, []), [(0.0, 600.0)])

    def test_silencio_largo_de_verdad_no_cuenta(self):
        self.assertEqual(tramos_sin_oir([{"start": 0, "end": 5}], 600.0, [(5.0, 600.0)]), [])

    def test_hueco_en_medio_entre_segmentos(self):
        segs = [{"start": 0, "end": 30}, {"start": 200, "end": 230}]
        self.assertEqual(tramos_sin_oir(segs, 240.0, []), [(30.0, 200.0)])

    def test_huecos_cortos_no_cuentan(self):
        segs = [{"start": t, "end": t + 20} for t in range(0, 600, 50)]
        self.assertEqual(tramos_sin_oir(segs, 600.0, []), [])

    def test_segundos_con_sonido(self):
        self.assertEqual(segundos_con_sonido(0, 100, [(10, 30), (90, 120)]), 70)


class TestTranscribirArchivo(unittest.TestCase):
    """El flujo completo con el gateway y ffmpeg simulados."""

    def correr(self, respuestas: dict[str, dict], silencios=()):
        def partir(path, destino, trozo=archivo.TROZO_SEG):
            if trozo == 120:  # reintento: 600 s → 5 × 120 s
                return [(destino / f"sub-{k}.mp3", k * 120.0) for k in range(5)]
            if trozo == 30:   # segundo nivel: 120 s → 4 × 30 s
                return [(destino / f"{path.stem}-{k}.mp3", k * 30.0) for k in range(4)]
            return [(destino / "trozo-000.mp3", 0.0), (destino / "trozo-001.mp3", 600.0)]

        def trozo(path, *a, **k):
            return respuestas[path.name]

        with tempfile.NamedTemporaryFile(suffix=".mp4") as f, \
                mock.patch.object(archivo, "partir", partir), \
                mock.patch.object(archivo, "transcribir_trozo", trozo), \
                mock.patch.object(archivo, "intervalos_silencio", lambda p: list(silencios)):
            avisos = []
            return archivo.transcribir_archivo(f.name, "es", token="x", avisar=avisos.append), avisos

    @staticmethod
    def habla(dur, texto="habla real", cada=20.0):
        segs = [{"start": t, "end": t + cada - 1, "text": f"{texto} {int(t)}"}
                for t in [i * cada for i in range(int(dur // cada))]]
        return {"text": " ".join(s["text"] for s in segs), "language": "spanish",
                "duration": dur, "segments": segs, "words": []}

    def test_trozo_alucinado_se_repite_en_subtrozos(self):
        loret = {"text": AMARA, "language": "spanish", "duration": 600.0, "words": [],
                 "segments": [{"start": t, "end": t + 0.3, "text": AMARA} for t in range(4, 600, 30)]}
        respuestas = {"trozo-000.mp3": loret, "trozo-001.mp3": self.habla(600)}
        respuestas |= {f"sub-{k}.mp3": self.habla(120, f"sub{k}") for k in range(5)}
        r, avisos = self.correr(respuestas)
        self.assertNotIn("Amara", r["text"])
        self.assertEqual(r["segments"][0]["text"], "sub0 0")
        self.assertEqual(r["segments"][6]["start"], 120.0)  # sub-1 desplazado a su offset global
        self.assertEqual(r["huecos"], [])
        self.assertTrue(any("lo repito" in a for a in avisos))

    @staticmethod
    def amara(dur):
        return {"text": AMARA, "language": "spanish", "duration": dur, "words": [],
                "segments": [{"start": 4, "end": 4.3, "text": AMARA}]}

    def test_lo_que_ni_el_reintento_oye_se_reporta_en_un_solo_hueco(self):
        respuestas = {"trozo-000.mp3": self.amara(600), "trozo-001.mp3": self.habla(600),
                      "sub-0.mp3": self.amara(120)}
        respuestas |= {f"sub-0-{k}.mp3": self.amara(30) for k in range(4)}
        respuestas |= {f"sub-{k}.mp3": self.habla(120) for k in range(1, 5)}
        r, avisos = self.correr(respuestas)
        self.assertEqual(r["huecos"], [{"start": 0.0, "end": 120.0, "motivo": "sólo alucinación"}])
        self.assertTrue(any("0:00–0:30" in a for a in avisos))

    def test_segundo_nivel_rescata_el_habla_tras_la_musica(self):
        """Loret 2:00–4:00: música hasta 3:18 y luego la nota; el pedazo de 2 min
        sale contaminado entero, los de 30 s ya oyen lo que viene después."""
        respuestas = {"trozo-000.mp3": self.amara(600), "trozo-001.mp3": self.habla(600),
                      "sub-1.mp3": self.amara(120)}
        respuestas |= {f"sub-{k}.mp3": self.habla(120) for k in (0, 2, 3, 4)}
        respuestas |= {"sub-1-0.mp3": self.amara(30), "sub-1-1.mp3": self.amara(30),
                       "sub-1-2.mp3": self.habla(30, "nota"), "sub-1-3.mp3": self.habla(30, "nota")}
        r, _ = self.correr(respuestas)
        self.assertEqual(r["huecos"], [{"start": 120.0, "end": 180.0, "motivo": "sólo alucinación"}])
        nota = [x for x in r["segments"] if x["text"].startswith("nota")]
        self.assertEqual(nota[0]["start"], 180.0)
        self.assertEqual([x["start"] for x in r["segments"]], sorted(x["start"] for x in r["segments"]))

    def test_trozo_sano_no_se_repite(self):
        r, avisos = self.correr({"trozo-000.mp3": self.habla(600), "trozo-001.mp3": self.habla(600)})
        self.assertEqual(r["huecos"], [])
        self.assertEqual(len(r["segments"]), 60)
        self.assertFalse(any("lo repito" in a for a in avisos))


if __name__ == "__main__":
    unittest.main()
