"""conversacion — máquina de turnos de una conversación hablada.

Port literal a Python de RESONANCE, la máquina de turnos ya probada en
TypeScript que vive en `fi-glass/src/voice/` (`resonanceCallMachine.ts`,
`resonanceEffects.ts`, `resonanceCallController.ts`). **Es un port, no un
rediseño**: la tabla de transiciones, el mapa estado→efecto y las entradas del
controlador son las mismas, sólo cambian de idioma los nombres de los métodos.

Por qué existe aquí: en las sesiones de voz el micrófono queda siempre abierto y
el asistente habla por bocina cuando quiere, así que la propia voz sintetizada
(y la música de fondo) vuelve a entrar y se transcribe como si la hubiera dicho
Bernard. El parche vigente —un archivo-candado y una clasificación acústica a
posteriori— *clasifica* cuando lo que hace falta es *controlar*: mientras el
estado sea `speaking`, el micrófono simplemente NO es fuente de turnos del
usuario, y el problema deja de existir.

El núcleo es puro: sin audio, sin hilos, sin I/O. Toda la orquestación real
entra por un conductor (driver) inyectado, así que el contrato completo se
verifica con un conductor falso — ver `test_conversacion.py`.

Este módulo es autocontenido y NO está cableado a nada. El punto de integración
con `motor.py` y `hablar.py` queda documentado al final del archivo.
"""

from __future__ import annotations

from enum import Enum
from typing import Callable, Protocol


class Estado(str, Enum):
    """Los nueve estados de turno. Idénticos a `ResonanceCallState`."""

    IDLE = "idle"
    LISTENING = "listening"
    TRANSCRIBING = "transcribing"
    THINKING = "thinking"
    SPEAKING = "speaking"
    INTERRUPTED = "interrupted"
    SILENCE_HOLD = "silence_hold"
    SLEEP_DECAY = "sleep_decay"
    ENDED = "ended"


class Evento(str, Enum):
    """Las señales que mueven la máquina. Idénticas a `ResonanceCallEvent`.

    Los valores conservan el nombre de cable del original (`call.started`, …)
    para que la tabla de transiciones sea auditable línea por línea contra el
    TypeScript.
    """

    LLAMADA_INICIADA = "call.started"
    MIC_ABIERTO = "mic.opened"
    HABLA_USUARIO_INICIO = "user.speech.started"
    HABLA_USUARIO_FIN = "user.speech.ended"
    STT_COMPLETADO = "stt.completed"
    HABLA_ASISTENTE_INICIO = "assistant.speech.started"
    HABLA_ASISTENTE_INTERRUMPIDA = "assistant.speech.interrupted"
    HABLA_ASISTENTE_COMPLETADA = "assistant.speech.completed"
    SILENCIO_DETECTADO = "silence.detected"
    SILENCIO_RESUME = "silence.resume"
    SLEEP_DECAY_INICIADO = "sleep.decay.started"
    ERROR_RECUPERABLE = "error.recoverable"
    ERROR_FATAL = "error.fatal"
    LLAMADA_TERMINADA = "call.ended"


ESTADO_INICIAL: Estado = Estado.IDLE


TRANSICIONES: dict[Estado, dict[Evento, Estado]] = {
    Estado.IDLE: {
        Evento.LLAMADA_INICIADA: Estado.LISTENING,
    },
    Estado.LISTENING: {
        Evento.MIC_ABIERTO: Estado.LISTENING,
        Evento.HABLA_USUARIO_INICIO: Estado.LISTENING,
        Evento.HABLA_USUARIO_FIN: Estado.TRANSCRIBING,
        Evento.SILENCIO_DETECTADO: Estado.SILENCE_HOLD,
    },
    Estado.TRANSCRIBING: {
        Evento.STT_COMPLETADO: Estado.THINKING,
    },
    Estado.THINKING: {
        Evento.HABLA_ASISTENTE_INICIO: Estado.SPEAKING,
    },
    Estado.SPEAKING: {
        Evento.HABLA_USUARIO_INICIO: Estado.INTERRUPTED,
        Evento.HABLA_ASISTENTE_COMPLETADA: Estado.SILENCE_HOLD,
    },
    Estado.INTERRUPTED: {
        Evento.HABLA_ASISTENTE_INTERRUMPIDA: Estado.LISTENING,
    },
    Estado.SILENCE_HOLD: {
        Evento.SILENCIO_RESUME: Estado.LISTENING,
        Evento.SLEEP_DECAY_INICIADO: Estado.SLEEP_DECAY,
    },
    Estado.SLEEP_DECAY: {
        Evento.SILENCIO_RESUME: Estado.LISTENING,
    },
    Estado.ENDED: {},
}


