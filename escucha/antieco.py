"""Cancelación de eco acústico en la ONDA del micrófono: lo que suena por la bocina
(la referencia, frames del loopback WASAPI) se resta de lo que entra al mic antes
de segmentar. WebRTC AEC3 vía `pywebrtc-audio`.

Medido 2026-10-27 en la ThinkPad con eco sintético (40 ms, 50 %): eco 1494 → 140
rms (−20 dB), voz 2828 → 2532 (−1 dB), converge en < 1 s, 35 ms de CPU por 6 s.
Sin la librería el mic pasa intacto y se avisa UNA vez: el tag BOCINA por energía
sigue siendo la red. Un AEC roto nunca tumba una llamada."""
import queue

TASA = 16000
# Frames de referencia que el mic puede llevar de atraso antes de tirar lo viejo (30 ms c/u)
MAX_ATRASO = 10
ESPERA_REFERENCIA_S = 0.035


class Antieco:
    def __init__(self, fallos, referencia, delay_ms=0):
        self.fallos = fallos
        self.referencia = referencia
        self.activo = False
        self.sin_referencia = 0
        self.resincronizados = 0
        self.procesados = 0
        try:
            import numpy as np
            from pywebrtc_audio import EchoCanceller
        except ImportError as e:
            fallos.avisar("antieco", f"sin cancelación de eco: {e}; python -m pip install --user pywebrtc-audio")
            return
        self.np = np
        self.aec = EchoCanceller(sample_rate=TASA, num_channels=1, stream_delay_ms=delay_ms)
        self.activo = True

    def procesar(self, frame):
        """frame del mic (bytes s16le 16 kHz mono) → frame con el eco de la bocina restado."""
        if not self.activo:
            return frame
        try:
            while self.referencia.qsize() > MAX_ATRASO:
                self.referencia.get_nowait()
                self.resincronizados += 1
            try:
                # La bocina produce un frame cada 30 ms sin falta (silencio incluido); esperar
                # uno mantiene el emparejamiento en vez de meter ceros y desalinear el AEC
                far = self.referencia.get(timeout=ESPERA_REFERENCIA_S)
            except queue.Empty:
                far = bytes(len(frame))
                self.sin_referencia += 1
            if len(far) != len(frame):
                far = (far + bytes(len(frame)))[:len(frame)]
            near = self.np.frombuffer(frame, dtype=self.np.int16)
            lejos = self.np.frombuffer(far, dtype=self.np.int16)
            salida = self.np.asarray(self.aec.process(near, lejos), dtype=self.np.int16)
            self.procesados += 1
            return salida.tobytes() if len(salida) == len(near) else frame
        except Exception as e:
            self.activo = False
            self.fallos.avisar("antieco", f"{type(e).__name__}: {e}; el mic sigue sin cancelación")
            return frame

    def resumen(self):
        if not self.activo and not self.procesados:
            return "no"
        return f"sí ({self.procesados} frames, {self.sin_referencia} sin referencia, {self.resincronizados} tirados)"
