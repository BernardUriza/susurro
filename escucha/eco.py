"""Eco TEXTUAL: la voz del interlocutor que entra DOS veces, por el loopback de la bocina
(etiquetada LLAMADA) y por el mic (sin etiqueta, como si fuera BERNARD), cuando se habla
con bocinas abiertas. El antieco WebRTC atenúa esa segunda copia pero no la elimina
(medido 2026-10-27: 4× menos rms, mismas 2 frases falsas), así que aquí se compara el
TEXTO: un utterance del mic cuyo texto se parece a un LLAMADA reciente es eco y se
descarta antes de imprimirse. Bernard no se pone audífonos; el filtro vive aquí.

Las dos copias se transcriben en paralelo y el mic puede llegar ANTES que el loopback,
por eso `es_eco()` espera hasta `espera_s` a que caiga la copia LLAMADA antes de decidir.
Esa espera sólo aplica donde hay loopback (Windows); en la Mac `espera_s=0`."""
import difflib
import re
import threading
import time
import unicodedata
from collections import deque

VENTANA_S = 20.0      # cuánto vive un LLAMADA como referencia
UMBRAL_RATIO = 0.6    # parecido global (SequenceMatcher)
MIN_SUBSTR = 20       # o un tramo literal común de al menos tantos caracteres
MIN_CHARS = 10        # textos más cortos no se juzgan (un «ok» no es eco de nada)


def normalizar(texto):
    plano = "".join(c for c in unicodedata.normalize("NFD", texto or "")
                    if unicodedata.category(c) != "Mn")
    plano = re.sub(r"[^0-9a-zA-Z ]+", " ", plano)
    return re.sub(r"\s+", " ", plano).strip().lower()


def parecidos(a, b):
    """True si `a` (mic) repite `b` (loopback): parecido global, contención, o un tramo
    literal largo en común. Cualquiera de los tres basta: el eco llega recortado por
    los cortes de silencio y con errores distintos de STT en cada copia."""
    if not a or not b:
        return False
    if a in b or b in a:
        return True
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    if sm.ratio() >= UMBRAL_RATIO:
        return True
    m = sm.find_longest_match(0, len(a), 0, len(b))
    return m.size >= MIN_SUBSTR


class FiltroEco:
    def __init__(self, espera_s=0.0, ventana_s=VENTANA_S, reloj=time.monotonic, dormir=time.sleep):
        self.espera_s = espera_s
        self.ventana_s = ventana_s
        self._reloj = reloj
        self._dormir = dormir
        self._llamada = deque()   # (t, texto normalizado)
        self._candado = threading.Lock()
        self.descartados = 0

    def registrar_llamada(self, texto):
        n = normalizar(texto)
        if len(n) < MIN_CHARS:
            return
        with self._candado:
            self._llamada.append((self._reloj(), n))
            self._podar()

    def _podar(self):
        limite = self._reloj() - self.ventana_s
        while self._llamada and self._llamada[0][0] < limite:
            self._llamada.popleft()

    def _coincide(self, n):
        with self._candado:
            self._podar()
            return next((ref for _, ref in self._llamada if parecidos(n, ref)), None)

    def es_eco(self, texto):
        """Para un utterance del MIC. Devuelve el LLAMADA con el que coincide, o None.
        Espera hasta `espera_s` a que llegue la copia del loopback si aún no está."""
        n = normalizar(texto)
        if len(n) < MIN_CHARS:
            return None
        plazo = self._reloj() + self.espera_s
        while True:
            ref = self._coincide(n)
            if ref is not None:
                self.descartados += 1
                return ref
            if self._reloj() >= plazo:
                return None
            self._dormir(0.25)