def es_terminal(estado: Estado) -> bool:
    """`ended` es el único estado terminal."""
    return estado is Estado.ENDED


def reducir(estado: Estado, evento: Evento) -> Estado:
    """Reductor puro `(estado, evento) -> estado`.

    Tres reglas globales van antes de la tabla, igual que en el original:
    terminado se queda terminado, colgar siempre cuelga, y la recuperación es
    global — un efecto que falla en cualquier fase activa devuelve la llamada a
    `listening` (recuperable: tropiezo de STT/agente/TTS) o cuelga (fatal: se
    perdió el micrófono). Sin esto el loop se congelaba en
    transcribing/thinking/speaking cuando el adaptador rechazaba la promesa.
    """
    if es_terminal(estado):
        return estado
    if evento is Evento.LLAMADA_TERMINADA:
        return Estado.ENDED
    if evento is Evento.ERROR_FATAL:
        return Estado.ENDED
    if evento is Evento.ERROR_RECUPERABLE:
        return Estado.IDLE if estado is Estado.IDLE else Estado.LISTENING
    return TRANSICIONES[estado].get(evento, estado)


class Efecto(str, Enum):
    """El único efecto imperativo que corresponde a cada estado."""

    ABRIR_MIC = "abrir_mic"
    INICIAR_TRANSCRIPCION = "iniciar_transcripcion"
    INVOCAR_AGENTE = "invocar_agente"
    HABLAR = "hablar"
    DEJAR_DE_HABLAR = "dejar_de_hablar"
    SOSTENER_SILENCIO = "sostener_silencio"
    DESVANECER_Y_COLGAR = "desvanecer_y_colgar"
    TERMINAR_LLAMADA = "terminar_llamada"


EFECTO_POR_ESTADO: dict[Estado, Efecto | None] = {
    Estado.IDLE: None,
    Estado.LISTENING: Efecto.ABRIR_MIC,
    Estado.TRANSCRIBING: Efecto.INICIAR_TRANSCRIPCION,
    Estado.THINKING: Efecto.INVOCAR_AGENTE,
    Estado.SPEAKING: Efecto.HABLAR,
    Estado.INTERRUPTED: Efecto.DEJAR_DE_HABLAR,
    Estado.SILENCE_HOLD: Efecto.SOSTENER_SILENCIO,
    Estado.SLEEP_DECAY: Efecto.DESVANECER_Y_COLGAR,
    Estado.ENDED: Efecto.TERMINAR_LLAMADA,
}


def efecto_de_estado(estado: Estado) -> Efecto | None:
    """El efecto único al ENTRAR a `estado`, o None si no requiere adaptador.

    Sólo se dispara cuando el estado realmente CAMBIÓ: reentrar al mismo estado
    no debe volver a despachar (el controlador hace la guarda `previo != nuevo`).
    """
    return EFECTO_POR_ESTADO[estado]


class Conductor(Protocol):
    """Lo único que el mundo real tiene que cablear.

    Equivalente de `ResonanceDriver`. Cada método corresponde a un efecto; la
    máquina jamás toca audio, procesos ni hilos por su cuenta.
    """

    def abrir_mic(self) -> None: ...
    def iniciar_transcripcion(self) -> None: ...
    def invocar_agente(self) -> None: ...
    def hablar(self) -> None: ...
    def dejar_de_hablar(self) -> None: ...
    def sostener_silencio(self) -> None: ...
    def desvanecer_y_colgar(self) -> None: ...
    def terminar_llamada(self) -> None: ...


def despachar_efecto(efecto: Efecto | None, conductor: Conductor) -> bool:
    """Despacha un efecto al conductor. Devuelve True si algo corrió."""
    if efecto is None:
        return False
    metodo = getattr(conductor, efecto.value, None)
    if metodo is None:
        return False
    metodo()
    return True


