"""Contrato de la máquina de turnos — port de `resonanceCallController.test.ts`.

Los 11 casos del TypeScript, uno a uno, con un conductor FALSO: sin micrófono,
sin bocina, sin hilos. Si estos once pasan, la máquina de turnos es la misma que
Bernard ya validó en fi-glass.

    python3 -m unittest escucha.test_conversacion -v
"""

from __future__ import annotations

import unittest

try:
    from conversacion import ControladorConversacion, Estado, Evento
except ImportError:  # cuando se corre como `escucha.test_conversacion`
    from escucha.conversacion import ControladorConversacion, Estado, Evento


class ConductorFalso:
    """Registra cada efecto recibido, en orden, sin hacer nada real."""

    def __init__(self) -> None:
        self.llamadas: list[str] = []

    def _anotar(self, nombre: str) -> None:
        self.llamadas.append(nombre)

    def cuantas(self, nombre: str) -> int:
        return self.llamadas.count(nombre)

    def desde(self, marca: int) -> list[str]:
        return self.llamadas[marca:]

    def abrir_mic(self) -> None:
        self._anotar("abrir_mic")

    def iniciar_transcripcion(self) -> None:
        self._anotar("iniciar_transcripcion")

    def invocar_agente(self) -> None:
        self._anotar("invocar_agente")

    def hablar(self) -> None:
        self._anotar("hablar")

    def dejar_de_hablar(self) -> None:
        self._anotar("dejar_de_hablar")

    def sostener_silencio(self) -> None:
        self._anotar("sostener_silencio")

    def desvanecer_y_colgar(self) -> None:
        self._anotar("desvanecer_y_colgar")

    def terminar_llamada(self) -> None:
        self._anotar("terminar_llamada")


def nuevo(**hooks):
    conductor = ConductorFalso()
    return conductor, ControladorConversacion(conductor, **hooks)


class TestControladorConversacion(unittest.TestCase):
    def test_arranca_idle_y_solo_abre_el_mic_en_start_call(self):
        conductor, c = nuevo()
        self.assertIs(c.estado, Estado.IDLE)
        self.assertEqual(conductor.cuantas("abrir_mic"), 0)
        c.start_call()
        self.assertIs(c.estado, Estado.LISTENING)
        self.assertEqual(conductor.cuantas("abrir_mic"), 1)

    def test_turno_feliz_completo_mic_stt_agente_habla_autoresume(self):
        conductor, c = nuevo()
        c.start_call()
        c.habla_usuario_fin()  # listening -> transcribing
        self.assertEqual(conductor.cuantas("iniciar_transcripcion"), 1)
        c.stt_completado("hola americio")  # transcribing -> thinking
        self.assertEqual(c.ultima_transcripcion(), "hola americio")
        self.assertEqual(conductor.cuantas("invocar_agente"), 1)
        c.turno_asistente_listo("hola, te escucho")  # thinking -> speaking
        self.assertEqual(c.ultimo_texto_asistente(), "hola, te escucho")
        self.assertEqual(conductor.cuantas("hablar"), 1)
        c.tts_completado()  # speaking -> silence_hold
        self.assertEqual(conductor.cuantas("sostener_silencio"), 1)
        c.silencio_resume()  # silence_hold -> listening
        self.assertIs(c.estado, Estado.LISTENING)
        self.assertEqual(conductor.cuantas("abrir_mic"), 2)  # inicial + auto-resume

    def test_barge_in_interrumpir_corta_el_tts_y_luego_reabre_el_mic(self):
        conductor, c = nuevo()
        c.start_call()
        c.habla_usuario_fin()
        c.stt_completado("x")
        c.turno_asistente_listo("respuesta larga")
        self.assertIs(c.estado, Estado.SPEAKING)

        marca = len(conductor.llamadas)
        c.interrumpir()
        self.assertIs(c.estado, Estado.LISTENING)
        self.assertEqual(
            conductor.desde(marca), ["dejar_de_hablar", "abrir_mic"]
        )  # cortar PRIMERO, luego capturar

    def test_interrumpir_es_no_op_cuando_no_esta_hablando(self):
        conductor, c = nuevo()
        c.start_call()  # listening
        c.interrumpir()
        self.assertEqual(conductor.cuantas("dejar_de_hablar"), 0)
        self.assertIs(c.estado, Estado.LISTENING)

    def test_colgado_por_sueno_silence_hold_sleep_decay_end_call(self):
        conductor, c = nuevo()
        c.start_call()
        c.habla_usuario_fin()
        c.stt_completado("x")
        c.turno_asistente_listo("y")
        c.tts_completado()  # silence_hold
        c.sleep_decay()  # sleep_decay -> desvanecer_y_colgar
        self.assertEqual(conductor.cuantas("desvanecer_y_colgar"), 1)
        c.end_call()  # ended -> terminar_llamada
        self.assertIs(c.estado, Estado.ENDED)
        self.assertEqual(conductor.cuantas("terminar_llamada"), 1)

    def test_end_call_cuelga_y_ended_ignora_senales_pero_start_call_reinicia(self):
        _, c = nuevo()
        c.start_call()
        c.end_call()
        self.assertIs(c.estado, Estado.ENDED)
        c.habla_usuario_inicio()
        c.stt_completado("x")
        self.assertIs(c.estado, Estado.ENDED)
        c.start_call()
        self.assertIs(c.estado, Estado.LISTENING)

    def test_fallo_recuperable_desde_transcribing_vuelve_a_listening(self):
        conductor, c = nuevo()
        c.start_call()
        c.habla_usuario_fin()  # transcribing
        self.assertIs(c.estado, Estado.TRANSCRIBING)
        c.fallo_recuperable()  # -> listening (reabre el mic)
        self.assertIs(c.estado, Estado.LISTENING)
        self.assertEqual(conductor.cuantas("abrir_mic"), 2)

    def test_fallo_fatal_cuelga_la_llamada(self):
        conductor, c = nuevo()
        c.start_call()
        c.fallo_fatal()
        self.assertIs(c.estado, Estado.ENDED)
        self.assertEqual(conductor.cuantas("terminar_llamada"), 1)

    def test_fallo_recuperable_es_no_op_antes_de_arrancar_la_llamada(self):
        _, c = nuevo()
        c.fallo_recuperable()
        self.assertIs(c.estado, Estado.IDLE)

    def test_puede_REINICIAR_despues_de_terminada(self):
        conductor, c = nuevo()
        c.start_call()
        c.end_call()
        self.assertIs(c.estado, Estado.ENDED)
        c.start_call()
        self.assertIs(c.estado, Estado.LISTENING)
        self.assertEqual(conductor.cuantas("abrir_mic"), 2)
        c.habla_usuario_fin()
        self.assertIs(c.estado, Estado.TRANSCRIBING)

    def test_emite_observadores_de_estado_y_evento_y_guarda_la_bitacora(self):
        estados: list[Estado] = []
        eventos: list[Evento] = []
        _, c = nuevo(
            al_cambiar_estado=lambda s: estados.append(s),
            al_recibir_evento=lambda e, _s: eventos.append(e),
        )
        c.start_call()
        c.habla_usuario_fin()
        self.assertEqual(estados, [Estado.LISTENING, Estado.TRANSCRIBING])
        self.assertEqual(eventos, [Evento.LLAMADA_INICIADA, Evento.HABLA_USUARIO_FIN])
        self.assertEqual(
            c.eventos(), [Evento.LLAMADA_INICIADA, Evento.HABLA_USUARIO_FIN]
        )


if __name__ == "__main__":
    unittest.main()
