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


class TestReempaquetado(unittest.TestCase):
    def test_chunks_de_10ms_salen_como_frames_de_30ms(self):
        fuente = FuenteLoopback(Fallos(Path(tempfile.mkdtemp()) / "f.log"))
        fuente.vivo = True
        fuente.rate, fuente.canales = 48000, 2
        chunk = array.array("h", [900, 300] * (48000 * 10 // 1000)).tobytes()
        for _ in range(3):
            fuente.cola.put(chunk)
        gen = fuente.frames()
        d = next(gen)
        self.assertEqual(len(d), FRAME_BYTES, "tres chunks de 10 ms = un frame de 30 ms")
        self.assertEqual(rms_frame(d), 600)
        fuente.cola.put(chunk)
        self.assertEqual(next(gen), bytes(FRAME_BYTES), "con 10 ms sueltos no hay frame: sale silencio y el resto espera")
        fuente.cola.put(chunk)
        fuente.cola.put(chunk)
        self.assertEqual(rms_frame(next(gen)), 600)


class TestColaConTope(unittest.TestCase):
    def test_cola_llena_tira_y_avisa_una_vez_por_crecimiento(self):
        base = Path(tempfile.mkdtemp())
        fallos = Fallos(base / "f.log")
        fuente = FuenteLoopback(fallos)
        fuente.vivo = True
        for _ in range(FuenteLoopback.COLA_MAX):
            fuente.cola.put_nowait(frame_16k(1))
        with self.assertRaises(queue.Full):
            fuente.cola.put_nowait(frame_16k(1))
        fuente.tirados = 7
        gen = fuente.frames()
        next(gen)
        self.assertEqual(fallos.por_origen.get("loopback"), 1, "un aviso por crecimiento del contador")
        next(gen)
        self.assertEqual(fallos.por_origen.get("loopback"), 1, "sin crecimiento no se repite")
        fuente.cerrar()
        self.assertIn(None, list(fuente.cola.queue), "cerrar() mete el None aunque la cola esté llena")


class TestParadaCooperativa(unittest.TestCase):
    def test_parar_termina_entre_utterances_sin_none(self):
        base = Path(tempfile.mkdtemp())
        motor = MotorCaptura(base, Fallos(base / "f.log"), loopback=False)
        motor.cola.put(base / "utt-0001.wav")
        bandera = {"parar": False}
        vistos = []
        for utt in motor.utterances(timeout=0.05, parar=lambda: bandera["parar"]):
            vistos.append(utt)
            bandera["parar"] = True
        self.assertEqual(vistos, [base / "utt-0001.wav"], "la frase en vuelo se entrega; luego termina sin None")

    def test_cerrar_recoge_la_ultima_frase_de_llamada_tras_el_none_del_mic(self):
        base = Path(tempfile.mkdtemp())
        motor = MotorCaptura(base, Fallos(base / "f.log"), loopback=False)
        voz = [frame_16k(0)] * 5 + [frame_16k(2000)] * 40 + [frame_16k(0)] * 25
        motor._hilo_mic = threading.Thread(target=motor._segmentar, args=(iter([frame_16k(0)] * 3), "BERNARD", True))
        motor._hilo_mic.start()
        motor._hilo_mic.join()
        motor._hilo_llamada = threading.Thread(target=motor._segmentar, args=(iter(voz), "LLAMADA", False))
        motor._hilo_llamada.start()
        rezagados = motor.cerrar(drenar_segundos=3)
        self.assertEqual(len(rezagados), 1, "el None del mic no corta el drenado")
        self.assertEqual(motor.origen_de(rezagados[0]), "LLAMADA")


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