class ControladorConversacion:
    """Sostiene el estado y despacha un efecto por cada CAMBIO de estado.

    Port de `createResonanceCallController`. Las señales externas (mic abierto,
    silencio de fin de habla, transcripción, texto del asistente, TTS terminado,
    barge-in) entran por métodos nombrados que mapean a eventos de la máquina.
    Sin audio, sin hilos: el contrato completo de turnos se verifica con un
    conductor falso.
    """

    def __init__(
        self,
        conductor: Conductor,
        al_cambiar_estado: Callable[[Estado], None] | None = None,
        al_recibir_evento: Callable[[Evento, Estado], None] | None = None,
    ) -> None:
        self._conductor = conductor
        self._al_cambiar_estado = al_cambiar_estado
        self._al_recibir_evento = al_recibir_evento
        self._estado: Estado = ESTADO_INICIAL
        self._transcripcion: str | None = None
        self._texto_asistente: str | None = None
        self._bitacora: list[Evento] = []

    @property
    def estado(self) -> Estado:
        return self._estado

    def ultima_transcripcion(self) -> str | None:
        return self._transcripcion

    def ultimo_texto_asistente(self) -> str | None:
        return self._texto_asistente

    def eventos(self) -> list[Evento]:
        return list(self._bitacora)

    def enviar(self, evento: Evento) -> Estado:
        siguiente = reducir(self._estado, evento)
        self._bitacora.append(evento)
        if self._al_recibir_evento is not None:
            self._al_recibir_evento(evento, siguiente)
        if siguiente is not self._estado:
            self._estado = siguiente
            if self._al_cambiar_estado is not None:
                self._al_cambiar_estado(self._estado)
            despachar_efecto(efecto_de_estado(self._estado), self._conductor)
        return self._estado

    def start_call(self) -> None:
        """Arranca (o reinicia) la sesión.

        Un controlador se reusa entre llamadas, pero `ended` es terminal — así
        que una llamada nueva tiene que resetear la sesión primero; si no,
        `call.started` sobre un controlador ya terminado es un no-op y el botón
        queda muerto.
        """
        self._estado = ESTADO_INICIAL
        self._transcripcion = None
        self._texto_asistente = None
        self._bitacora.clear()
        self.enviar(Evento.LLAMADA_INICIADA)

    def mic_abierto(self) -> None:
        self.enviar(Evento.MIC_ABIERTO)

    def habla_usuario_inicio(self) -> None:
        self.enviar(Evento.HABLA_USUARIO_INICIO)

    def habla_usuario_fin(self) -> None:
        self.enviar(Evento.HABLA_USUARIO_FIN)

    def stt_completado(self, transcripcion: str) -> None:
        self._transcripcion = transcripcion
        self.enviar(Evento.STT_COMPLETADO)

    def turno_asistente_listo(self, texto: str) -> None:
        self._texto_asistente = texto
        self.enviar(Evento.HABLA_ASISTENTE_INICIO)

    def tts_completado(self) -> None:
        self.enviar(Evento.HABLA_ASISTENTE_COMPLETADA)

    def tts_interrumpido(self) -> None:
        self.enviar(Evento.HABLA_ASISTENTE_INTERRUMPIDA)

    def silencio_detectado(self) -> None:
        self.enviar(Evento.SILENCIO_DETECTADO)

    def silencio_resume(self) -> None:
        self.enviar(Evento.SILENCIO_RESUME)

    def sleep_decay(self) -> None:
        self.enviar(Evento.SLEEP_DECAY_INICIADO)

    def interrumpir(self) -> None:
        """Barge-in: corta el TTS primero, luego reabre el micrófono."""
        if self._estado is not Estado.SPEAKING:
            return
        self.enviar(Evento.HABLA_USUARIO_INICIO)
        self.enviar(Evento.HABLA_ASISTENTE_INTERRUMPIDA)

    def fallo_recuperable(self) -> None:
        """Falla recuperable del adaptador (STT/agente/TTS) — vuelve a escuchar."""
        if not es_terminal(self._estado) and self._estado is not Estado.IDLE:
            self.enviar(Evento.ERROR_RECUPERABLE)

    def fallo_fatal(self) -> None:
        """Falla fatal del adaptador (se perdió el micrófono) — cuelga."""
        if not es_terminal(self._estado):
            self.enviar(Evento.ERROR_FATAL)

    def end_call(self) -> None:
        if not es_terminal(self._estado):
            self.enviar(Evento.LLAMADA_TERMINADA)


# ---------------------------------------------------------------------------
# PUNTO DE INTEGRACIÓN (documentado, NO cableado — lo cablea Bernard después)
# ---------------------------------------------------------------------------
#
# Este módulo no importa nada de `motor.py`, `dictar.py`, `hablar.py`, `voz.py`
# ni `lexico.py`, y ninguno de ellos lo importa. Lo que sigue es el contrato que
# habría que tender para conectarlo, sin tocar todavía una línea de esos
# archivos.
#
# 1) EVENTOS QUE TENDRÍA QUE EMITIR `motor.py` (es la fuente de señales)
#
#    `MotorCaptura._segmentar()` ya detecta arranque de voz y 500 ms de silencio
#    para cortar frases; ahí mismo viven los dos eventos que faltan:
#
#      - al cruzar el umbral de RMS hacia arriba (empieza a hablar):
#            controlador.habla_usuario_inicio()
#        Es la señal que da el barge-in gratis: si el estado es `speaking`,
#        la máquina pasa a `interrupted` y dispara `dejar_de_hablar`.
#
#      - al cerrar el utterance por silencio (500 ms tras el habla):
#            controlador.habla_usuario_fin()
#        Pasa a `transcribing` y dispara `iniciar_transcripcion`.
#
#      - cuando la transcripción del utterance regresa (`transcribir_tiers`):
#            controlador.stt_completado(texto)
#
#      - silencio largo sin habla (no hay utterance en N segundos):
#            controlador.silencio_detectado()  →  `silence_hold`
#        y al volver a haber voz:
#            controlador.silencio_resume()
#
#    El hook `on_rms` que ya existe es el lugar natural para el umbral, porque
#    corre en el hilo del segmentador y ya recibe el nivel cuadro a cuadro.
#
#    LA GANANCIA, que es el motivo del port: hoy `_encolar(frames, origen=...)`
#    tiene que ADIVINAR a posteriori si lo que entró fue Bernard o la bocina.
#    Con la máquina, mientras el estado sea `speaking` el micrófono NO es fuente
#    de turnos del usuario — el eco deja de existir como categoría en vez de
#    clasificarse. El archivo-candado `$TMPDIR/susurro-hablando.lock` de
#    `hablar.py` queda redundante: el estado ES el candado, y vive en memoria.
#
# 2) EFECTOS QUE TENDRÍA QUE EJECUTAR EL CONDUCTOR (la implementación real)
#
#    Una clase `ConductorSusurro` que implemente el Protocol `Conductor`:
#
#      abrir_mic            -> MotorCaptura.arrancar() / reanudar el segmentador
#      iniciar_transcripcion-> encolar el utterance a `transcribir_tiers`
#                              (async; al terminar llama `stt_completado`)
#      invocar_agente       -> mandar el turno al agente
#                              (al terminar llama `turno_asistente_listo(texto)`)
#      hablar               -> hablar.hablar(texto)  ← bloquea hasta que suena
#                              (al terminar llama `tts_completado()`)
#      dejar_de_hablar      -> matar el reproductor de `hablar.reproducir()`
#                              (al confirmar llama `tts_interrumpido()`)
#      sostener_silencio    -> no reabrir mic todavía; armar el temporizador de
#                              decaimiento que luego llama `sleep_decay()`
#      desvanecer_y_colgar  -> bajar volumen / cerrar sesión suave
#      terminar_llamada     -> MotorCaptura.cerrar(drenar_segundos=8)
#
#    Regla de oro del cableado: los efectos son DISPAROS, no esperas. Cada
#    adaptador lento (STT, agente, TTS) corre en su propio hilo y reingresa a la
#    máquina por la entrada nombrada que le toca cuando termina; si truena,
#    reingresa por `fallo_recuperable()` (o `fallo_fatal()` si se perdió el
#    micrófono) en vez de dejar la máquina congelada.
#
# 3) LO QUE NO HAY QUE HACER
#
#    No meter locks de archivo ni clasificación acústica de eco dentro de este
#    módulo: eso es precisamente lo que la máquina viene a jubilar.
